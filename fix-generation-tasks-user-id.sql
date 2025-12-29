-- 修复 generation_tasks 表缺少 user_id 字段的问题

-- 1. 添加 user_id 字段（如果不存在）
ALTER TABLE generation_tasks 
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- 2. 为现有数据设置默认用户（ID=1）
UPDATE generation_tasks SET user_id = 1 WHERE user_id IS NULL;

-- 3. 设置为必填字段
ALTER TABLE generation_tasks ALTER COLUMN user_id SET NOT NULL;

-- 4. 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_generation_tasks_user_id ON generation_tasks(user_id);

-- 验证修改
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'generation_tasks' 
ORDER BY ordinal_position;
