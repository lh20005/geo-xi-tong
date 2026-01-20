-- ==================== UP ====================
-- 为 publishing_records 表添加文章快照字段
-- 发布成功后保存文章快照，然后删除原文章

-- 1. 添加文章快照字段
ALTER TABLE publishing_records
ADD COLUMN IF NOT EXISTS article_title VARCHAR(500),
ADD COLUMN IF NOT EXISTS article_content TEXT,
ADD COLUMN IF NOT EXISTS article_keyword VARCHAR(255),
ADD COLUMN IF NOT EXISTS article_image_url TEXT,
ADD COLUMN IF NOT EXISTS topic_question TEXT,
ADD COLUMN IF NOT EXISTS article_setting_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS distillation_keyword VARCHAR(255),
ADD COLUMN IF NOT EXISTS platform_name VARCHAR(100);

-- 2. 修改 article_id 外键约束，改为 ON DELETE SET NULL（允许删除原文章）
-- 先删除旧的外键约束
ALTER TABLE publishing_records
DROP CONSTRAINT IF EXISTS publishing_records_article_id_fkey;

-- 3. 将 article_id 改为可空
ALTER TABLE publishing_records
ALTER COLUMN article_id DROP NOT NULL;

-- 4. 添加新的外键约束（ON DELETE SET NULL）
ALTER TABLE publishing_records
ADD CONSTRAINT publishing_records_article_id_fkey
FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE SET NULL;

-- 5. 为现有记录填充快照数据（从关联的文章中获取）
UPDATE publishing_records pr
SET 
  article_title = a.title,
  article_content = a.content,
  article_keyword = a.keyword,
  article_image_url = a.image_url,
  topic_question = t.question,
  article_setting_name = COALESCE(gt.article_setting_name, ast.name),
  distillation_keyword = d.keyword
FROM articles a
LEFT JOIN topics t ON a.topic_id = t.id
LEFT JOIN generation_tasks gt ON a.task_id = gt.id
LEFT JOIN article_settings ast ON gt.article_setting_id = ast.id
LEFT JOIN distillations d ON a.distillation_id = d.id
WHERE pr.article_id = a.id
  AND pr.article_title IS NULL;

-- 5.1 为现有记录填充平台名称快照
UPDATE publishing_records pr
SET platform_name = pc.platform_name
FROM platforms_config pc
WHERE pr.platform_id = pc.platform_id
  AND pr.platform_name IS NULL;

-- 6. 创建索引以优化查询
CREATE INDEX IF NOT EXISTS idx_publishing_records_article_keyword ON publishing_records(article_keyword);
CREATE INDEX IF NOT EXISTS idx_publishing_records_published_at ON publishing_records(published_at DESC);

COMMENT ON COLUMN publishing_records.article_title IS '文章标题快照';
COMMENT ON COLUMN publishing_records.article_content IS '文章内容快照';
COMMENT ON COLUMN publishing_records.article_keyword IS '文章关键词快照';
COMMENT ON COLUMN publishing_records.article_image_url IS '文章图片URL快照';
COMMENT ON COLUMN publishing_records.topic_question IS '蒸馏话题问题快照';
COMMENT ON COLUMN publishing_records.article_setting_name IS '文章设置名称快照';
COMMENT ON COLUMN publishing_records.distillation_keyword IS '蒸馏关键词快照';
COMMENT ON COLUMN publishing_records.platform_name IS '平台名称快照';

-- ==================== DOWN ====================
-- 回滚：删除快照字段，恢复外键约束

-- 1. 删除索引
DROP INDEX IF EXISTS idx_publishing_records_article_keyword;
DROP INDEX IF EXISTS idx_publishing_records_published_at;

-- 2. 删除快照字段
ALTER TABLE publishing_records
DROP COLUMN IF EXISTS article_title,
DROP COLUMN IF EXISTS article_content,
DROP COLUMN IF EXISTS article_keyword,
DROP COLUMN IF EXISTS article_image_url,
DROP COLUMN IF EXISTS topic_question,
DROP COLUMN IF EXISTS article_setting_name,
DROP COLUMN IF EXISTS distillation_keyword,
DROP COLUMN IF EXISTS platform_name;

-- 3. 删除新的外键约束
ALTER TABLE publishing_records
DROP CONSTRAINT IF EXISTS publishing_records_article_id_fkey;

-- 4. 将 article_id 改回 NOT NULL（注意：如果有 NULL 值会失败）
-- ALTER TABLE publishing_records
-- ALTER COLUMN article_id SET NOT NULL;

-- 5. 恢复原来的外键约束（ON DELETE CASCADE）
-- ALTER TABLE publishing_records
-- ADD CONSTRAINT publishing_records_article_id_fkey
-- FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE;
