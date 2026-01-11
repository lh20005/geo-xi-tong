-- ==================== UP ====================
-- 同步服务器数据库结构
-- 添加本地有但服务器缺失的表和列
-- 日期：2026-01-11

-- ========================================
-- 1. 添加缺失的表
-- ========================================

-- auth_logs 表（认证日志）
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
CREATE INDEX IF NOT EXISTS idx_auth_logs_created_at ON auth_logs(created_at DESC);

-- encryption_keys 表（加密密钥）
CREATE TABLE IF NOT EXISTS encryption_keys (
  id SERIAL PRIMARY KEY,
  key_name VARCHAR(100) NOT NULL UNIQUE,
  key_value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- publish_records 表（旧发布记录表，兼容）
CREATE TABLE IF NOT EXISTS publish_records (
  id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL,
  platform_account_id INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  platform_article_id VARCHAR(255),
  platform_url VARCHAR(500),
  error_message TEXT,
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- quota_audit_logs 表（配额审计日志）
CREATE TABLE IF NOT EXISTS quota_audit_logs (
  id SERIAL PRIMARY KEY,
  operation_type VARCHAR(50) NOT NULL,
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

-- quota_configs 表（配额配置）
CREATE TABLE IF NOT EXISTS quota_configs (
  id SERIAL PRIMARY KEY,
  feature_code VARCHAR(50) NOT NULL UNIQUE,
  quota_type VARCHAR(20) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  reversible BOOLEAN DEFAULT false,
  check_on_operation BOOLEAN DEFAULT true,
  record_on_success BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- system_api_configs 表（系统API配置）
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
CREATE INDEX IF NOT EXISTS idx_system_api_configs_active ON system_api_configs(is_active);

-- user_sessions 表（用户会话）
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

-- verification_codes 表（验证码）
CREATE TABLE IF NOT EXISTS verification_codes (
  id SERIAL PRIMARY KEY,
  target VARCHAR(255) NOT NULL,
  code VARCHAR(10) NOT NULL,
  type VARCHAR(50) NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT false,
  attempts INTEGER DEFAULT 0,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_verification_codes_target ON verification_codes(target);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires ON verification_codes(expires_at);

-- ========================================
-- 2. 添加缺失的列
-- ========================================

-- api_configs 表添加 user_id
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_configs' AND column_name = 'user_id') THEN
    ALTER TABLE api_configs ADD COLUMN user_id INTEGER DEFAULT 1;
  END IF;
END $$;

-- config_history 表添加 ip_address
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'config_history' AND column_name = 'ip_address') THEN
    ALTER TABLE config_history ADD COLUMN ip_address VARCHAR(45);
  END IF;
END $$;

-- distillation_config 表添加 user_id
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'distillation_config' AND column_name = 'user_id') THEN
    ALTER TABLE distillation_config ADD COLUMN user_id INTEGER;
  END IF;
END $$;

-- distillation_usage 表添加 task_id
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'distillation_usage' AND column_name = 'task_id') THEN
    ALTER TABLE distillation_usage ADD COLUMN task_id INTEGER;
  END IF;
END $$;

-- ip_whitelist 表添加 added_by（替代 created_by）
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ip_whitelist' AND column_name = 'added_by') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ip_whitelist' AND column_name = 'created_by') THEN
      ALTER TABLE ip_whitelist RENAME COLUMN created_by TO added_by;
    ELSE
      ALTER TABLE ip_whitelist ADD COLUMN added_by INTEGER;
    END IF;
  END IF;
END $$;

-- login_attempts 表：确保有 created_at 列（替代 attempted_at）
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'login_attempts' AND column_name = 'created_at') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'login_attempts' AND column_name = 'attempted_at') THEN
      ALTER TABLE login_attempts RENAME COLUMN attempted_at TO created_at;
    ELSE
      ALTER TABLE login_attempts ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
  END IF;
END $$;


-- orders 表添加缺失列
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'expired_at') THEN
    ALTER TABLE orders ADD COLUMN expired_at TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'paid_at') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_time') THEN
      ALTER TABLE orders RENAME COLUMN payment_time TO paid_at;
    ELSE
      ALTER TABLE orders ADD COLUMN paid_at TIMESTAMP;
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'transaction_id') THEN
    ALTER TABLE orders ADD COLUMN transaction_id VARCHAR(100);
  END IF;
END $$;

-- platform_accounts 表添加缺失列
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'platform_accounts' AND column_name = 'cookies') THEN
    ALTER TABLE platform_accounts ADD COLUMN cookies TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'platform_accounts' AND column_name = 'error_message') THEN
    ALTER TABLE platform_accounts ADD COLUMN error_message TEXT;
  END IF;
END $$;

-- platforms_config 表添加缺失列
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'platforms_config' AND column_name = 'home_url') THEN
    ALTER TABLE platforms_config ADD COLUMN home_url VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'platforms_config' AND column_name = 'login_url') THEN
    ALTER TABLE platforms_config ADD COLUMN login_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'platforms_config' AND column_name = 'selectors') THEN
    ALTER TABLE platforms_config ADD COLUMN selectors JSONB DEFAULT '{"username": [], "loginSuccess": []}'::jsonb;
  END IF;
