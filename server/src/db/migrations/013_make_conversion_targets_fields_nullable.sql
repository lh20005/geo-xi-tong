-- 迁移: 使 conversion_targets 表的某些字段可为空
-- 日期: 2025-12-27
-- 描述: 将 industry, company_size, contact_info 字段改为可选

-- 修改字段约束
ALTER TABLE conversion_targets 
  ALTER COLUMN industry DROP NOT NULL,
  ALTER COLUMN company_size DROP NOT NULL,
  ALTER COLUMN contact_info DROP NOT NULL;

-- 添加注释
COMMENT ON COLUMN conversion_targets.industry IS '行业（可选）';
COMMENT ON COLUMN conversion_targets.company_size IS '公司规模（可选）';
COMMENT ON COLUMN conversion_targets.contact_info IS '联系方式（可选）';
