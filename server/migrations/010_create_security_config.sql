-- 创建安全配置表
-- Requirement 18.1: 存储所有安全配置

CREATE TABLE IF NOT EXISTS security_config (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(100) NOT NULL UNIQUE,
  config_value TEXT NOT NULL,
  config_type VARCHAR(50) NOT NULL, -- 'string', 'number', 'boolean', 'json'
  description TEXT,
  validation_rule TEXT, -- JSON格式的验证规则
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建安全配置历史表
-- Requirement 18.3: 维护配置变更历史
CREATE TABLE IF NOT EXISTS security_config_history (
  id SERIAL PRIMARY KEY,
  config_id INTEGER REFERENCES security_config(id) ON DELETE CASCADE,
  config_key VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  version INTEGER NOT NULL,
  changed_by INTEGER REFERENCES users(id),
  change_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_security_config_key ON security_config(config_key);
CREATE INDEX IF NOT EXISTS idx_security_config_active ON security_config(is_active);
CREATE INDEX IF NOT EXISTS idx_security_config_history_config_id ON security_config_history(config_id);
CREATE INDEX IF NOT EXISTS idx_security_config_history_created_at ON security_config_history(created_at);

-- 插入默认安全配置
INSERT INTO security_config (config_key, config_value, config_type, description, validation_rule, created_by, updated_by) VALUES
  ('rate_limit.login.max_requests', '5', 'number', '登录频率限制：最大请求次数', '{"min": 1, "max": 100}', 1, 1),
  ('rate_limit.login.window_ms', '900000', 'number', '登录频率限制：时间窗口（毫秒）', '{"min": 60000, "max": 3600000}', 1, 1),
  ('rate_limit.api.max_requests', '100', 'number', 'API频率限制：最大请求次数', '{"min": 10, "max": 1000}', 1, 1),
  ('rate_limit.api.window_ms', '3600000', 'number', 'API频率限制：时间窗口（毫秒）', '{"min": 60000, "max": 3600000}', 1, 1),
  ('session.timeout_ms', '86400000', 'number', '会话超时时间（毫秒）', '{"min": 300000, "max": 604800000}', 1, 1),
  ('session.max_concurrent', '5', 'number', '最大并发会话数', '{"min": 1, "max": 20}', 1, 1),
  ('password.min_length', '8', 'number', '密码最小长度', '{"min": 6, "max": 128}', 1, 1),
  ('password.require_uppercase', 'true', 'boolean', '密码需要大写字母', '{}', 1, 1),
  ('password.require_lowercase', 'true', 'boolean', '密码需要小写字母', '{}', 1, 1),
  ('password.require_number', 'true', 'boolean', '密码需要数字', '{}', 1, 1),
  ('password.require_special', 'true', 'boolean', '密码需要特殊字符', '{}', 1, 1),
  ('password.history_count', '5', 'number', '密码历史记录数量', '{"min": 0, "max": 20}', 1, 1),
  ('account.lockout_threshold', '5', 'number', '账户锁定阈值', '{"min": 3, "max": 10}', 1, 1),
  ('account.lockout_duration_ms', '900000', 'number', '账户锁定时长（毫秒）', '{"min": 300000, "max": 3600000}', 1, 1),
  ('temp_password.expiry_days', '7', 'number', '临时密码过期天数', '{"min": 1, "max": 30}', 1, 1)
ON CONFLICT (config_key) DO NOTHING;

-- 添加触发器：自动更新updated_at
CREATE OR REPLACE FUNCTION update_security_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER security_config_updated_at
  BEFORE UPDATE ON security_config
  FOR EACH ROW
  EXECUTE FUNCTION update_security_config_updated_at();
