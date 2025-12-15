-- 回滚使用追踪功能
-- 如果迁移失败或需要回滚，运行此脚本

-- 1. 删除索引
DROP INDEX IF EXISTS idx_distillation_usage_used_at;
DROP INDEX IF EXISTS idx_distillation_usage_article;
DROP INDEX IF EXISTS idx_distillation_usage_task;
DROP INDEX IF EXISTS idx_distillation_usage_distillation;
DROP INDEX IF EXISTS idx_distillations_usage_count;

-- 2. 删除distillation_usage表
DROP TABLE IF EXISTS distillation_usage;

-- 3. 删除约束
ALTER TABLE distillations DROP CONSTRAINT IF EXISTS check_usage_count_non_negative;

-- 4. 删除usage_count字段
ALTER TABLE distillations DROP COLUMN IF EXISTS usage_count;

-- 验证回滚
SELECT 'Rollback completed successfully' as status;
