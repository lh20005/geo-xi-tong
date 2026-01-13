-- 058_add_article_snapshot_to_publishing_tasks.sql
-- 为发布任务添加文章快照字段
-- 解决问题：同一文章发布到多个平台时，第一个平台发布成功后文章被删除，
-- 导致后续平台的任务找不到文章内容

-- 添加文章快照字段到 publishing_tasks 表
ALTER TABLE publishing_tasks 
ADD COLUMN IF NOT EXISTS article_title TEXT,
ADD COLUMN IF NOT EXISTS article_content TEXT,
ADD COLUMN IF NOT EXISTS article_keyword VARCHAR(255),
ADD COLUMN IF NOT EXISTS article_image_url TEXT;

-- 添加注释
COMMENT ON COLUMN publishing_tasks.article_title IS '文章标题快照（创建任务时保存）';
COMMENT ON COLUMN publishing_tasks.article_content IS '文章内容快照（创建任务时保存）';
COMMENT ON COLUMN publishing_tasks.article_keyword IS '文章关键词快照（创建任务时保存）';
COMMENT ON COLUMN publishing_tasks.article_image_url IS '文章图片URL快照（创建任务时保存）';

-- 为现有的 pending 任务填充快照数据（如果文章还存在）
UPDATE publishing_tasks pt
SET 
  article_title = a.title,
  article_content = a.content,
  article_keyword = a.keyword,
  article_image_url = a.image_url
FROM articles a
WHERE pt.article_id = a.id
  AND pt.status = 'pending'
  AND pt.article_title IS NULL;
