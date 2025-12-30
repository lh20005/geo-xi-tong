-- 修复转化目标表的唯一约束问题
-- 删除全局唯一约束，只保留用户级别的唯一约束

-- 1. 删除旧的全局唯一约束
ALTER TABLE conversion_targets 
DROP CONSTRAINT IF EXISTS conversion_targets_company_name_key;

-- 2. 确保用户级别的唯一约束存在
ALTER TABLE conversion_targets 
DROP CONSTRAINT IF EXISTS unique_user_company_name;

ALTER TABLE conversion_targets 
ADD CONSTRAINT unique_user_company_name UNIQUE (user_id, company_name);

-- 3. 验证约束
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'conversion_targets'::regclass
  AND contype IN ('u', 'p')
ORDER BY conname;
