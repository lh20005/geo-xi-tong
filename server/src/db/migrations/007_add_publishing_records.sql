-- 发布记录表
-- 记录文章在各个平台的发布情况

CREATE TABLE IF NOT EXISTS publishing_records (
  id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  task_id INTEGER REFERENCES publishing_tasks(id) ON DELETE SET NULL,
  platform_id VARCHAR(50) NOT NULL,
  account_id INTEGER NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
  account_name VARCHAR(100),
  platform_article_id VARCHAR(255),
  platform_url VARCHAR(500),
  published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_publishing_records_article ON publishing_records(article_id);
CREATE INDEX IF NOT EXISTS idx_publishing_records_task ON publishing_records(task_id);
CREATE INDEX IF NOT EXISTS idx_publishing_records_platform ON publishing_records(platform_id);
CREATE INDEX IF NOT EXISTS idx_publishing_records_account ON publishing_records(account_id);
CREATE INDEX IF NOT EXISTS idx_publishing_records_published_at ON publishing_records(published_at DESC);

-- 为 articles 表添加发布状态字段（如果不存在）
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'articles' AND column_name = 'is_published') THEN
    ALTER TABLE articles ADD COLUMN is_published BOOLEAN DEFAULT FALSE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'articles' AND column_name = 'published_at') THEN
    ALTER TABLE articles ADD COLUMN published_at TIMESTAMP;
  END IF;
END $$;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_articles_is_published ON articles(is_published);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
