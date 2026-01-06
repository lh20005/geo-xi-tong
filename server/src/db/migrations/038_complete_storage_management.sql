-- ==================== UP ====================
-- 迁移：完整的存储管理方案
-- 功能：
-- 1. 图片软删除支持
-- 2. 文章图片存储计入用户配额
-- 3. 孤儿文件定期清理支持
-- 4. 存储空间不足提示

-- ============================================
-- 1. 图片表添加软删除字段
-- ============================================
ALTER TABLE images 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS is_orphan BOOLEAN DEFAULT FALSE;

-- 添加索引优化查询
CREATE INDEX IF NOT EXISTS idx_images_deleted_at ON images(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_images_orphan ON images(is_orphan) WHERE is_orphan = TRUE;

-- 添加字段注释
COMMENT ON COLUMN images.deleted_at IS '软删除时间，NULL表示未删除';
COMMENT ON COLUMN images.is_orphan IS '是否为孤儿文件（图库删除但被文章引用）';

-- ============================================
-- 2. 文章表添加图片大小字段（用于存储计算）
-- ============================================
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS image_size_bytes INTEGER DEFAULT 0;

COMMENT ON COLUMN articles.image_size_bytes IS '文章引用图片的大小（字节），用于存储配额计算';

-- 填充现有文章的图片大小
UPDATE articles a
SET image_size_bytes = COALESCE(
  (SELECT i.size FROM images i WHERE i.filepath = a.image_url),
  0
)
WHERE a.image_url IS NOT NULL AND a.image_size_bytes = 0;

-- ============================================
-- 3. 创建视图：用户实际存储使用（包含文章图片）
-- ============================================
CREATE OR REPLACE VIEW v_user_storage_actual AS
SELECT 
  u.id as user_id,
  -- 图片存储（未删除的图片）
  COALESCE(SUM(CASE WHEN i.deleted_at IS NULL THEN i.size ELSE 0 END), 0) as image_storage_bytes,
  COUNT(CASE WHEN i.deleted_at IS NULL THEN 1 END) as image_count,
  -- 文章图片存储（文章引用的图片，即使图片已从图库删除）
  COALESCE((
    SELECT SUM(a.image_size_bytes) 
    FROM articles a 
    WHERE a.user_id = u.id AND a.image_size_bytes > 0
  ), 0) as article_image_storage_bytes,
  -- 文章数量
  (SELECT COUNT(*) FROM articles a WHERE a.user_id = u.id) as article_count,
  -- 文档存储
  COALESCE((
    SELECT SUM(kd.file_size) 
    FROM knowledge_documents kd 
    JOIN knowledge_bases kb ON kd.knowledge_base_id = kb.id 
    WHERE kb.user_id = u.id
  ), 0) as document_storage_bytes,
  (SELECT COUNT(*) FROM knowledge_documents kd JOIN knowledge_bases kb ON kd.knowledge_base_id = kb.id WHERE kb.user_id = u.id) as document_count
FROM users u
LEFT JOIN albums al ON al.user_id = u.id
LEFT JOIN images i ON i.album_id = al.id
GROUP BY u.id;

-- ============================================
-- 4. 创建函数：检查图片是否被文章引用
-- ============================================
CREATE OR REPLACE FUNCTION is_image_referenced(image_filepath VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM articles WHERE image_url = image_filepath
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. 创建函数：获取孤儿图片（可清理的图片）
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
    al.user_id
  FROM images i
  JOIN albums al ON i.album_id = al.id
  WHERE i.deleted_at IS NOT NULL
    AND i.deleted_at < NOW() - (min_age_hours || ' hours')::INTERVAL
    AND NOT is_image_referenced(i.filepath);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. 创建函数：软删除图片
-- ============================================
CREATE OR REPLACE FUNCTION soft_delete_image(image_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  img_filepath VARCHAR;
  is_ref BOOLEAN;
BEGIN
  -- 获取图片路径
  SELECT filepath INTO img_filepath FROM images WHERE id = image_id;
  
  IF img_filepath IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- 检查是否被文章引用
  is_ref := is_image_referenced(img_filepath);
  
  -- 更新为软删除状态
  UPDATE images 
  SET deleted_at = NOW(),
      is_orphan = is_ref
  WHERE id = image_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. 创建函数：更新文章图片大小
-- ============================================
CREATE OR REPLACE FUNCTION update_article_image_size()
RETURNS TRIGGER AS $$
DECLARE
  img_size INTEGER;
BEGIN
  -- 当文章的 image_url 变化时，更新 image_size_bytes
  IF NEW.image_url IS NOT NULL AND NEW.image_url != '' THEN
    -- 尝试从 images 表获取大小
    SELECT size INTO img_size FROM images WHERE filepath = NEW.image_url LIMIT 1;
    
    IF img_size IS NOT NULL THEN
      NEW.image_size_bytes := img_size;
    ELSE
      -- 如果图片不在 images 表中（可能已删除），保持原值或设为0
      NEW.image_size_bytes := COALESCE(NEW.image_size_bytes, 0);
    END IF;
  ELSE
    NEW.image_size_bytes := 0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_update_article_image_size ON articles;
CREATE TRIGGER trigger_update_article_image_size
BEFORE INSERT OR UPDATE OF image_url ON articles
FOR EACH ROW
EXECUTE FUNCTION update_article_image_size();

-- ============================================
-- 8. 创建函数：同步用户存储使用
-- ============================================
CREATE OR REPLACE FUNCTION sync_user_storage_usage(p_user_id INTEGER)
RETURNS VOID AS $$
DECLARE
  v_image_bytes BIGINT;
  v_image_count INTEGER;
  v_doc_bytes BIGINT;
  v_doc_count INTEGER;
  v_article_bytes BIGINT;
  v_article_count INTEGER;
BEGIN
  -- 计算图片存储（未删除的图片）
  SELECT 
    COALESCE(SUM(i.size), 0),
    COUNT(*)
  INTO v_image_bytes, v_image_count
  FROM images i
  JOIN albums al ON i.album_id = al.id
  WHERE al.user_id = p_user_id AND i.deleted_at IS NULL;
  
  -- 计算文档存储
  SELECT 
    COALESCE(SUM(kd.file_size), 0),
    COUNT(*)
  INTO v_doc_bytes, v_doc_count
  FROM knowledge_documents kd
  JOIN knowledge_bases kb ON kd.knowledge_base_id = kb.id
  WHERE kb.user_id = p_user_id;
  
  -- 计算文章图片存储
  SELECT 
    COALESCE(SUM(image_size_bytes), 0),
    COUNT(*)
  INTO v_article_bytes, v_article_count
  FROM articles
  WHERE user_id = p_user_id;
  
  -- 更新存储使用记录
  UPDATE user_storage_usage
  SET 
    image_storage_bytes = v_image_bytes,
    image_count = v_image_count,
    document_storage_bytes = v_doc_bytes,
    document_count = v_doc_count,
    article_storage_bytes = v_article_bytes,
    article_count = v_article_count,
    total_storage_bytes = v_image_bytes + v_doc_bytes + v_article_bytes,
    last_updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. 添加字段注释
-- ============================================
COMMENT ON FUNCTION is_image_referenced(VARCHAR) IS '检查图片是否被文章引用';
COMMENT ON FUNCTION get_orphan_images_to_cleanup(INTEGER) IS '获取可清理的孤儿图片列表';
COMMENT ON FUNCTION soft_delete_image(INTEGER) IS '软删除图片';
COMMENT ON FUNCTION update_article_image_size() IS '自动更新文章图片大小的触发器函数';
COMMENT ON FUNCTION sync_user_storage_usage(INTEGER) IS '同步用户存储使用统计';

-- ==================== DOWN ====================
-- 回滚

-- 删除触发器
DROP TRIGGER IF EXISTS trigger_update_article_image_size ON articles;

-- 删除函数
DROP FUNCTION IF EXISTS sync_user_storage_usage(INTEGER);
DROP FUNCTION IF EXISTS update_article_image_size();
DROP FUNCTION IF EXISTS soft_delete_image(INTEGER);
DROP FUNCTION IF EXISTS get_orphan_images_to_cleanup(INTEGER);
DROP FUNCTION IF EXISTS is_image_referenced(VARCHAR);

-- 删除视图
DROP VIEW IF EXISTS v_user_storage_actual;

-- 删除字段
ALTER TABLE articles DROP COLUMN IF EXISTS image_size_bytes;
ALTER TABLE images DROP COLUMN IF EXISTS is_orphan;
ALTER TABLE images DROP COLUMN IF EXISTS deleted_at;

-- 删除索引
DROP INDEX IF EXISTS idx_images_orphan;
DROP INDEX IF EXISTS idx_images_deleted_at;
