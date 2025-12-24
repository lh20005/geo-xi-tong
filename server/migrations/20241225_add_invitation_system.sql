-- 添加邀请码系统到用户表
-- 日期: 2024-12-25
-- 描述: 添加 invitation_code, invited_by_code, is_temp_password 字段，创建相关索引和约束

-- 1. 添加邀请码字段
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS invitation_code VARCHAR(6) UNIQUE,
ADD COLUMN IF NOT EXISTS invited_by_code VARCHAR(6),
ADD COLUMN IF NOT EXISTS is_temp_password BOOLEAN DEFAULT FALSE;

-- 2. 为现有用户生成唯一的邀请码
-- 注意：这个函数会在下面的更新语句中使用
CREATE OR REPLACE FUNCTION generate_invitation_code() RETURNS VARCHAR(6) AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result VARCHAR(6) := '';
  i INTEGER;
  code_exists BOOLEAN;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    
    -- 检查代码是否已存在
    SELECT EXISTS(SELECT 1 FROM users WHERE invitation_code = result) INTO code_exists;
    
    IF NOT code_exists THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 3. 为所有现有用户生成邀请码
UPDATE users 
SET invitation_code = generate_invitation_code() 
WHERE invitation_code IS NULL;

-- 4. 将 invitation_code 设置为 NOT NULL（现在所有用户都有邀请码了）
ALTER TABLE users 
ALTER COLUMN invitation_code SET NOT NULL;

-- 5. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_users_invitation_code ON users(invitation_code);
CREATE INDEX IF NOT EXISTS idx_users_invited_by_code ON users(invited_by_code);

-- 6. 添加外键约束（invited_by_code 引用 invitation_code）
ALTER TABLE users 
ADD CONSTRAINT fk_invited_by 
FOREIGN KEY (invited_by_code) 
REFERENCES users(invitation_code) 
ON DELETE SET NULL;

-- 7. 创建 refresh_tokens 表用于会话管理
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

-- 8. 创建 login_attempts 表用于速率限制
CREATE TABLE IF NOT EXISTS login_attempts (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  success BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts(username);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at ON login_attempts(attempted_at);

-- 9. 添加注释
COMMENT ON COLUMN users.invitation_code IS '用户的唯一邀请码（6位小写字母和数字）';
COMMENT ON COLUMN users.invited_by_code IS '邀请该用户的邀请码（可选）';
COMMENT ON COLUMN users.is_temp_password IS '是否为临时密码（管理员重置后需要用户修改）';
COMMENT ON TABLE refresh_tokens IS '刷新令牌表，用于JWT会话管理';
COMMENT ON TABLE login_attempts IS '登录尝试记录表，用于速率限制';

-- 10. 清理函数（可选，如果不再需要）
-- DROP FUNCTION IF EXISTS generate_invitation_code();

