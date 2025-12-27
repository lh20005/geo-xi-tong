-- 添加真实用户名字段到平台账号表

ALTER TABLE platform_accounts 
ADD COLUMN IF NOT EXISTS real_username VARCHAR(255);

-- 创建索引以便快速查询
CREATE INDEX IF NOT EXISTS idx_platform_accounts_real_username ON platform_accounts(real_username);
