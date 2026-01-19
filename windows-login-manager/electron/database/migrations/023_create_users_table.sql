-- 迁移文件: 023_create_users_table.sql
-- 创建本地用户表，用于存储从服务器同步的用户信息
-- 解决用户信息缓存不一致的问题
-- 
-- 注意：此迁移文件只包含 UP 部分，不包含 DOWN 部分
-- 因为 Windows 端迁移系统不支持回滚操作

-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,  -- 与服务器同步的 user_id
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100),
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    invitation_code VARCHAR(20),
    is_temp_password BOOLEAN DEFAULT FALSE,
    synced_at TIMESTAMP DEFAULT NOW(),  -- 最后同步时间
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 添加注释
COMMENT ON TABLE users IS '本地用户表（从服务器同步）';
COMMENT ON COLUMN users.id IS '用户 ID（与服务器同步）';
COMMENT ON COLUMN users.username IS '用户名';
COMMENT ON COLUMN users.email IS '邮箱';
COMMENT ON COLUMN users.role IS '角色（user/admin）';
COMMENT ON COLUMN users.invitation_code IS '邀请码';
COMMENT ON COLUMN users.is_temp_password IS '是否临时密码';
COMMENT ON COLUMN users.synced_at IS '最后同步时间';
COMMENT ON COLUMN users.created_at IS '创建时间';
COMMENT ON COLUMN users.updated_at IS '更新时间';
