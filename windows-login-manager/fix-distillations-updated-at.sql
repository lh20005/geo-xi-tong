-- 修复 Windows 端本地数据库 distillations 表
-- 添加 updated_at 字段

-- 检查并添加 updated_at 字段
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'distillations' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE distillations ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
        RAISE NOTICE 'updated_at 字段已添加';
    ELSE
        RAISE NOTICE 'updated_at 字段已存在';
    END IF;
END $$;

-- 为现有记录设置 updated_at 值
UPDATE distillations SET updated_at = created_at WHERE updated_at IS NULL;

-- 验证
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'distillations' 
ORDER BY ordinal_position;
