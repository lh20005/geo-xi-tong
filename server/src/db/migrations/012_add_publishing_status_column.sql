-- ==================== UP ====================
-- 添加 publishing_status 列到 articles 表
-- 用于跟踪文章的发布状态

-- 添加 publishing_status 列
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS publishing_status VARCHAR(20) DEFAULT 'unpublished';

-- 更新现有数据：根据 is_published 字段设置 publishing_status
UPDATE articles 
SET publishing_status = CASE 
  WHEN is_published = true THEN 'published'
  ELSE 'unpublished'
END
WHERE publishing_status = 'unpublished';

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_articles_publishing_status 
ON articles(publishing_status);

-- 添加注释
COMMENT ON COLUMN articles.publishing_status IS '发布状态: unpublished(未发布), publishing(发布中), published(已发布), failed(发布失败)';

-- ==================== DOWN ====================
-- 回滚 publishing_status 列

-- 删除索引
DROP INDEX IF EXISTS idx_articles_publishing_status;

-- 删除列
ALTER TABLE articles 
DROP COLUMN IF EXISTS publishing_status;
