-- 迁移脚本：添加Ollama支持
-- 日期：2024-12-10

-- 1. 删除现有的provider约束
ALTER TABLE api_configs 
  DROP CONSTRAINT IF EXISTS api_configs_provider_check;

-- 2. 添加新的provider约束，包含ollama
ALTER TABLE api_configs 
  ADD CONSTRAINT api_configs_provider_check 
    CHECK (provider IN ('deepseek', 'gemini', 'ollama'));

-- 3. 将api_key字段改为可选（ollama不需要）
ALTER TABLE api_configs 
  ALTER COLUMN api_key DROP NOT NULL;

-- 4. 添加ollama相关字段
ALTER TABLE api_configs 
  ADD COLUMN IF NOT EXISTS ollama_base_url VARCHAR(255),
  ADD COLUMN IF NOT EXISTS ollama_model VARCHAR(100);

-- 5. 添加约束：确保配置完整性和互斥性
ALTER TABLE api_configs
  ADD CONSTRAINT check_ollama_config
    CHECK (
      (provider = 'ollama' AND ollama_base_url IS NOT NULL AND ollama_model IS NOT NULL AND api_key IS NULL)
      OR
      (provider IN ('deepseek', 'gemini') AND api_key IS NOT NULL AND ollama_base_url IS NULL AND ollama_model IS NULL)
    );

-- 6. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_api_configs_provider ON api_configs(provider);
CREATE INDEX IF NOT EXISTS idx_api_configs_active ON api_configs(is_active);
