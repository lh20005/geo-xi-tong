-- 为 publishing_records 表添加 user_id 字段以实现用户隔离
-- 这是一个关键的安全修复

-- 1. 添加 user_id 字段（允许为 NULL，稍后填充）
ALTER TABLE publishing_records 
ADD COLUMN IF NOT EXISTS user_id INTEGER;

-- 2. 从关联的 articles 表填充 user_id
UPDATE publishing_records pr
SET user_id = a.user_id
FROM articles a
WHERE pr.article_id = a.id
AND pr.user_id IS NULL;

-- 3. 对于没有关联文章的记录，从 platform_accounts 表填充
UPDATE publishing_records pr
SET user_id = pa.user_id
FROM platform_accounts pa
WHERE pr.account_id = pa.id
AND pr.user_id IS NULL;

-- 4. 将字段设置为 NOT NULL
ALTER TABLE publishing_records 
ALTER COLUMN user_id SET NOT NULL;

-- 5. 添加外键约束
ALTER TABLE publishing_records 
ADD CONSTRAINT fk_publishing_records_user 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 6. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_publishing_records_user_id ON publishing_records(user_id);

-- 7. 创建复合索引以优化常见查询
CREATE INDEX IF NOT EXISTS idx_publishing_records_user_platform ON publishing_records(user_id, platform_id);
CREATE INDEX IF NOT EXISTS idx_publishing_records_user_article ON publishing_records(user_id, article_id);