END $$;

-- product_config_history 表添加缺失列
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_config_history' AND column_name = 'field_name') THEN
    ALTER TABLE product_config_history ADD COLUMN field_name VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_config_history' AND column_name = 'ip_address') THEN
    ALTER TABLE product_config_history ADD COLUMN ip_address VARCHAR(45);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_config_history' AND column_name = 'user_agent') THEN
    ALTER TABLE product_config_history ADD COLUMN user_agent TEXT;
  END IF;
END $$;

-- refresh_tokens 表添加 revoked 列
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refresh_tokens' AND column_name = 'revoked') THEN
    ALTER TABLE refresh_tokens ADD COLUMN revoked BOOLEAN DEFAULT false;
  END IF;
END $$;

-- security_config 表添加缺失列
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_config' AND column_name = 'config_type') THEN
    ALTER TABLE security_config ADD COLUMN config_type VARCHAR(50) DEFAULT 'string';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_config' AND column_name = 'created_by') THEN
    ALTER TABLE security_config ADD COLUMN created_by INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_config' AND column_name = 'is_active') THEN
    ALTER TABLE security_config ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_config' AND column_name = 'updated_by') THEN
    ALTER TABLE security_config ADD COLUMN updated_by INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_config' AND column_name = 'validation_rule') THEN
    ALTER TABLE security_config ADD COLUMN validation_rule TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_config' AND column_name = 'version') THEN
    ALTER TABLE security_config ADD COLUMN version INTEGER DEFAULT 1;
  END IF;
END $$;


-- security_config_history 表添加缺失列
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_config_history' AND column_name = 'change_reason') THEN
    ALTER TABLE security_config_history ADD COLUMN change_reason TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_config_history' AND column_name = 'config_key') THEN
    ALTER TABLE security_config_history ADD COLUMN config_key VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_config_history' AND column_name = 'version') THEN
    ALTER TABLE security_config_history ADD COLUMN version INTEGER DEFAULT 1;
  END IF;
END $$;

-- security_events 表添加 message 列（替代 description）
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_events' AND column_name = 'message') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'security_events' AND column_name = 'description') THEN
      ALTER TABLE security_events RENAME COLUMN description TO message;
    ELSE
      ALTER TABLE security_events ADD COLUMN message TEXT;
    END IF;
  END IF;
END $$;

-- topic_usage 表添加缺失列
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topic_usage' AND column_name = 'distillation_id') THEN
    ALTER TABLE topic_usage ADD COLUMN distillation_id INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'topic_usage' AND column_name = 'task_id') THEN
    ALTER TABLE topic_usage ADD COLUMN task_id INTEGER;
  END IF;
END $$;

-- user_subscriptions 表添加 next_plan_id 列
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_subscriptions' AND column_name = 'next_plan_id') THEN
    ALTER TABLE user_subscriptions ADD COLUMN next_plan_id INTEGER REFERENCES subscription_plans(id);
  END IF;
END $$;

-- users 表添加缺失列
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_active') THEN
    ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'name') THEN
    ALTER TABLE users ADD COLUMN name VARCHAR(100);
  END IF;
END $$;

-- ========================================
-- 3. 处理服务器有但本地没有的列（添加到本地以保持兼容）
-- ========================================

-- publishing_records 表添加服务器有的列
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'publishing_records' AND column_name = 'status') THEN
    ALTER TABLE publishing_records ADD COLUMN status VARCHAR(20) DEFAULT 'pending';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'publishing_records' AND column_name = 'publishing_status') THEN
    ALTER TABLE publishing_records ADD COLUMN publishing_status VARCHAR(20) DEFAULT 'draft';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'publishing_records' AND column_name = 'error_message') THEN
    ALTER TABLE publishing_records ADD COLUMN error_message TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'publishing_records' AND column_name = 'updated_at') THEN
    ALTER TABLE publishing_records ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- plan_features 表添加服务器有的列
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plan_features' AND column_name = 'quota_value') THEN
    ALTER TABLE plan_features ADD COLUMN quota_value INTEGER;
    -- 从 feature_value 复制数据
    UPDATE plan_features SET quota_value = feature_value WHERE quota_value IS NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plan_features' AND column_name = 'quota_unit') THEN
    ALTER TABLE plan_features ADD COLUMN quota_unit VARCHAR(20);
    -- 从 feature_unit 复制数据
    UPDATE plan_features SET quota_unit = feature_unit WHERE quota_unit IS NULL;
  END IF;
END $$;

-- ==================== DOWN ====================
-- DROP TABLE IF EXISTS auth_logs CASCADE;
-- DROP TABLE IF EXISTS encryption_keys CASCADE;
-- DROP TABLE IF EXISTS publish_records CASCADE;
-- DROP TABLE IF EXISTS quota_audit_logs CASCADE;
-- DROP TABLE IF EXISTS quota_configs CASCADE;
-- DROP TABLE IF EXISTS system_api_configs CASCADE;
-- DROP TABLE IF EXISTS user_sessions CASCADE;
-- DROP TABLE IF EXISTS verification_codes CASCADE;
