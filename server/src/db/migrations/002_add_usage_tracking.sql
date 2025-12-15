-- 添加使用追踪功能
-- 为蒸馏结果添加使用次数字段，并创建使用记录表

-- 1. 为distillations表添加usage_count字段
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'distillations' AND column_name = 'usage_count'
  ) THEN
    ALTER TABLE distillations ADD COLUMN usage_count INTEGER DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- 2. 创建distillation_usage表（使用记录表）
CREATE TABLE IF NOT EXISTS distillation_usage (
  id SERIAL PRIMARY KEY,
  distillation_id INTEGER NOT NULL REFERENCES distillations(id) ON DELETE CASCADE,
  task_id INTEGER NOT NULL REFERENCES generation_tasks(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_article_usage UNIQUE (article_id)
);

-- 3. 创建索引以优化查询性能
-- 支持智能选择查询（按usage_count和created_at排序）
CREATE INDEX IF NOT EXISTS idx_distillations_usage_count ON distillations(usage_count ASC, created_at ASC);

-- 支持使用历史查询
CREATE INDEX IF NOT EXISTS idx_distillation_usage_distillation ON distillation_usage(distillation_id);
CREATE INDEX IF NOT EXISTS idx_distillation_usage_task ON distillation_usage(task_id);
CREATE INDEX IF NOT EXISTS idx_distillation_usage_article ON distillation_usage(article_id);
CREATE INDEX IF NOT EXISTS idx_distillation_usage_used_at ON distillation_usage(used_at DESC);

-- 4. 为现有蒸馏结果初始化usage_count（已通过DEFAULT 0完成）

-- 5. 根据现有文章记录重新计算usage_count
UPDATE distillations d
SET usage_count = (
  SELECT COUNT(*)
  FROM articles a
  WHERE a.distillation_id = d.id
)
WHERE EXISTS (
  SELECT 1 FROM articles a WHERE a.distillation_id = d.id
);

-- 6. 添加检查约束确保usage_count非负
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE constraint_name = 'check_usage_count_non_negative'
  ) THEN
    ALTER TABLE distillations ADD CONSTRAINT check_usage_count_non_negative CHECK (usage_count >= 0);
  END IF;
END $$;
