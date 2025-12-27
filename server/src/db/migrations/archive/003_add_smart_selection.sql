-- 添加智能选择功能
-- 为generation_tasks表添加selected_distillation_ids字段，支持任务级别的蒸馏结果选择

-- 1. 为generation_tasks表添加selected_distillation_ids字段
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'generation_tasks' AND column_name = 'selected_distillation_ids'
  ) THEN
    ALTER TABLE generation_tasks ADD COLUMN selected_distillation_ids TEXT;
  END IF;
END $$;

-- 2. 创建索引以优化查询性能（可选，用于查询优化）
CREATE INDEX IF NOT EXISTS idx_generation_tasks_selected_distillations 
ON generation_tasks(selected_distillation_ids);

-- 3. 为所有现有任务初始化selected_distillation_ids
-- 使用distillation_id作为单元素JSON数组
UPDATE generation_tasks
SET selected_distillation_ids = json_build_array(distillation_id)::text
WHERE selected_distillation_ids IS NULL;

-- 4. 验证数据完整性
-- 确保所有任务都有有效的selected_distillation_ids
DO $$
BEGIN
  -- 检查是否有NULL值
  IF EXISTS (SELECT 1 FROM generation_tasks WHERE selected_distillation_ids IS NULL) THEN
    RAISE EXCEPTION '存在selected_distillation_ids为NULL的任务记录';
  END IF;
  
  -- 检查JSON格式是否有效（PostgreSQL会自动验证）
  -- 如果JSON格式无效，UPDATE语句会失败
END $$;

