
-- ========================================
-- 迁移文件: 003_add_article_settings_columns.sql
-- 说明: 为 articles 表添加文章设置和转化目标相关字段
-- ========================================

-- 添加 article_setting_id 和 article_setting_snapshot
ALTER TABLE articles ADD COLUMN IF NOT EXISTS article_setting_id INTEGER;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS article_setting_snapshot TEXT;

-- 添加 conversion_target_id 和 conversion_target_snapshot
ALTER TABLE articles ADD COLUMN IF NOT EXISTS conversion_target_id INTEGER;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS conversion_target_snapshot TEXT;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_articles_article_setting_id ON articles(article_setting_id);
CREATE INDEX IF NOT EXISTS idx_articles_conversion_target_id ON articles(conversion_target_id);

-- 注释
COMMENT ON COLUMN articles.article_setting_snapshot IS '文章设置快照（生成时的名称）';
COMMENT ON COLUMN articles.conversion_target_snapshot IS '转化目标快照（生成时的名称）';
