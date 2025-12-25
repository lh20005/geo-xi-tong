-- 创建管理员操作日志表
CREATE TABLE IF NOT EXISTS admin_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- 操作类型：update_plan, rollback_config, handle_order, etc.
  resource_type VARCHAR(50) NOT NULL, -- 资源类型：plan, order, config, etc.
  resource_id VARCHAR(100), -- 资源ID
  details JSONB, -- 详细信息（变更前后的值等）
  ip_address VARCHAR(45), -- IP地址（支持IPv6）
  user_agent TEXT, -- 用户代理
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin_logs_admin_id (admin_id),
  INDEX idx_admin_logs_action_type (action_type),
  INDEX idx_admin_logs_resource (resource_type, resource_id),
  INDEX idx_admin_logs_created_at (created_at)
);

-- 添加注释
COMMENT ON TABLE admin_logs IS '管理员操作审计日志';
COMMENT ON COLUMN admin_logs.action_type IS '操作类型';
COMMENT ON COLUMN admin_logs.resource_type IS '资源类型';
COMMENT ON COLUMN admin_logs.resource_id IS '资源ID';
COMMENT ON COLUMN admin_logs.details IS '详细信息（JSON格式）';
COMMENT ON COLUMN admin_logs.ip_address IS 'IP地址';
COMMENT ON COLUMN admin_logs.user_agent IS '用户代理字符串';
