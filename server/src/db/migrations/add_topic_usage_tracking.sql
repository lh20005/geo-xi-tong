-- 数据库迁移：添加话题使用追踪功能
-- 创建时间：2025-12-15
-- 目的：解决话题轮换使用和使用统计问题

-- 步骤1: 给topics表添加usage_count字段
ALTER TABLE topics 
ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0 CHECK (usage_count >= 0)

-- 步骤2: 给articles表添加topic_id字段（记录使用的具体话题）
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL

-- 步骤3: 创建话题使用记录表
CREATE TABLE IF NOT EXISTS topic_usage (
  id SERIAL PRIMARY KEY,
  topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  distillation_id INTEGER NOT NULL REFERENCES distillations(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  task_id INTEGER REFERENCES generation_tasks(id) ON DELETE SET NULL,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_article_topic UNIQUE (article_id, topic_id)
)

-- 步骤4: 为现有数据初始化usage_count
UPDATE topics 
SET usage_count = 0 
WHERE usage_count IS NULL

-- 步骤5: 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_topics_usage_count ON topics(usage_count ASC, created_at ASC)

CREATE INDEX IF NOT EXISTS idx_topics_distillation_usage ON topics(distillation_id, usage_count ASC)

CREATE INDEX IF NOT EXISTS idx_topic_usage_topic_id ON topic_usage(topic_id)

CREATE INDEX IF NOT EXISTS idx_topic_usage_article_id ON topic_usage(article_id)

CREATE INDEX IF NOT EXISTS idx_topic_usage_distillation_id ON topic_usage(distillation_id)

CREATE INDEX IF NOT EXISTS idx_articles_topic_id ON articles(topic_id)

-- 步骤6: 添加注释
COMMENT ON COLUMN topics.usage_count IS '话题被用于生成文章的次数'

COMMENT ON TABLE topic_usage IS '话题使用记录表，追踪每个话题被哪些文章使用'

COMMENT ON COLUMN articles.topic_id IS '文章使用的具体话题ID'
