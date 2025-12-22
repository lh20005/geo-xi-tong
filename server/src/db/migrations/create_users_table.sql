-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(100),
  role VARCHAR(20) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP
);

-- 创建索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 创建默认管理员账号
-- 密码: admin123 (bcrypt hash)
INSERT INTO users (username, password_hash, role) 
VALUES ('admin', '$2b$10$YQ98PkKWGYZuzKFqz5FLOeH8W8X8X8X8X8X8X8X8X8X8X8X8X8X8X', 'admin')
ON CONFLICT (username) DO NOTHING;

-- 注意：上面的密码hash是示例，实际会在代码中生成
