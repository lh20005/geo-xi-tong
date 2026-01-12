-- ==================== UP ====================
-- 迁移 056: 添加本地数据库缺失的表和列
-- 创建时间: 2026-01-12
-- 描述: 
--   1. 创建 admin_logs 表（迁移001定义但未创建）
--   2. 创建 security_alerts 表（迁移001定义但未创建，代码中使用）
--   3. 添加 conversion_targets 表缺失的列

-- ============================================
-- 1. 创建 admin_logs 表
-- ============================================
CREATE TABLE IF NOT EXISTS admin_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id INTEGER,
  details TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at DESC);

COMMENT ON TABLE admin_logs IS '管理员操作日志表';

-- ============================================
-- 2. 创建 security_alerts 表
-- ============================================
CREATE TABLE IF NOT EXISTS security_alerts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  details TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_user_id ON security_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_is_read ON security_alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_security_alerts_created_at ON security_alerts(created_at DESC);

COMMENT ON TABLE security_alerts IS '安全告警表';

-- ============================================
-- 3. 添加 conversion_targets 表缺失的列
-- ============================================
ALTER TABLE conversion_targets ADD COLUMN IF NOT EXISTS company_size VARCHAR(50);
ALTER TABLE conversion_targets ADD COLUMN IF NOT EXISTS features TEXT;
ALTER TABLE conversion_targets ADD COLUMN IF NOT EXISTS contact_info VARCHAR(255);
ALTER TABLE conversion_targets ADD COLUMN IF NOT EXISTS target_audience TEXT;
ALTER TABLE conversion_targets ADD COLUMN IF NOT EXISTS core_products TEXT;

COMMENT ON COLUMN conversion_targets.company_size IS '公司规模（可选）';
COMMENT ON COLUMN conversion_targets.features IS '公司特点（可选）';
COMMENT ON COLUMN conversion_targets.contact_info IS '联系方式（可选）';
COMMENT ON COLUMN conversion_targets.target_audience IS '目标受众（可选）';
COMMENT ON COLUMN conversion_targets.core_products IS '核心产品（可选）';

-- ==================== DOWN ====================
-- 回滚：删除添加的表和列

-- 删除 conversion_targets 列
ALTER TABLE conversion_targets DROP COLUMN IF EXISTS core_products;
ALTER TABLE conversion_targets DROP COLUMN IF EXISTS target_audience;
ALTER TABLE conversion_targets DROP COLUMN IF EXISTS contact_info;
ALTER TABLE conversion_targets DROP COLUMN IF EXISTS features;
ALTER TABLE conversion_targets DROP COLUMN IF EXISTS company_size;

-- 删除表
DROP TABLE IF EXISTS security_alerts;
DROP TABLE IF EXISTS admin_logs;
