-- 修复articles表的distillation_id外键约束
-- 添加ON DELETE SET NULL，允许删除被文章引用的distillation记录

-- 1. 删除旧的外键约束（如果存在）
DO $$ 
BEGIN
  -- 查找并删除articles表中distillation_id的外键约束
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name LIKE '%articles%distillation%' 
    AND table_name = 'articles'
    AND constraint_type = 'FOREIGN KEY'
  ) THEN
    -- 获取约束名称并删除
    EXECUTE (
      SELECT 'ALTER TABLE articles DROP CONSTRAINT ' || constraint_name || ';'
      FROM information_schema.table_constraints
      WHERE constraint_name LIKE '%articles%distillation%'
      AND table_name = 'articles'
      AND constraint_type = 'FOREIGN KEY'
      LIMIT 1
    );
  END IF;
END $$;

-- 2. 添加新的外键约束，带ON DELETE SET NULL
ALTER TABLE articles 
ADD CONSTRAINT articles_distillation_id_fkey 
FOREIGN KEY (distillation_id) 
REFERENCES distillations(id) 
ON DELETE SET NULL;

-- 3. 添加注释说明
COMMENT ON CONSTRAINT articles_distillation_id_fkey ON articles IS 
'删除distillation记录时，将文章的distillation_id设为NULL，保留文章数据';
