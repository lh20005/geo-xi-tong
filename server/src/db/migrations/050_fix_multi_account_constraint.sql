-- Migration 048: 修复多账号支持
-- 创建时间: 2026-01-09
-- 描述: 修改唯一约束，支持同一平台多账号登录
-- 原约束：(user_id, platform, platform_id) - 每个用户每个平台只能一个账号
-- 新约束：(user_id, platform_id, real_username) - 每个用户每个平台可以有多个不同用户名的账号

-- ==================== UP ====================

-- 1. 删除旧的唯一约束
ALTER TABLE platform_accounts DROP CONSTRAINT IF EXISTS unique_user_platform_account;

-- 2. 添加新的唯一约束（基于 user_id, platform_id, real_username）
-- 注意：real_username 可能为 NULL，所以使用 COALESCE 处理
-- 创建一个唯一索引而不是约束，以便更好地处理 NULL 值
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_platform_real_username 
ON platform_accounts (user_id, platform_id, COALESCE(real_username, account_name));

-- 3. 添加注释说明
COMMENT ON INDEX unique_user_platform_real_username IS '确保同一用户在同一平台下不能有重复的真实用户名账号';

-- ==================== DOWN ====================

-- 1. 删除新的唯一索引
DROP INDEX IF EXISTS unique_user_platform_real_username;

-- 2. 恢复旧的唯一约束
ALTER TABLE platform_accounts 
ADD CONSTRAINT unique_user_platform_account UNIQUE (user_id, platform, platform_id);
