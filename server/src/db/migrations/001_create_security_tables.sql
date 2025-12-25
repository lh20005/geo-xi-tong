-- ==========================================
-- 安全基础设施数据库迁移脚本
-- 版本: 001
-- 创建时间: 2024-12-24
-- 描述: 创建审计日志、安全事件、配置历史等安全相关表
-- ==========================================

-- 1. 审计日志表 (audit_logs)
-- 用于记录所有管理员的敏感操作
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id INTEGER,
  details JSONB,
  ip_address VARCHAR(45) NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 审计日志索引
CREATE INDEX IF NOT EXISTS idx_audit_admin_id ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs(target_type, target_id);

COMMENT ON TABLE audit_logs IS '审计日志表 - 记录所有管理员敏感操作';
COMMENT ON COLUMN audit_logs.admin_id IS '执行操作的管理员ID';
COMMENT ON COLUMN audit_logs.action IS '操作类型 (如: CREATE_USER, DELETE_USER, UPDATE_CONFIG)';
COMMENT ON COLUMN audit_logs.target_type IS '目标资源类型 (如: user, config, system)';
COMMENT ON COLUMN audit_logs.target_id IS '目标资源ID';
COMMENT ON COLUMN audit_logs.details IS '操作详细信息 (JSON格式)';
COMMENT ON COLUMN audit_logs.ip_address IS '操作者IP地址';
COMMENT ON COLUMN audit_logs.user_agent IS '操作者浏览器信息';

-- 2. 安全事件表 (security_events)
-- 用于记录安全相关事件和异常行为
CREATE TABLE IF NOT EXISTS security_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ip_address VARCHAR(45),
  message TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 安全事件索引
CREATE INDEX IF NOT EXISTS idx_security_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_created_at ON security_events(created_at);

COMMENT ON TABLE security_events IS '安全事件表 - 记录安全相关事件';
COMMENT ON COLUMN security_events.event_type IS '事件类型 (如: suspicious_login, high_frequency, brute_force)';
COMMENT ON COLUMN security_events.severity IS '严重程度 (info, warning, critical)';
COMMENT ON COLUMN security_events.message IS '事件描述';

-- 3. 配置历史表 (config_history)
-- 用于记录配置变更历史,支持回滚
CREATE TABLE IF NOT EXISTS config_history (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_address VARCHAR(45) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 配置历史索引
CREATE INDEX IF NOT EXISTS idx_config_key ON config_history(config_key);
CREATE INDEX IF NOT EXISTS idx_config_changed_by ON config_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_config_created_at ON config_history(created_at);

COMMENT ON TABLE config_history IS '配置历史表 - 记录配置变更,支持回滚';
COMMENT ON COLUMN config_history.config_key IS '配置键名';
COMMENT ON COLUMN config_history.old_value IS '旧值';
COMMENT ON COLUMN config_history.new_value IS '新值';
COMMENT ON COLUMN config_history.changed_by IS '修改者用户ID';

-- 4. 增强 refresh_tokens 表
-- 添加会话管理所需的字段
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='refresh_tokens' AND column_name='ip_address') THEN
    ALTER TABLE refresh_tokens ADD COLUMN ip_address VARCHAR(45);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='refresh_tokens' AND column_name='user_agent') THEN
    ALTER TABLE refresh_tokens ADD COLUMN user_agent TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='refresh_tokens' AND column_name='last_used_at') THEN
    ALTER TABLE refresh_tokens ADD COLUMN last_used_at TIMESTAMP;
  END IF;
END $$;

COMMENT ON COLUMN refresh_tokens.ip_address IS '令牌创建时的IP地址';
COMMENT ON COLUMN refresh_tokens.user_agent IS '令牌创建时的浏览器信息';
COMMENT ON COLUMN refresh_tokens.last_used_at IS '令牌最后使用时间';

-- 5. 密码历史表 (password_history)
-- 用于防止密码重用
CREATE TABLE IF NOT EXISTS password_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 密码历史索引
CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id);
CREATE INDEX IF NOT EXISTS idx_password_history_created_at ON password_history(created_at);

COMMENT ON TABLE password_history IS '密码历史表 - 防止密码重用';
COMMENT ON COLUMN password_history.user_id IS '用户ID';
COMMENT ON COLUMN password_history.password_hash IS '历史密码哈希';

-- 6. 登录尝试记录表 (login_attempts)
-- 用于账户锁定和异常检测
CREATE TABLE IF NOT EXISTS login_attempts (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  success BOOLEAN NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 登录尝试索引
CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts(username);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_composite ON login_attempts(username, ip_address, created_at);

COMMENT ON TABLE login_attempts IS '登录尝试记录表 - 用于账户锁定和异常检测';
COMMENT ON COLUMN login_attempts.success IS '登录是否成功';

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '✅ 安全基础设施表创建完成';
  RAISE NOTICE '   - audit_logs: 审计日志表';
  RAISE NOTICE '   - security_events: 安全事件表';
  RAISE NOTICE '   - config_history: 配置历史表';
  RAISE NOTICE '   - refresh_tokens: 增强会话管理';
  RAISE NOTICE '   - password_history: 密码历史表';
  RAISE NOTICE '   - login_attempts: 登录尝试记录表';
END $$;
