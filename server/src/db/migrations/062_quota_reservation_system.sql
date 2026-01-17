-- 迁移文件: 062_quota_reservation_system.sql
-- 功能: 配额预扣减机制
-- 创建时间: 2026-01-15
-- 说明: 用于防止配额竞态条件，实现预扣减 + 确认/释放机制

-- ==================== UP ====================

-- 配额预留表
CREATE TABLE IF NOT EXISTS quota_reservations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quota_type VARCHAR(50) NOT NULL,  -- 'article_generation', 'publish', 'knowledge_upload', 'image_upload'
    amount INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'reserved',  -- 'reserved', 'confirmed', 'released', 'expired'
    client_id VARCHAR(100),  -- Windows 客户端标识（机器码）
    task_info JSONB,  -- 任务相关信息（用于追踪）
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,  -- 预留过期时间（默认 10 分钟）
    confirmed_at TIMESTAMP,
    released_at TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_quota_reservations_user_status ON quota_reservations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_quota_reservations_expires ON quota_reservations(expires_at) WHERE status = 'reserved';
CREATE INDEX IF NOT EXISTS idx_quota_reservations_created ON quota_reservations(created_at);
CREATE INDEX IF NOT EXISTS idx_quota_reservations_quota_type ON quota_reservations(quota_type);

-- 注释
COMMENT ON TABLE quota_reservations IS '配额预留表 - 用于预扣减机制，防止配额竞态条件';
COMMENT ON COLUMN quota_reservations.id IS '预留记录 UUID';
COMMENT ON COLUMN quota_reservations.user_id IS '用户 ID';
COMMENT ON COLUMN quota_reservations.quota_type IS '配额类型: article_generation(文章生成), publish(发布), knowledge_upload(知识库上传), image_upload(图片上传)';
COMMENT ON COLUMN quota_reservations.amount IS '预留数量，默认为 1';
COMMENT ON COLUMN quota_reservations.status IS '状态: reserved(预留中), confirmed(已确认消费), released(已释放), expired(已过期)';
COMMENT ON COLUMN quota_reservations.client_id IS 'Windows 客户端标识（机器码），用于多设备识别';
COMMENT ON COLUMN quota_reservations.task_info IS '任务相关信息，JSON 格式，用于追踪和调试';
COMMENT ON COLUMN quota_reservations.created_at IS '创建时间';
COMMENT ON COLUMN quota_reservations.expires_at IS '预留过期时间，默认 10 分钟后过期';
COMMENT ON COLUMN quota_reservations.confirmed_at IS '确认消费时间';
COMMENT ON COLUMN quota_reservations.released_at IS '释放时间';

-- 创建获取用户可用配额的函数（考虑预留）
CREATE OR REPLACE FUNCTION get_available_quota_with_reservations(
    p_user_id INTEGER,
    p_quota_type VARCHAR(50)
) RETURNS INTEGER AS $$
DECLARE
    v_total_quota INTEGER;
    v_used_quota INTEGER;
    v_reserved_quota INTEGER;
    v_available INTEGER;
BEGIN
    -- 获取用户总配额
    SELECT COALESCE(
        CASE p_quota_type
            WHEN 'article_generation' THEN cq.article_generation_limit
            WHEN 'publish' THEN cq.publish_limit
            WHEN 'knowledge_upload' THEN cq.knowledge_upload_limit
            WHEN 'image_upload' THEN cq.image_upload_limit
            ELSE 0
        END, 0
    ) INTO v_total_quota
    FROM custom_quotas cq
    WHERE cq.user_id = p_user_id;
    
    -- 如果没有自定义配额，从订阅计划获取
    IF v_total_quota IS NULL OR v_total_quota = 0 THEN
        SELECT COALESCE(
            CASE p_quota_type
                WHEN 'article_generation' THEN sp.article_generation_limit
                WHEN 'publish' THEN sp.publish_limit
                WHEN 'knowledge_upload' THEN sp.knowledge_upload_limit
                WHEN 'image_upload' THEN sp.image_upload_limit
                ELSE 0
            END, 0
        ) INTO v_total_quota
        FROM user_subscriptions us
        JOIN subscription_plans sp ON us.plan_id = sp.id
        WHERE us.user_id = p_user_id
        AND us.status = 'active'
        AND us.end_date > NOW();
    END IF;
    
    -- 获取已使用配额
    SELECT COALESCE(
        CASE p_quota_type
            WHEN 'article_generation' THEN article_generation_used
            WHEN 'publish' THEN publish_used
            WHEN 'knowledge_upload' THEN knowledge_upload_used
            WHEN 'image_upload' THEN image_upload_used
            ELSE 0
        END, 0
    ) INTO v_used_quota
    FROM user_usage_stats
    WHERE user_id = p_user_id;
    
    -- 获取已预留但未确认的配额
    SELECT COALESCE(SUM(amount), 0) INTO v_reserved_quota
    FROM quota_reservations
    WHERE user_id = p_user_id
    AND quota_type = p_quota_type
    AND status = 'reserved'
    AND expires_at > NOW();
    
    -- 计算可用配额
    v_available := v_total_quota - v_used_quota - v_reserved_quota;
    
    RETURN GREATEST(v_available, 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_available_quota_with_reservations IS '获取用户可用配额（考虑预留），返回总配额 - 已用 - 已预留';

-- 创建清理过期预留的函数
CREATE OR REPLACE FUNCTION cleanup_expired_reservations() RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE quota_reservations
    SET status = 'expired'
    WHERE status = 'reserved'
    AND expires_at < NOW();
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_reservations IS '清理过期的配额预留，将状态更新为 expired';

-- 授予权限
GRANT ALL PRIVILEGES ON TABLE quota_reservations TO geo_user;
GRANT ALL PRIVILEGES ON SEQUENCE quota_reservations_id_seq TO geo_user;

-- ==================== DOWN ====================
-- DROP FUNCTION IF EXISTS cleanup_expired_reservations();
-- DROP FUNCTION IF EXISTS get_available_quota_with_reservations(INTEGER, VARCHAR);
-- DROP TABLE IF EXISTS quota_reservations;
