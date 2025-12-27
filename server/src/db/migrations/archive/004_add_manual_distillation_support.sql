-- 添加手动输入蒸馏结果支持
-- 允许provider字段接受'manual'值，表示手动输入的蒸馏结果

-- 1. 删除旧的CHECK约束（如果存在）
DO $ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'distillations' 
    AND constraint_name LIKE '%provider%check%'
  ) THEN
    ALTER TABLE distillations DROP CONSTRAINT IF EXISTS distillations_provider_check;
  END IF;
END $;

-- 2. 添加新的CHECK约束，允许'manual'值
ALTER TABLE distillations 
ADD CONSTRAINT distillations_provider_check 
CHECK (provider IN ('deepseek', 'gemini', 'ollama', 'manual'));

-- 3. 为provider字段创建索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_distillations_provider ON distillations(provider);

-- 4. 添加注释说明
COMMENT ON COLUMN distillations.provider IS 'AI提供商：deepseek, gemini, ollama, 或 manual（手动输入）';
