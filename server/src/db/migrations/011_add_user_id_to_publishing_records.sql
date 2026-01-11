-- ==================== UP ====================
-- 为 publishing_records 表添加 user_id 字段以实现用户隔离
-- 这是一个关键的安全修复

-- 0. 首先确保 articles 表有 user_id 字段
ALTER TABLE articles ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_articles_user_id ON articles(user_id);

-- 0.1 确保 platform_accounts 表有 user_id 字段
ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_platform_accounts_user_id ON platform_accounts(user_id);

-- 1. 添加 user_id 字段（允许为 NULL，稍后填充）
ALTER TABLE publishing_records 
ADD COLUMN IF NOT EXISTS user_id INTEGER;

-- 2. 添加 account_id 字段（如果不存在）
ALTER TABLE publishing_records 
ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES platform_accounts(id) ON DELETE SET NULL;

-- 3. 从关联的 articles 表填充 user_id（如果 articles 有 user_id）
UPDATE publishing_records pr
SET user_id = a.user_id
FROM articles a
WHERE pr.article_id = a.id
AND pr.user_id IS NULL
AND a.user_id IS NOT NULL;

-- 4. 对于没有关联文章的记录，从 platform_accounts 表填充
UPDATE publishing_records pr
SET user_id = pa.user_id
FROM platform_accounts pa
WHERE pr.account_id = pa.id
AND pr.user_id IS NULL
AND pa.user_id IS NOT NULL;

-- 5. 删除没有 user_id 的孤立记录（新数据库不会有这种情况）
DELETE FROM publishing_records WHERE user_id IS NULL;

-- 6. 将字段设置为 NOT NULL（仅当表中有数据时才执行）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM publishing_records LIMIT 1) THEN
    ALTER TABLE publishing_records ALTER COLUMN user_id SET NOT NULL;
  ELSE
    -- 表为空时，直接设置 NOT NULL
    ALTER TABLE publishing_records ALTER COLUMN user_id SET NOT NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- 如果失败（比如有 NULL 值），跳过
  RAISE NOTICE 'Could not set user_id to NOT NULL: %', SQLERRM;
END $$;

-- 5. 添加外键约束（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_publishing_records_user' 
    AND table_name = 'publishing_records'
  ) THEN
    ALTER TABLE publishing_records 
    ADD CONSTRAINT fk_publishing_records_user 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 6. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_publishing_records_user_id ON publishing_records(user_id);

-- 7. 创建复合索引以优化常见查询
CREATE INDEX IF NOT EXISTS idx_publishing_records_user_platform ON publishing_records(user_id, platform_id);
CREATE INDEX IF NOT EXISTS idx_publishing_records_user_article ON publishing_records(user_id, article_id);

-- ==================== DOWN ====================
-- 回滚用户隔离修复

-- 1. 删除索引
DROP INDEX IF EXISTS idx_publishing_records_user_article;
DROP INDEX IF EXISTS idx_publishing_records_user_platform;
DROP INDEX IF EXISTS idx_publishing_records_user_id;

-- 2. 删除外键约束
ALTER TABLE publishing_records 
DROP CONSTRAINT IF EXISTS fk_publishing_records_user;

-- 3. 删除 user_id 字段
ALTER TABLE publishing_records 
DROP COLUMN IF EXISTS user_id;
