-- Migration 051: 修复 consume_quota_with_booster 函数的列引用歧义
-- 创建时间: 2026-01-10
-- 描述: 修复 FOR 循环中的列名与返回表列名冲突

-- ==================== UP ====================

CREATE OR REPLACE FUNCTION consume_quota_with_booster(
    p_user_id INTEGER,
    p_feature_code VARCHAR(50),
    p_amount INTEGER DEFAULT 1
) RETURNS TABLE (
    success BOOLEAN,
    consumed_from VARCHAR(20),
    booster_subscription_id INTEGER,
    base_remaining INTEGER,
    booster_remaining INTEGER,
    error_message TEXT
) AS $$
DECLARE
    v_base_limit INTEGER;
    v_base_used INTEGER;
    v_base_remaining INTEGER;
    v_booster_record RECORD;
    v_amount_to_consume INTEGER := p_amount;
    v_total_booster_remaining INTEGER;
    v_result_sub_id INTEGER;
BEGIN
    -- 1. 获取基础配额信息
    SELECT quota_limit, current_usage INTO v_base_limit, v_base_used
    FROM check_user_quota(p_user_id, p_feature_code);
    
    v_base_limit := COALESCE(v_base_limit, 0);
    v_base_used := COALESCE(v_base_used, 0);
    v_base_remaining := GREATEST(0, v_base_limit - v_base_used);
    
    -- 获取加量包总剩余
    SELECT COALESCE(SUM(ubq.quota_limit - ubq.quota_used), 0) INTO v_total_booster_remaining
    FROM user_booster_quotas ubq
    WHERE ubq.user_id = p_user_id 
      AND ubq.feature_code = p_feature_code 
      AND ubq.status = 'active'
      AND ubq.expires_at > CURRENT_TIMESTAMP;
    
    -- 检查总配额是否足够
    IF (v_base_remaining + v_total_booster_remaining) < p_amount THEN
        RETURN QUERY SELECT 
            FALSE,
            NULL::VARCHAR(20),
            NULL::INTEGER,
            v_base_remaining,
            v_total_booster_remaining,
            '配额不足'::TEXT;
        RETURN;
    END IF;
    
    -- 2. 如果基础配额足够，从基础配额消耗
    IF v_base_remaining >= p_amount THEN
        -- 更新基础配额使用量
        PERFORM record_feature_usage(p_user_id, p_feature_code, NULL, NULL, p_amount, NULL);
        
        RETURN QUERY SELECT 
            TRUE,
            'base'::VARCHAR(20),
            NULL::INTEGER,
            (v_base_remaining - p_amount)::INTEGER,
            v_total_booster_remaining,
            NULL::TEXT;
        RETURN;
    END IF;
    
    -- 3. 基础配额不足，先消耗完基础配额
    IF v_base_remaining > 0 THEN
        PERFORM record_feature_usage(p_user_id, p_feature_code, NULL, NULL, v_base_remaining, NULL);
        v_amount_to_consume := p_amount - v_base_remaining;
    END IF;
    
    -- 4. 从加量包消耗（FIFO）- 使用别名避免列名冲突
    FOR v_booster_record IN 
        SELECT ubq.id as rec_id, ubq.booster_subscription_id as rec_sub_id, ubq.quota_limit as rec_limit, ubq.quota_used as rec_used
        FROM user_booster_quotas ubq
        WHERE ubq.user_id = p_user_id 
          AND ubq.feature_code = p_feature_code 
          AND ubq.status = 'active'
          AND ubq.expires_at > CURRENT_TIMESTAMP
          AND ubq.quota_used < ubq.quota_limit
        ORDER BY ubq.created_at ASC
    LOOP
        DECLARE
            v_booster_avail INTEGER := v_booster_record.rec_limit - v_booster_record.rec_used;
            v_consume_from_this INTEGER := LEAST(v_amount_to_consume, v_booster_avail);
        BEGIN
            -- 更新加量包使用量
            UPDATE user_booster_quotas 
            SET quota_used = quota_used + v_consume_from_this,
                updated_at = CURRENT_TIMESTAMP,
                status = CASE 
                    WHEN quota_used + v_consume_from_this >= quota_limit THEN 'exhausted'
                    ELSE status
                END
            WHERE id = v_booster_record.rec_id;
            
            v_amount_to_consume := v_amount_to_consume - v_consume_from_this;
            v_result_sub_id := v_booster_record.rec_sub_id;
            
            IF v_amount_to_consume <= 0 THEN
                -- 重新计算加量包剩余
                SELECT COALESCE(SUM(ubq.quota_limit - ubq.quota_used), 0) INTO v_total_booster_remaining
                FROM user_booster_quotas ubq
                WHERE ubq.user_id = p_user_id 
                  AND ubq.feature_code = p_feature_code 
                  AND ubq.status = 'active'
                  AND ubq.expires_at > CURRENT_TIMESTAMP;
                
                RETURN QUERY SELECT 
                    TRUE,
                    'booster'::VARCHAR(20),
                    v_result_sub_id,
                    0::INTEGER,
                    v_total_booster_remaining,
                    NULL::TEXT;
                RETURN;
            END IF;
        END;
    END LOOP;
    
    -- 5. 不应该到达这里，但以防万一
    RETURN QUERY SELECT FALSE, NULL::VARCHAR(20), NULL::INTEGER, 0::INTEGER, 0::INTEGER, '未知错误'::TEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION consume_quota_with_booster IS '消耗配额（优先基础配额，然后FIFO消耗加量包）- 修复列名冲突';

-- ==================== DOWN ====================

-- 恢复原函数（如果需要回滚）
-- 这里不需要特别处理，因为函数会被覆盖
