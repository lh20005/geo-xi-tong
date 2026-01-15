-- 迁移文件: 064_publish_analytics.sql
-- 功能: 发布分析统计
-- 用于统计发布成功率、追踪常见错误、优化平台适配器

-- ==================== UP ====================

-- 发布分析记录表
CREATE TABLE IF NOT EXISTS publish_analytics (
    id SERIAL PRIMARY KEY,
    
    -- 任务信息
    task_id VARCHAR(100) NOT NULL,             -- 任务 ID（Windows 端生成的 UUID）
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- 平台信息
    platform VARCHAR(50) NOT NULL,             -- 平台标识（xiaohongshu, douyin 等）
    
    -- 执行结果
    status VARCHAR(20) NOT NULL,               -- 'success' 或 'failed'
    duration INTEGER NOT NULL,                 -- 执行耗时（毫秒）
    
    -- 错误信息（失败时）
    error_code VARCHAR(50),                    -- 错误码
    error_message TEXT,                        -- 错误信息
    
    -- 元数据
    metadata JSONB DEFAULT '{}',               -- 额外信息（文章长度、图片数、重试次数等）
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_publish_analytics_user ON publish_analytics(user_id);
CREATE INDEX idx_publish_analytics_platform ON publish_analytics(platform);
CREATE INDEX idx_publish_analytics_status ON publish_analytics(status);
CREATE INDEX idx_publish_analytics_created ON publish_analytics(created_at);
CREATE INDEX idx_publish_analytics_user_platform ON publish_analytics(user_id, platform);
CREATE INDEX idx_publish_analytics_platform_status ON publish_analytics(platform, status);
CREATE INDEX idx_publish_analytics_error_code ON publish_analytics(error_code) WHERE error_code IS NOT NULL;
CREATE INDEX idx_publish_analytics_date ON publish_analytics(DATE(created_at));

-- 注释
COMMENT ON TABLE publish_analytics IS '发布分析记录表，用于统计发布成功率和错误追踪';
COMMENT ON COLUMN publish_analytics.task_id IS '任务 ID（Windows 端生成的 UUID）';
COMMENT ON COLUMN publish_analytics.user_id IS '用户 ID';
COMMENT ON COLUMN publish_analytics.platform IS '平台标识';
COMMENT ON COLUMN publish_analytics.status IS '执行状态：success-成功, failed-失败';
COMMENT ON COLUMN publish_analytics.duration IS '执行耗时（毫秒）';
COMMENT ON COLUMN publish_analytics.error_code IS '错误码（失败时）';
COMMENT ON COLUMN publish_analytics.error_message IS '错误信息（失败时）';
COMMENT ON COLUMN publish_analytics.metadata IS '额外元数据（JSON格式）';
COMMENT ON COLUMN publish_analytics.created_at IS '记录创建时间';

-- 获取平台统计的函数
CREATE OR REPLACE FUNCTION get_platform_stats(
    p_start_date TIMESTAMP,
    p_end_date TIMESTAMP
)
RETURNS TABLE (
    platform VARCHAR(50),
    total_count BIGINT,
    success_count BIGINT,
    failed_count BIGINT,
    success_rate NUMERIC(5,2),
    avg_duration INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pa.platform,
        COUNT(*)::BIGINT as total_count,
        COUNT(*) FILTER (WHERE pa.status = 'success')::BIGINT as success_count,
        COUNT(*) FILTER (WHERE pa.status = 'failed')::BIGINT as failed_count,
        ROUND(
            COUNT(*) FILTER (WHERE pa.status = 'success')::NUMERIC / 
            NULLIF(COUNT(*), 0) * 100, 
            2
        ) as success_rate,
        AVG(pa.duration)::INTEGER as avg_duration
    FROM publish_analytics pa
    WHERE pa.created_at BETWEEN p_start_date AND p_end_date
    GROUP BY pa.platform
    ORDER BY total_count DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_platform_stats(TIMESTAMP, TIMESTAMP) IS '获取指定时间范围内的平台统计数据';

-- 获取错误统计的函数
CREATE OR REPLACE FUNCTION get_error_stats(
    p_start_date TIMESTAMP,
    p_end_date TIMESTAMP,
    p_platform VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
    error_code VARCHAR(50),
    error_count BIGINT,
    percentage NUMERIC(5,2)
) AS $$
DECLARE
    total_errors BIGINT;
BEGIN
    -- 计算总错误数
    SELECT COUNT(*) INTO total_errors
    FROM publish_analytics pa
    WHERE pa.status = 'failed'
      AND pa.created_at BETWEEN p_start_date AND p_end_date
      AND (p_platform IS NULL OR pa.platform = p_platform);
    
    RETURN QUERY
    SELECT 
        COALESCE(pa.error_code, 'UNKNOWN') as error_code,
        COUNT(*)::BIGINT as error_count,
        ROUND(COUNT(*)::NUMERIC / NULLIF(total_errors, 0) * 100, 2) as percentage
    FROM publish_analytics pa
    WHERE pa.status = 'failed'
      AND pa.created_at BETWEEN p_start_date AND p_end_date
      AND (p_platform IS NULL OR pa.platform = p_platform)
    GROUP BY pa.error_code
    ORDER BY error_count DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_error_stats(TIMESTAMP, TIMESTAMP, VARCHAR) IS '获取指定时间范围内的错误统计数据';

-- 获取每日趋势的函数
CREATE OR REPLACE FUNCTION get_daily_trend(
    p_start_date TIMESTAMP,
    p_end_date TIMESTAMP
)
RETURNS TABLE (
    date DATE,
    total_count BIGINT,
    success_count BIGINT,
    failed_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE(pa.created_at) as date,
        COUNT(*)::BIGINT as total_count,
        COUNT(*) FILTER (WHERE pa.status = 'success')::BIGINT as success_count,
        COUNT(*) FILTER (WHERE pa.status = 'failed')::BIGINT as failed_count
    FROM publish_analytics pa
    WHERE pa.created_at BETWEEN p_start_date AND p_end_date
    GROUP BY DATE(pa.created_at)
    ORDER BY date;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_daily_trend(TIMESTAMP, TIMESTAMP) IS '获取指定时间范围内的每日发布趋势';

-- ==================== DOWN ====================
-- 注意：DOWN 部分仅用于手动回滚，不会自动执行
-- 如需回滚，请手动执行以下 SQL：
/*
DROP FUNCTION IF EXISTS get_daily_trend(TIMESTAMP, TIMESTAMP);
DROP FUNCTION IF EXISTS get_error_stats(TIMESTAMP, TIMESTAMP, VARCHAR);
DROP FUNCTION IF EXISTS get_platform_stats(TIMESTAMP, TIMESTAMP);
DROP TABLE IF EXISTS publish_analytics;
*/
