-- Migration 050: 修复多账号支持
-- 创建时间: 2026-01-09
-- 描述: 修改唯一约束，支持同一平台多账号登录
-- 原约束：(user_id, platform, platform_id) - 每个用户每个平台只能一个账号
-- 新约束：(user_id, platform_id, real_username) - 每个用户每个平台可以有多个不同用户名的账号

-- ==================== UP ====================

-- 1. 添加 real_username 列（如果不存在）
ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS real_username VARCHAR(100);

-- 2. 填充现有数据的 real_username（使用 account_name 作为默认值）
UPDATE platform_accounts SET real_username = account_name WHERE real_username IS NULL;

-- 3. 删除旧的唯一约束（如果存在）
ALTER TABLE platform_accounts DROP CONSTRAINT IF EXISTS unique_user_platform_account;

-- 4. 添加新的唯一约束（基于 user_id, platform_id, real_username）
-- 使用 COALESCE 处理 NULL 值
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_platform_real_username 
ON platform_accounts (user_id, platform_id, COALESCE(real_username, account_name));

-- 5. 添加注释说明
COMMENT ON COLUMN platform_accounts.real_username IS '平台上的真实用户名（用于区分同一平台的多个账号）';
COMMENT ON INDEX unique_user_platform_real_username IS '确保同一用户在同一平台下不能有重复的真实用户名账号';

-- ==================== DOWN ====================

-- 1. 删除新的唯一索引
DROP INDEX IF EXISTS unique_user_platform_real_username;

-- 2. 恢复旧的唯一约束
ALTER TABLE platform_accounts 
ADD CONSTRAINT unique_user_platform_account UNIQUE (user_id, platform, platform_id);

-- 3. 删除 real_username 列
ALTER TABLE platform_accounts DROP COLUMN IF EXISTS real_username;
