-- 添加转化目标字段到文章生成任务表
-- 迁移日期: 2024-12-13

-- 添加conversion_target_id字段（可选，允许NULL以保持向后兼容性）
ALTER TABLE generation_tasks 
ADD COLUMN IF NOT EXISTS conversion_target_id INTEGER REFERENCES conversion_targets(id) ON DELETE SET NULL;

-- 添加索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_generation_tasks_conversion_target 
ON generation_tasks(conversion_target_id);

-- 添加注释
COMMENT ON COLUMN generation_tasks.conversion_target_id IS '关联的转化目标ID，用于定制化文章生成';
