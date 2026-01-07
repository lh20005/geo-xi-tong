-- ==================== UP ====================
-- 迁移：修复孤儿图片存储计算问题
-- 
-- 问题：删除相册后，孤儿图片（被文章引用但已软删除）无法通过 JOIN albums 关联到用户
--       导致存储计算遗漏这些图片
-- 
-- 解决方案：
-- 1. 在 images 表添加 user_id 字段，直接关联用户
-- 2. 修改 sync_user_storage_usage 函数，使用 images.user_id 查询
-- 3. 修改 get_orphan_images_to_cleanup 函数，使用 images.user_id
-- 4. 修改 decrement_image_reference 函数，在删除图片时释放存储

-- ============================================
-- 1. 修改 album_id 外键约束（删除相册时不级联删除图片）
-- ============================================
ALTER TABLE images DROP CONSTRAINT IF EXISTS images_album_id_fkey;
ALTER TABLE images ALTER COLUMN album_id DROP NOT NULL;
ALTER TABLE images ADD CONSTRAINT images_album_id_fkey 
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL;

-- ============================================
-- 2. 添加 user_id 字段到 images 表
-- ============================================
ALTER TABLE images 
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_images_user_id ON images(user_id);

-- 添加字段注释
COMMENT ON COLUMN images.user_id IS '图片所属用户ID，用于存储计算（即使相册被删除也能关联用户）';

-- ============================================
-- 2. 填充现有数据的 user_id
-- ============================================
UPDATE images i
SET user_id = a.user_id
FROM albums a
WHERE i.album_id = a.id AND i.user_id IS NULL;

-- ============================================
-- 3. 更新存储计算函数
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
  -- 计算图片存储（直接使用 images.user_id，不依赖 albums）：
  -- 1. 图库中的图片（未删除）
  -- 2. 孤儿图片（已删除但仍被文章引用，reference_count > 0）
  SELECT 
    COALESCE(SUM(i.size), 0),
    COUNT(*)
  INTO v_image_bytes, v_image_count
  FROM images i
  WHERE i.user_id = p_user_id
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

  -- 更新存储使用记录（不更新 total_storage_bytes，它是生成列）
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

COMMENT ON FUNCTION sync_user_storage_usage(INTEGER) IS '同步用户存储使用统计（使用 images.user_id 直接关联）';

-- ============================================
-- 4. 更新获取孤儿图片函数
-- ============================================
CREATE OR REPLACE FUNCTION get_orphan_images_to_cleanup(
  min_age_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  id INTEGER,
  filepath VARCHAR,
  size INTEGER,
  deleted_at TIMESTAMP,
  user_id INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.filepath,
    i.size,
    i.deleted_at,
    i.user_id
  FROM images i
  WHERE i.deleted_at IS NOT NULL
    AND i.deleted_at < NOW() - (min_age_hours || ' hours')::INTERVAL
    AND i.reference_count = 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_orphan_images_to_cleanup(INTEGER) IS '获取可清理的孤儿图片（使用 images.user_id）';

-- ============================================
-- 5. 更新减少引用计数函数（返回 user_id 用于存储同步）
-- ============================================
CREATE OR REPLACE FUNCTION decrement_image_reference(p_image_id INTEGER)
RETURNS TABLE(should_delete BOOLEAN, filepath VARCHAR, image_user_id INTEGER) AS $$
DECLARE
  v_ref_count INTEGER;
  v_deleted_at TIMESTAMP;
  v_filepath VARCHAR;
  v_user_id INTEGER;
BEGIN
  -- 减少引用计数
  UPDATE images
  SET reference_count = GREATEST(COALESCE(reference_count, 0) - 1, 0)
  WHERE id = p_image_id
  RETURNING reference_count, deleted_at, images.filepath, images.user_id
  INTO v_ref_count, v_deleted_at, v_filepath, v_user_id;

  -- 判断是否需要真正删除
  -- 条件：reference_count = 0 且已软删除
  IF v_ref_count = 0 AND v_deleted_at IS NOT NULL THEN
    -- 删除数据库记录
    DELETE FROM images WHERE id = p_image_id;
    RETURN QUERY SELECT TRUE, v_filepath, v_user_id;
  ELSE
    RETURN QUERY SELECT FALSE, NULL::VARCHAR, v_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION decrement_image_reference(INTEGER) IS '减少图片引用计数，返回是否需要删除物理文件和用户ID';

-- ============================================
-- 6. 更新用户存储明细视图
-- ============================================
CREATE OR REPLACE VIEW v_user_storage_detail AS
SELECT 
  u.id as user_id,
  u.username,
  -- 图库图片（未删除）
  COALESCE((
    SELECT SUM(i.size) 
    FROM images i 
    WHERE i.user_id = u.id AND i.deleted_at IS NULL
  ), 0) as gallery_image_bytes,
  -- 孤儿图片（已删除但被引用）
  COALESCE((
    SELECT SUM(i.size) 
    FROM images i 
    WHERE i.user_id = u.id AND i.deleted_at IS NOT NULL AND i.reference_count > 0
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

-- 恢复原来的函数（使用 JOIN albums）
-- CREATE OR REPLACE FUNCTION sync_user_storage_usage(p_user_id INTEGER) ...
-- CREATE OR REPLACE FUNCTION get_orphan_images_to_cleanup(min_age_hours INTEGER) ...
-- CREATE OR REPLACE FUNCTION decrement_image_reference(p_image_id INTEGER) ...

-- 删除索引
-- DROP INDEX IF EXISTS idx_images_user_id;

-- 删除字段
-- ALTER TABLE images DROP COLUMN IF EXISTS user_id;
