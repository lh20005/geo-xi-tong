-- 转化目标表迁移脚本
-- 创建时间: 2024-12-11

-- 创建转化目标表
CREATE TABLE IF NOT EXISTS conversion_targets (
  id SERIAL PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  industry VARCHAR(100) NOT NULL,
  company_size VARCHAR(50) NOT NULL,
  features TEXT,
  contact_info VARCHAR(255) NOT NULL,
  website VARCHAR(500),
  target_audience TEXT,
  core_products TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_company_name UNIQUE (company_name)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_conversion_targets_company_name ON conversion_targets(company_name);
CREATE INDEX IF NOT EXISTS idx_conversion_targets_industry ON conversion_targets(industry);
CREATE INDEX IF NOT EXISTS idx_conversion_targets_created_at ON conversion_targets(created_at DESC);

-- 插入测试数据（可选）
-- INSERT INTO conversion_targets (company_name, industry, company_size, features, contact_info, website, target_audience, core_products)
-- VALUES 
--   ('示例科技公司', '互联网', '51-200人', '专注于AI技术研发', 'contact@example.com', 'https://example.com', '企业客户', 'AI解决方案'),
--   ('创新教育集团', '教育', '201-500人', '在线教育平台', '13800138000', 'https://edu-example.com', '学生和家长', '在线课程、教育咨询');
