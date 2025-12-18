-- 简化转化目标表结构
-- 保留字段：company_name, industry, website
-- 新增字段：address
-- 删除字段：company_size, features, contact_info, target_audience, core_products

-- 1. 添加address字段
ALTER TABLE conversion_targets 
ADD COLUMN IF NOT EXISTS address VARCHAR(500);

-- 2. 删除不需要的字段
ALTER TABLE conversion_targets 
DROP COLUMN IF EXISTS company_size,
DROP COLUMN IF EXISTS features,
DROP COLUMN IF EXISTS contact_info,
DROP COLUMN IF EXISTS target_audience,
DROP COLUMN IF EXISTS core_products;

-- 3. 修改company_name为NOT NULL（如果还不是）
ALTER TABLE conversion_targets 
ALTER COLUMN company_name SET NOT NULL;

-- 4. 修改industry和website为可选（允许NULL）
ALTER TABLE conversion_targets 
ALTER COLUMN industry DROP NOT NULL;

-- 5. 添加注释
COMMENT ON COLUMN conversion_targets.company_name IS '公司名称（必填）';
COMMENT ON COLUMN conversion_targets.industry IS '行业类型（可选）';
COMMENT ON COLUMN conversion_targets.website IS '官方网站（可选）';
COMMENT ON COLUMN conversion_targets.address IS '公司地址（可选）';

-- 6. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_conversion_targets_company_name 
ON conversion_targets(company_name);
