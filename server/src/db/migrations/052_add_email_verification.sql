-- ============================================
-- 迁移: 052_add_email_verification
-- 描述: 添加邮箱验证和密码找回功能
-- ============================================

-- ==================== UP ====================

-- 1. 用户表添加邮箱相关字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- 创建邮箱唯一索引（允许NULL，但非NULL值必须唯一）
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique 
ON users(email) WHERE email IS NOT NULL;

-- 2. 创建验证码表
CREATE TABLE IF NOT EXISTS verification_codes (
  id SERIAL PRIMARY KEY,
  target VARCHAR(255) NOT NULL,           -- 邮箱或手机号
  code VARCHAR(6) NOT NULL,               -- 6位验证码
  type VARCHAR(30) NOT NULL,              -- reset_password, verify_email, login
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,  -- 关联用户（可选）
  expires_at TIMESTAMP NOT NULL,          -- 过期时间
  used BOOLEAN DEFAULT FALSE,             -- 是否已使用
  attempts INTEGER DEFAULT 0,             -- 验证尝试次数
  ip_address VARCHAR(45),                 -- 请求IP
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_verification_codes_target ON verification_codes(target);
CREATE INDEX IF NOT EXISTS idx_verification_codes_type ON verification_codes(type);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires_at ON verification_codes(expires_at);

-- 3. 清理过期验证码的函数
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM verification_codes 
  WHERE expires_at < CURRENT_TIMESTAMP OR used = TRUE;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ==================== DOWN ====================

-- 删除函数
DROP FUNCTION IF EXISTS cleanup_expired_verification_codes();

-- 删除验证码表
DROP TABLE IF EXISTS verification_codes;

-- 删除索引
DROP INDEX IF EXISTS idx_users_email_unique;

-- 删除用户表的邮箱字段
ALTER TABLE users DROP COLUMN IF EXISTS email_verified;
ALTER TABLE users DROP COLUMN IF EXISTS email;
