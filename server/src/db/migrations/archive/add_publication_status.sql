-- 为articles表添加发布状态字段
-- 迁移脚本: add_publication_status.sql
-- 创建时间: 2025-12-15

-- 添加发布状态字段
ALTER TABLE articles ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;

-- 添加发布时间字段
ALTER TABLE articles ADD COLUMN IF NOT EXISTS published_at TIMESTAMP;

-- 创建索引以优化查询
CREATE INDEX IF NOT EXISTS idx_articles_is_published ON articles(is_published);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);

-- 为现有文章设置默认值（如果需要）
UPDATE articles SET is_published = false WHERE is_published IS NULL;
