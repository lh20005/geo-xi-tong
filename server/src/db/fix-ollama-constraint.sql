-- 修复Ollama约束脚本
-- 如果之前已经运行过迁移但遇到约束问题，运行此脚本

-- 1. 删除旧的约束（如果存在）
ALTER TABLE api_configs 
  DROP CONSTRAINT IF EXISTS check_ollama_config;

-- 2. 添加新的正确约束
ALTER TABLE api_configs
  ADD CONSTRAINT check_ollama_config
    CHECK (
      (provider = 'ollama' AND ollama_base_url IS NOT NULL AND ollama_model IS NOT NULL AND api_key IS NULL)
      OR
      (provider IN ('deepseek', 'gemini') AND api_key IS NOT NULL AND ollama_base_url IS NULL AND ollama_model IS NULL)
    );

-- 3. 清理可能存在的不一致数据
-- 对于ollama配置，确保api_key为NULL
UPDATE api_configs 
SET api_key = NULL 
WHERE provider = 'ollama' AND api_key IS NOT NULL;

-- 对于云端API配置，确保ollama字段为NULL
UPDATE api_configs 
SET ollama_base_url = NULL, ollama_model = NULL 
WHERE provider IN ('deepseek', 'gemini') AND (ollama_base_url IS NOT NULL OR ollama_model IS NOT NULL);
