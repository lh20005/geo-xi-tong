-- ==================== UP ====================
-- 迁移 055: 添加 product_config_history 表缺失的列
-- 创建时间: 2026-01-12
-- 描述: 添加 field_name, ip_address, user_agent 列

-- ============================================
-- 1. 添加 field_name 列
-- ============================================
ALTER TABLE product_config_history 
ADD COLUMN IF NOT EXISTS field_name VARCHAR(100);

COMMENT ON COLUMN product_config_history.field_name IS '变更的字段名称';

-- ============================================
-- 2. 添加 ip_address 列
-- ============================================
ALTER TABLE product_config_history 
ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);

COMMENT ON COLUMN product_config_history.ip_address IS '操作者IP地址';

-- ============================================
-- 3. 添加 user_agent 列
-- ============================================
ALTER TABLE product_config_history 
ADD COLUMN IF NOT EXISTS user_agent TEXT;

COMMENT ON COLUMN product_config_history.user_agent IS '操作者浏览器信息';

-- ==================== DOWN ====================
-- 回滚：删除添加的列

ALTER TABLE product_config_history DROP COLUMN IF EXISTS user_agent;
ALTER TABLE product_config_history DROP COLUMN IF EXISTS ip_address;
ALTER TABLE product_config_history DROP COLUMN IF EXISTS field_name;
