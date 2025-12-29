-- 给 publishing_tasks 表添加 user_id 字段
-- 这是多租户隔离的关键字段

-- 1. 添加 user_id 字段（允许NULL，因为需要先填充数据）
ALTER TABLE publishing_tasks 
ADD COLUMN IF NOT EXISTS user_id INTEGER;

-- 2. 从 platform_accounts 表填充 user_id
-- 通过 account_id 关联获取对应的 user_id
UPDATE publishing_tasks pt
SET user_id = pa.user_id
FROM platform_accounts pa
WHERE pt.account_id = pa.id
AND pt.user_id IS NULL;

-- 3. 从 articles 表填充剩余的 user_id（如果 platform_accounts 中找不到）
UPDATE publishing_tasks pt
SET user_id = a.user_id
FROM articles a
WHERE pt.article_id = a.id
AND pt.user_id IS NULL;

-- 4. 设置 user_id 为 NOT NULL（确保所有记录都有 user_id）
ALTER TABLE publishing_tasks 
ALTER COLUMN user_id SET NOT NULL;

-- 5. 添加外键约束
ALTER TABLE publishing_tasks
ADD CONSTRAINT fk_publishing_tasks_user
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 6. 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_publishing_tasks_user_id ON publishing_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_publishing_tasks_user_status ON publishing_tasks(user_id, status);

-- 7. 添加注释
COMMENT ON COLUMN publishing_tasks.user_id IS '任务所属用户ID（多租户隔离）';
