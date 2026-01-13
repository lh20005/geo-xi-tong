-- ==================== UP ====================
-- 迁移：重构存储管理 - 引用计数模式
-- 
-- 核心变更：
-- 1. 添加 images.reference_count 字段（替代 usage_count 用于存储计算）
-- 2. 添加 articles.image_id 字段（关联图片）
-- 3. 更新存储计算函数（只计算图片，不重复计算文章引用）
-- 4. 移除 article_storage_bytes 中的图片存储计算

-- ============================================
-- 1. 添加 reference_count 字段（如果不存在）
-- ============================================
ALTER TABLE images 
ADD COLUMN IF NOT EXISTS reference_count INTEGER DEFAULT 0;

COMMENT ON COLUMN images.reference_count IS '被文章引用的次数，用于存储配额计算';

-- ============================================
-- 2. 添加 articles.image_id 字段
-- ============================================
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS image_id INTEGER REFERENCES images(id) ON DELETE SET NULL;

COMMENT ON COLUMN articles.image_id IS '引用的图片ID，用于引用计数管理';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_articles_image_id ON articles(image_id) WHERE image_id IS NOT NULL;

-- ============================================
-- 3. 初始化现有数据的 reference_count
-- ============================================
-- 根据 image_usage 表更新 reference_count
UPDATE images i
SET reference_count = (
  SELECT COUNT(DISTINCT iu.article_id)
  FROM image_usage iu
  WHERE iu.image_id = i.id
)
WHERE EXISTS (SELECT 1 FROM image_usage iu WHERE iu.image_id = i.id);

-- 根据 articles.image_url 更新 articles.image_id
UPDATE articles a
SET image_id = i.id
FROM images i
WHERE a.image_url = '/uploads/gallery/' || i.filepath
  AND a.image_id IS NULL;

-- ============================================
-- 4. 更新存储计算函数
-- ============================================
CREATE OR REPLACE FUNCTION sync_user_storage_usage(p_user_id INTEGER)
RETURNS VOID AS $$
DECLARE
  v_image_bytes BIGINT;
  v_image_count INTEGER;
  v_doc_bytes BIGINT;
  v_doc_count INTEGER;
  v_article_count INTEGER;
BEGIN
  -- 计算图片存储：
  -- 1. 图库中的图片（未删除）
  -- 2. 孤儿图片（已删除但仍被文章引用，reference_count > 0）
  SELECT 
    COALESCE(SUM(i.size), 0),
    COUNT(*)
  INTO v_image_bytes, v_image_count
  FROM images i
  JOIN albums al ON i.album_id = al.id
  WHERE al.user_id = p_user_id
    AND (i.deleted_at IS NULL OR i.reference_count > 0);

  -- 计算文档存储
  SELECT 
    COALESCE(SUM(kd.file_size), 0),
    COUNT(*)
  INTO v_doc_bytes, v_doc_count
  FROM knowledge_documents kd
  JOIN knowledge_bases kb ON kd.knowledge_base_id = kb.id
  WHERE kb.user_id = p_user_id;

  -- 计算文章数量（不计算存储，文本内容忽略不计）
  SELECT COUNT(*)
  INTO v_article_count
  FROM articles
  WHERE user_id = p_user_id;

  -- 更新存储使用记录
  UPDATE user_storage_usage
  SET 
    image_storage_bytes = v_image_bytes,
    image_count = v_image_count,
    document_storage_bytes = v_doc_bytes,
    document_count = v_doc_count,
    article_storage_bytes = 0,  -- 文章不再单独计算存储
    article_count = v_article_count,
    last_updated_at = NOW()
  WHERE user_id = p_user_id;

  -- 如果记录不存在，插入新记录
  IF NOT FOUND THEN
    INSERT INTO user_storage_usage (
      user_id, 
      image_storage_bytes, image_count,
      document_storage_bytes, document_count,
      article_storage_bytes, article_count,
      last_updated_at
    ) VALUES (
      p_user_id,
      v_image_bytes, v_image_count,
      v_doc_bytes, v_doc_count,
      0, v_article_count,
      NOW()
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_user_storage_usage(INTEGER) IS '同步用户存储使用统计（引用计数模式）';

-- ============================================
-- 5. 创建增加引用计数的函数
-- ============================================
CREATE OR REPLACE FUNCTION increment_image_reference(p_image_id INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE images
  SET reference_count = COALESCE(reference_count, 0) + 1,
      usage_count = COALESCE(usage_count, 0) + 1
  WHERE id = p_image_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_image_reference(INTEGER) IS '增加图片引用计数和使用次数';

-- ============================================
-- 6. 创建减少引用计数的函数（并处理清理）
-- ============================================
CREATE OR REPLACE FUNCTION decrement_image_reference(p_image_id INTEGER)
RETURNS TABLE(should_delete BOOLEAN, filepath VARCHAR) AS $$
DECLARE
  v_ref_count INTEGER;
  v_deleted_at TIMESTAMP;
  v_filepath VARCHAR;
BEGIN
  -- 减少引用计数
  UPDATE images
  SET reference_count = GREATEST(COALESCE(reference_count, 0) - 1, 0)
  WHERE id = p_image_id
  RETURNING reference_count, deleted_at, images.filepath
  INTO v_ref_count, v_deleted_at, v_filepath;

  -- 判断是否需要真正删除
  -- 条件：reference_count = 0 且已软删除
  IF v_ref_count = 0 AND v_deleted_at IS NOT NULL THEN
    -- 删除数据库记录
    DELETE FROM images WHERE id = p_image_id;
    RETURN QUERY SELECT TRUE, v_filepath;
  ELSE
    RETURN QUERY SELECT FALSE, NULL::VARCHAR;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION decrement_image_reference(INTEGER) IS '减少图片引用计数，返回是否需要删除物理文件';

-- ============================================
-- 7. 创建视图：用户存储明细
-- ============================================
CREATE OR REPLACE VIEW v_user_storage_detail AS
SELECT 
  u.id as user_id,
  u.username,
  -- 图库图片（未删除）
  COALESCE((
    SELECT SUM(i.size) 
    FROM images i 
    JOIN albums a ON i.album_id = a.id 
    WHERE a.user_id = u.id AND i.deleted_at IS NULL
  ), 0) as gallery_image_bytes,
  -- 孤儿图片（已删除但被引用）
  COALESCE((
    SELECT SUM(i.size) 
    FROM images i 
    JOIN albums a ON i.album_id = a.id 
    WHERE a.user_id = u.id AND i.deleted_at IS NOT NULL AND i.reference_count > 0
  ), 0) as orphan_image_bytes,
  -- 文档
  COALESCE((
    SELECT SUM(kd.file_size) 
    FROM knowledge_documents kd 
    JOIN knowledge_bases kb ON kd.knowledge_base_id = kb.id 
    WHERE kb.user_id = u.id
  ), 0) as document_bytes,
  -- 文章数量
  (SELECT COUNT(*) FROM articles a WHERE a.user_id = u.id) as article_count
FROM users u;

-- ==================== DOWN ====================
-- 回滚脚本

-- DROP VIEW IF EXISTS v_user_storage_detail;
-- DROP FUNCTION IF EXISTS decrement_image_reference(INTEGER);
-- DROP FUNCTION IF EXISTS increment_image_reference(INTEGER);
-- ALTER TABLE articles DROP COLUMN IF EXISTS image_id;
-- ALTER TABLE images DROP COLUMN IF EXISTS reference_count;
