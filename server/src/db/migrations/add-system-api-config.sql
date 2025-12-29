-- ==========================================
-- 系统级API配置管理
-- ==========================================

-- 1. 创建系统级API配置表
CREATE TABLE IF NOT EXISTS system_api_configs (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,           -- 'deepseek', 'gemini', 'ollama'
  api_key_encrypted TEXT,                  -- 加密后的API密钥
  ollama_base_url VARCHAR(255),
  ollama_model VARCHAR(100),
  is_active BOOLEAN DEFAULT false,
  priority INTEGER DEFAULT 0,              -- 优先级，数字越大优先级越高
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  notes TEXT                               -- 备注信息（如：密钥有效期、用途等）
);

-- 确保只有一个激活的配置（每个provider）
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_system_config 
ON system_api_configs (provider, is_active) 
WHERE is_active = true;

-- 2. 创建租户级API配置表（可选功能，用于高级租户）
CREATE TABLE IF NOT EXISTS tenant_api_configs (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  api_key_encrypted TEXT,
  ollama_base_url VARCHAR(255),
  ollama_model VARCHAR(100),
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 确保每个租户每个provider只有一个激活的配置
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_tenant_config 
ON tenant_api_configs (tenant_id, provider, is_active) 
WHERE is_active = true;

-- 3. 创建API使用记录表
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  operation_type VARCHAR(50) NOT NULL,     -- 'distillation', 'article_generation', 'article_formatting'
  tokens_used INTEGER,
  cost_estimate DECIMAL(10, 6),
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  request_duration_ms INTEGER,             -- 请求耗时（毫秒）
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_api_usage_tenant ON api_usage_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_user ON api_usage_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_provider ON api_usage_logs (provider, created_at DESC);

-- 4. 创建API配额配置表
CREATE TABLE IF NOT EXISTS api_quota_configs (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  monthly_limit INTEGER NOT NULL DEFAULT 1000,  -- 每月API调用次数限制
  daily_limit INTEGER NOT NULL DEFAULT 100,     -- 每日API调用次数限制
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id)
);

-- 5. 迁移现有的api_configs数据到system_api_configs
-- 注意：这里不加密，因为原始数据也是明文存储的
-- 加密功能将在应用层实现
INSERT INTO system_api_configs (provider, api_key_encrypted, ollama_base_url, ollama_model, is_active, created_at)
SELECT 
  provider,
  api_key as api_key_encrypted,  -- 暂时直接复制，后续通过应用层加密
  ollama_base_url,
  ollama_model,
  is_active,
  created_at
FROM api_configs
WHERE NOT EXISTS (
  SELECT 1 FROM system_api_configs WHERE provider = api_configs.provider
);

-- 6. 为所有现有租户创建默认配额
INSERT INTO api_quota_configs (tenant_id, monthly_limit, daily_limit)
SELECT 
  id as tenant_id,
  1000 as monthly_limit,
  100 as daily_limit
FROM tenants
WHERE NOT EXISTS (
  SELECT 1 FROM api_quota_configs WHERE tenant_id = tenants.id
);

-- 7. 添加注释
COMMENT ON TABLE system_api_configs IS '系统级API配置，所有租户共享';
COMMENT ON TABLE tenant_api_configs IS '租户级API配置，允许高级租户使用自己的密钥';
COMMENT ON TABLE api_usage_logs IS 'API使用记录，用于监控和计费';
COMMENT ON TABLE api_quota_configs IS 'API配额配置，控制租户使用量';

COMMENT ON COLUMN system_api_configs.api_key_encrypted IS 'AES-256加密后的API密钥';
COMMENT ON COLUMN system_api_configs.priority IS '优先级，用于多密钥负载均衡';
COMMENT ON COLUMN api_usage_logs.cost_estimate IS '成本估算（美元）';
COMMENT ON COLUMN api_quota_configs.monthly_limit IS '每月API调用次数限制，0表示无限制';
COMMENT ON COLUMN api_quota_configs.daily_limit IS '每日API调用次数限制，0表示无限制';
