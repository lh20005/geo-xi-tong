-- 创建安全告警表
CREATE TABLE IF NOT EXISTS security_alerts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL, -- 告警类型：payment_failures, quota_usage_spike, order_creation_spike
  severity VARCHAR(20) NOT NULL, -- 严重程度：low, medium, high
  message TEXT NOT NULL, -- 告警消息
  details JSONB, -- 详细信息
  resolved BOOLEAN DEFAULT FALSE, -- 是否已处理
  resolved_at TIMESTAMP, -- 处理时间
  resolved_by INTEGER REFERENCES users(id), -- 处理人
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_security_alerts_user_id (user_id),
  INDEX idx_security_alerts_type (alert_type),
  INDEX idx_security_alerts_severity (severity),
  INDEX idx_security_alerts_resolved (resolved),
  INDEX idx_security_alerts_created_at (created_at)
);

-- 添加注释
COMMENT ON TABLE security_alerts IS '安全告警记录';
COMMENT ON COLUMN security_alerts.alert_type IS '告警类型';
COMMENT ON COLUMN security_alerts.severity IS '严重程度';
COMMENT ON COLUMN security_alerts.message IS '告警消息';
COMMENT ON COLUMN security_alerts.details IS '详细信息（JSON格式）';
COMMENT ON COLUMN security_alerts.resolved IS '是否已处理';
