-- 服务事件表
-- 用于记录服务启停、定时任务执行、异常告警等事件
-- 支持监控服务的历史查询和告警追踪

CREATE TABLE IF NOT EXISTS service_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以支持高效查询
CREATE INDEX IF NOT EXISTS idx_service_events_type ON service_events(event_type);
CREATE INDEX IF NOT EXISTS idx_service_events_severity ON service_events(severity);
CREATE INDEX IF NOT EXISTS idx_service_events_created_at ON service_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_events_type_created ON service_events(event_type, created_at DESC);

-- 授权给应用用户
GRANT ALL PRIVILEGES ON TABLE service_events TO geo_user;
GRANT USAGE, SELECT ON SEQUENCE service_events_id_seq TO geo_user;

-- 添加注释
COMMENT ON TABLE service_events IS '服务事件记录表，用于监控和告警';
COMMENT ON COLUMN service_events.event_type IS '事件类型：service_start, service_stop, task_error, commission_settlement_error, anomaly_detected 等';
COMMENT ON COLUMN service_events.severity IS '严重级别：info, warning, error, critical';
COMMENT ON COLUMN service_events.message IS '事件描述消息';
COMMENT ON COLUMN service_events.details IS '事件详细信息（JSON格式）';

-- 自动清理超过30天的事件（可选，通过定时任务执行）
-- 创建清理函数
CREATE OR REPLACE FUNCTION cleanup_old_service_events()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM service_events 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_service_events() IS '清理超过30天的服务事件记录';
