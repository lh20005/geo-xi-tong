-- 添加IP白名单系统
-- 日期: 2024-12-24
-- 描述: 创建 ip_whitelist 表用于管理允许访问管理后台的IP地址

-- 1. 创建 ip_whitelist 表
CREATE TABLE IF NOT EXISTS ip_whitelist (
  id SERIAL PRIMARY KEY,
  ip_address VARCHAR(45) NOT NULL UNIQUE,
  description TEXT,
  added_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_ip_whitelist_ip_address ON ip_whitelist(ip_address);
CREATE INDEX IF NOT EXISTS idx_ip_whitelist_added_by ON ip_whitelist(added_by);
CREATE INDEX IF NOT EXISTS idx_ip_whitelist_created_at ON ip_whitelist(created_at DESC);

-- 3. 添加注释
COMMENT ON TABLE ip_whitelist IS 'IP白名单表，用于限制管理后台访问';
COMMENT ON COLUMN ip_whitelist.ip_address IS 'IP地址（支持IPv4和IPv6，以及CIDR格式）';
COMMENT ON COLUMN ip_whitelist.description IS 'IP地址描述（如：办公室、VPN等）';
COMMENT ON COLUMN ip_whitelist.added_by IS '添加该IP的管理员用户ID';
COMMENT ON COLUMN ip_whitelist.created_at IS '添加时间';
