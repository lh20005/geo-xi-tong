-- ==========================================
-- 权限系统数据库迁移脚本
-- 版本: 002
-- 创建时间: 2024-12-24
-- 描述: 创建权限定义和用户权限关联表
-- ==========================================

-- 1. 权限定义表 (permissions)
-- 定义系统中所有可用的权限
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  category VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 权限表索引
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);
CREATE INDEX IF NOT EXISTS idx_permissions_name ON permissions(name);

COMMENT ON TABLE permissions IS '权限定义表 - 定义系统中所有可用的权限';
COMMENT ON COLUMN permissions.name IS '权限名称 (如: view_users, edit_users, delete_users)';
COMMENT ON COLUMN permissions.category IS '权限分类 (如: user_management, config_management, log_management)';

-- 2. 用户权限关联表 (user_permissions)
-- 记录用户拥有的权限
CREATE TABLE IF NOT EXISTS user_permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, permission_id)
);

-- 用户权限索引
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_id ON user_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_granted_by ON user_permissions(granted_by);

COMMENT ON TABLE user_permissions IS '用户权限关联表 - 记录用户拥有的权限';
COMMENT ON COLUMN user_permissions.granted_by IS '授予权限的管理员ID';

-- 3. 插入初始权限数据
-- 用户管理权限
INSERT INTO permissions (name, description, category) VALUES
  ('view_users', '查看用户列表和详情', 'user_management'),
  ('create_users', '创建新用户', 'user_management'),
  ('edit_users', '编辑用户信息', 'user_management'),
  ('delete_users', '删除用户', 'user_management'),
  ('reset_passwords', '重置用户密码', 'user_management'),
  ('manage_permissions', '管理用户权限', 'user_management')
ON CONFLICT (name) DO NOTHING;

-- 配置管理权限
INSERT INTO permissions (name, description, category) VALUES
  ('view_config', '查看系统配置', 'config_management'),
  ('edit_config', '修改系统配置', 'config_management'),
  ('view_config_history', '查看配置历史', 'config_management'),
  ('rollback_config', '回滚配置', 'config_management')
ON CONFLICT (name) DO NOTHING;

-- 日志管理权限
INSERT INTO permissions (name, description, category) VALUES
  ('view_audit_logs', '查看审计日志', 'log_management'),
  ('export_audit_logs', '导出审计日志', 'log_management'),
  ('view_security_logs', '查看安全日志', 'log_management'),
  ('export_security_logs', '导出安全日志', 'log_management')
ON CONFLICT (name) DO NOTHING;

-- 安全管理权限
INSERT INTO permissions (name, description, category) VALUES
  ('manage_ip_whitelist', '管理IP白名单', 'security_management'),
  ('view_security_events', '查看安全事件', 'security_management'),
  ('manage_rate_limits', '管理频率限制', 'security_management'),
  ('view_sessions', '查看用户会话', 'security_management'),
  ('revoke_sessions', '撤销用户会话', 'security_management')
ON CONFLICT (name) DO NOTHING;

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '✅ 权限系统表创建完成';
  RAISE NOTICE '    - permissions: 权限定义表 (已插入20个初始权限)';
  RAISE NOTICE '    - user_permissions: 用户权限关联表';
END $$;
