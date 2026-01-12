-- ==================== UP ====================
-- 迁移 053: 添加缺失的表
-- 创建时间: 2026-01-11
-- 描述: 添加在本地数据库中存在但迁移文件中缺失的表

-- ============================================
-- 1. 认证日志表 (auth_logs)
-- ============================================
CREATE TABLE IF NOT EXISTS auth_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_logs_user_id ON auth_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_logs_action ON auth_logs(action);
CREATE INDEX IF NOT EXISTS idx_auth_logs_created_at ON auth_logs(created_at DESC);

COMMENT ON TABLE auth_logs IS '认证日志表 - 记录用户登录、登出等认证操作';

-- ============================================
-- 2. 加密密钥表 (encryption_keys)
-- ============================================
CREATE TABLE IF NOT EXISTS encryption_keys (
  id SERIAL PRIMARY KEY,
  key_name VARCHAR(50) NOT NULL UNIQUE,
  key_value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE encryption_keys IS '加密密钥表 - 存储系统加密密钥';

-- ============================================
-- 3. 配额配置表 (quota_configs)
-- ============================================
CREATE TABLE IF NOT EXISTS quota_configs (
  id SERIAL PRIMARY KEY,
  feature_code VARCHAR(50) NOT NULL UNIQUE,
  quota_type VARCHAR(20) NOT NULL,
  unit VARCHAR(10) NOT NULL,
  reversible BOOLEAN DEFAULT false,
  check_on_operation BOOLEAN DEFAULT true,
  record_on_success BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quota_configs_feature_code ON quota_configs(feature_code);

COMMENT ON TABLE quota_configs IS '配额配置表 - 定义各功能的配额规则';

-- ============================================
-- 4. 配额审计日志表 (quota_audit_logs)
-- ============================================
CREATE TABLE IF NOT EXISTS quota_audit_logs (
  id SERIAL PRIMARY KEY,
  operation_type VARCHAR(20) NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  feature_code VARCHAR(50),
  before_value INTEGER,
  after_value INTEGER,
  status VARCHAR(20) NOT NULL,
  details JSONB,
  performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quota_audit_logs_user_id ON quota_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_quota_audit_logs_feature_code ON quota_audit_logs(feature_code);
CREATE INDEX IF NOT EXISTS idx_quota_audit_logs_created_at ON quota_audit_logs(created_at DESC);

COMMENT ON TABLE quota_audit_logs IS '配额审计日志表 - 记录配额变更操作';

-- ============================================
-- 5. 用户会话表 (user_sessions)
-- ============================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_id INTEGER REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_token_id ON user_sessions(refresh_token_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON user_sessions(last_activity DESC);

COMMENT ON TABLE user_sessions IS '用户会话表 - 跟踪用户活跃会话';

-- ============================================
-- 6. 系统API配置表 (system_api_configs)
-- ============================================
CREATE TABLE IF NOT EXISTS system_api_configs (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,
  api_key_encrypted TEXT,
  ollama_base_url VARCHAR(255),
  ollama_model VARCHAR(100),
  is_active BOOLEAN DEFAULT false,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_system_api_configs_provider ON system_api_configs(provider);
CREATE INDEX IF NOT EXISTS idx_system_api_configs_is_active ON system_api_configs(is_active);

COMMENT ON TABLE system_api_configs IS '系统API配置表 - 管理员配置的全局API密钥';

-- ============================================
-- 7. 发布记录表 (publish_records) - 旧版兼容
-- ============================================
CREATE TABLE IF NOT EXISTS publish_records (
  id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  platform_account_id INTEGER NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending',
  platform_article_id VARCHAR(100),
  platform_url VARCHAR(500),
  error_message TEXT,
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_publish_records_article_id ON publish_records(article_id);
CREATE INDEX IF NOT EXISTS idx_publish_records_platform_account_id ON publish_records(platform_account_id);
CREATE INDEX IF NOT EXISTS idx_publish_records_status ON publish_records(status);

COMMENT ON TABLE publish_records IS '发布记录表（旧版兼容）';

-- ============================================
-- 8. 迁移记录表 (schema_migrations)
-- ============================================
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(10) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE schema_migrations IS '数据库迁移记录表';

-- ==================== DOWN ====================
-- 回滚：删除添加的表

DROP TABLE IF EXISTS schema_migrations;
DROP TABLE IF EXISTS publish_records;
DROP TABLE IF EXISTS system_api_configs;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS quota_audit_logs;
DROP TABLE IF EXISTS quota_configs;
DROP TABLE IF EXISTS encryption_keys;
DROP TABLE IF EXISTS auth_logs;
