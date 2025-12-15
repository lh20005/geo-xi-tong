-- 回滚智能选择功能
-- 移除generation_tasks表的selected_distillation_ids字段

-- 1. 删除索引
DROP INDEX IF EXISTS idx_generation_tasks_selected_distillations;

-- 2. 删除字段
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'generation_tasks' AND column_name = 'selected_distillation_ids'
  ) THEN
    ALTER TABLE generation_tasks DROP COLUMN selected_distillation_ids;
  END IF;
END $$;

