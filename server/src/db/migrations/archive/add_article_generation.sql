-- 迁移脚本：添加文章生成功能
-- 日期：2024-01-01

-- 创建文章生成任务表
CREATE TABLE IF NOT EXISTS generation_tasks (
  id SERIAL PRIMARY KEY,
  distillation_id INTEGER NOT NULL REFERENCES distillations(id) ON DELETE CASCADE,
  album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  knowledge_base_id INTEGER NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  article_setting_id INTEGER NOT NULL REFERENCES article_settings(id) ON DELETE CASCADE,
  requested_count INTEGER NOT NULL CHECK (requested_count > 0),
  generated_count INTEGER DEFAULT 0 CHECK (generated_count >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 为articles表添加新字段
ALTER TABLE articles ADD COLUMN IF NOT EXISTS title VARCHAR(500);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS task_id INTEGER REFERENCES generation_tasks(id) ON DELETE SET NULL;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_generation_tasks_status ON generation_tasks(status);
CREATE INDEX IF NOT EXISTS idx_generation_tasks_created_at ON generation_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_task_id ON articles(task_id);
CREATE INDEX IF NOT EXISTS idx_articles_title ON articles(title);
