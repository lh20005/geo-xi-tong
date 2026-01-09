-- Migration 047: 加量包系统 (Booster Pack System)
-- 创建时间: 2026-01-09
-- 描述: 添加加量包商品类型支持，包括表结构扩展和新表创建

-- ==================== UP ====================

-- ========================================
-- 1. 扩展 subscription_plans 表，添加 plan_type 字段
-- ========================================

-- 添加 plan_type 字段
ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS plan_type VARCHAR(20) DEFAULT 'base';

-- 添加 CHECK 约束
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'subscription_plans_plan_type_check'
    ) THEN
        ALTER TABLE subscription_plans 
        ADD CONSTRAINT subscription_plans_plan_type_check 
        CHECK (plan_type IN ('base', 'booster'));
    END IF;
END $$;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_subscription_plans_type ON subscription_plans(plan_type);

-- 更新现有套餐的 plan_type 为 'base'
UPDATE subscription_plans SET plan_type = 'base' WHERE plan_type IS NULL;

COMMENT ON COLUMN subscription_plans.plan_type IS '套餐类型: base=基础套餐, booster=加量包';

-- ========================================
-- 2. 扩展 user_subscriptions 表，添加 plan_type 字段
-- ========================================

-- 添加 plan_type 字段（冗余存储，便于查询）
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS plan_type VARCHAR(20) DEFAULT 'base';

-- 添加 CHECK 约束
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_subscriptions_plan_type_check'
    ) THEN
        ALTER TABLE user_subscriptions 
        ADD CONSTRAINT user_subscriptions_plan_type_check 
        CHECK (plan_type IN ('base', 'booster'));
    END IF;
END $$;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_type ON user_subscriptions(plan_type);

-- 更新现有订阅的 plan_type 为 'base'
UPDATE user_subscriptions SET plan_type = 'base' WHERE plan_type IS NULL;

COMMENT ON COLUMN user_subscriptions.plan_type IS '订阅类型: base=基础套餐, booster=加量包';

-- ========================================
-- 3. 创建 user_booster_quotas 表
-- ========================================

CREATE TABLE IF NOT EXISTS user_booster_quotas (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    booster_subscription_id INTEGER NOT NULL REFERENCES user_subscriptions(id) ON DELETE CASCADE,
    feature_code VARCHAR(50) NOT NULL,
    quota_limit INTEGER NOT NULL,
    quota_used INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT user_booster_quotas_positive_quota CHECK (quota_limit > 0),
    CONSTRAINT user_booster_quotas_valid_usage CHECK (quota_used >= 0 AND quota_used <= quota_limit),
    CONSTRAINT user_booster_quotas_status_check CHECK (status IN ('active', 'expired', 'exhausted'))
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_booster_quotas_user_feature 
ON user_booster_quotas(user_id, feature_code, status);

CREATE INDEX IF NOT EXISTS idx_user_booster_quotas_expires 
ON user_booster_quotas(expires_at) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_user_booster_quotas_subscription 
ON user_booster_quotas(booster_subscription_id);

COMMENT ON TABLE user_booster_quotas IS '用户加量包配额表，独立存储加量包的配额信息';
COMMENT ON COLUMN user_booster_quotas.user_id IS '用户ID';
COMMENT ON COLUMN user_booster_quotas.booster_subscription_id IS '加量包订阅ID';
COMMENT ON COLUMN user_booster_quotas.feature_code IS '功能代码';
COMMENT ON COLUMN user_booster_quotas.quota_limit IS '配额上限（购买时快照）';
COMMENT ON COLUMN user_booster_quotas.quota_used IS '已使用配额';
COMMENT ON COLUMN user_booster_quotas.status IS '状态: active=活跃, expired=已过期, exhausted=已耗尽';
COMMENT ON COLUMN user_booster_quotas.expires_at IS '过期时间';

-- ========================================
-- 4. 创建 check_combined_quota 函数
-- ========================================

CREATE OR REPLACE FUNCTION check_combined_quota(
    p_user_id INTEGER,
    p_feature_code VARCHAR(50)
) RETURNS TABLE (
    has_quota BOOLEAN,
    base_limit INTEGER,
    base_used INTEGER,
    base_remaining INTEGER,
    booster_total_limit INTEGER,
    booster_total_used INTEGER,
    booster_remaining INTEGER,
    combined_remaining INTEGER
) AS $$
DECLARE
    v_base_limit INTEGER;
    v_base_used INTEGER;
    v_booster_total_limit INTEGER;
    v_booster_total_used INTEGER;
BEGIN
    -- 获取基础配额（使用现有的 check_user_quota 函数）
    SELECT quota_limit, current_usage INTO v_base_limit, v_base_used
    FROM check_user_quota(p_user_id, p_feature_code);
    
    v_base_limit := COALESCE(v_base_limit, 0);
    v_base_used := COALESCE(v_base_used, 0);
    
    -- 获取加量包配额汇总
    SELECT 
        COALESCE(SUM(ubq.quota_limit), 0),
        COALESCE(SUM(ubq.quota_used), 0)
    INTO v_booster_total_limit, v_booster_total_used
    FROM user_booster_quotas ubq
    WHERE ubq.user_id = p_user_id 
      AND ubq.feature_code = p_feature_code 
      AND ubq.status = 'active'
      AND ubq.expires_at > CURRENT_TIMESTAMP;
    
    RETURN QUERY SELECT
        (GREATEST(0, v_base_limit - v_base_used) + GREATEST(0, v_booster_total_limit - v_booster_total_used)) > 0,
        v_base_limit,
        v_base_used,
        GREATEST(0, v_base_limit - v_base_used),
        v_booster_total_limit,
        v_booster_total_used,
        GREATEST(0, v_booster_total_limit - v_booster_total_used),
        GREATEST(0, v_base_limit - v_base_used) + GREATEST(0, v_booster_total_limit - v_booster_total_used);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_combined_quota IS '检查用户的组合配额（基础配额 + 加量包配额）';

-- ========================================
-- 5. 创建 consume_quota_with_booster 函数
-- ========================================

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
BEGIN
    -- 1. 获取基础配额信息
    SELECT quota_limit, current_usage INTO v_base_limit, v_base_used
    FROM check_user_quota(p_user_id, p_feature_code);
    
    v_base_limit := COALESCE(v_base_limit, 0);
    v_base_used := COALESCE(v_base_used, 0);
    v_base_remaining := GREATEST(0, v_base_limit - v_base_used);
    
    -- 获取加量包总剩余
    SELECT COALESCE(SUM(quota_limit - quota_used), 0) INTO v_total_booster_remaining
    FROM user_booster_quotas 
    WHERE user_id = p_user_id 
      AND feature_code = p_feature_code 
      AND status = 'active'
      AND expires_at > CURRENT_TIMESTAMP;
    
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
    
    -- 4. 从加量包消耗（FIFO）
    FOR v_booster_record IN 
        SELECT id, booster_subscription_id as sub_id, quota_limit, quota_used
        FROM user_booster_quotas
        WHERE user_id = p_user_id 
          AND feature_code = p_feature_code 
          AND status = 'active'
          AND expires_at > CURRENT_TIMESTAMP
          AND quota_used < quota_limit
        ORDER BY created_at ASC
    LOOP
        DECLARE
            v_booster_remaining INTEGER := v_booster_record.quota_limit - v_booster_record.quota_used;
            v_consume_from_this INTEGER := LEAST(v_amount_to_consume, v_booster_remaining);
        BEGIN
            -- 更新加量包使用量
            UPDATE user_booster_quotas 
            SET quota_used = quota_used + v_consume_from_this,
                updated_at = CURRENT_TIMESTAMP,
                status = CASE 
                    WHEN quota_used + v_consume_from_this >= quota_limit THEN 'exhausted'
                    ELSE status
                END
            WHERE id = v_booster_record.id;
            
            v_amount_to_consume := v_amount_to_consume - v_consume_from_this;
            
            IF v_amount_to_consume <= 0 THEN
                -- 重新计算加量包剩余
                SELECT COALESCE(SUM(quota_limit - quota_used), 0) INTO v_total_booster_remaining
                FROM user_booster_quotas 
                WHERE user_id = p_user_id 
                  AND feature_code = p_feature_code 
                  AND status = 'active'
                  AND expires_at > CURRENT_TIMESTAMP;
                
                RETURN QUERY SELECT 
                    TRUE,
                    'booster'::VARCHAR(20),
                    v_booster_record.sub_id,
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

COMMENT ON FUNCTION consume_quota_with_booster IS '消耗配额（优先基础配额，然后FIFO消耗加量包）';

-- ========================================
-- 6. 创建 expire_booster_quotas 函数
-- ========================================

CREATE OR REPLACE FUNCTION expire_booster_quotas()
RETURNS INTEGER AS $$
DECLARE
    v_expired_count INTEGER;
BEGIN
    -- 更新过期的加量包配额状态
    UPDATE user_booster_quotas
    SET status = 'expired',
        updated_at = CURRENT_TIMESTAMP
    WHERE status = 'active'
      AND expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS v_expired_count = ROW_COUNT;
    
    RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION expire_booster_quotas IS '批量过期已到期的加量包配额';

-- ========================================
-- 7. 创建 get_user_booster_summary 函数
-- ========================================

CREATE OR REPLACE FUNCTION get_user_booster_summary(p_user_id INTEGER)
RETURNS TABLE (
    feature_code VARCHAR(50),
    total_limit INTEGER,
    total_used INTEGER,
    total_remaining INTEGER,
    active_pack_count INTEGER,
    earliest_expiration TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ubq.feature_code,
        SUM(ubq.quota_limit)::INTEGER as total_limit,
        SUM(ubq.quota_used)::INTEGER as total_used,
        SUM(ubq.quota_limit - ubq.quota_used)::INTEGER as total_remaining,
        COUNT(*)::INTEGER as active_pack_count,
        MIN(ubq.expires_at) as earliest_expiration
    FROM user_booster_quotas ubq
    WHERE ubq.user_id = p_user_id
      AND ubq.status = 'active'
      AND ubq.expires_at > CURRENT_TIMESTAMP
    GROUP BY ubq.feature_code;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_booster_summary IS '获取用户加量包配额汇总';

-- ========================================
-- 8. 添加 usage_records 表的 source 字段（如果不存在）
-- ========================================

ALTER TABLE usage_records 
ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'base';

ALTER TABLE usage_records 
ADD COLUMN IF NOT EXISTS booster_subscription_id INTEGER REFERENCES user_subscriptions(id);

COMMENT ON COLUMN usage_records.source IS '配额来源: base=基础配额, booster=加量包';
COMMENT ON COLUMN usage_records.booster_subscription_id IS '加量包订阅ID（当source=booster时）';

-- ========================================
-- 验证迁移
-- ========================================

DO $$
DECLARE
    v_plan_type_exists BOOLEAN;
    v_booster_table_exists BOOLEAN;
    v_function_exists BOOLEAN;
BEGIN
    -- 检查 plan_type 字段
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subscription_plans' AND column_name = 'plan_type'
    ) INTO v_plan_type_exists;
    
    -- 检查 user_booster_quotas 表
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'user_booster_quotas'
    ) INTO v_booster_table_exists;
    
    -- 检查函数
    SELECT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'check_combined_quota'
    ) INTO v_function_exists;
    
    IF NOT v_plan_type_exists THEN
        RAISE EXCEPTION 'Migration failed: plan_type column not created';
    END IF;
    
    IF NOT v_booster_table_exists THEN
        RAISE EXCEPTION 'Migration failed: user_booster_quotas table not created';
    END IF;
    
    IF NOT v_function_exists THEN
        RAISE EXCEPTION 'Migration failed: check_combined_quota function not created';
    END IF;
    
    RAISE NOTICE '✅ Migration 047 completed successfully';
    RAISE NOTICE '  - subscription_plans.plan_type: OK';
    RAISE NOTICE '  - user_subscriptions.plan_type: OK';
    RAISE NOTICE '  - user_booster_quotas table: OK';
    RAISE NOTICE '  - check_combined_quota function: OK';
    RAISE NOTICE '  - consume_quota_with_booster function: OK';
    RAISE NOTICE '  - expire_booster_quotas function: OK';
    RAISE NOTICE '  - get_user_booster_summary function: OK';
END $$;


-- ==================== DOWN ====================

-- 删除 usage_records 表的新字段
ALTER TABLE usage_records DROP COLUMN IF EXISTS source;
ALTER TABLE usage_records DROP COLUMN IF EXISTS booster_subscription_id;

-- 删除函数
DROP FUNCTION IF EXISTS get_user_booster_summary(INTEGER);
DROP FUNCTION IF EXISTS expire_booster_quotas();
DROP FUNCTION IF EXISTS consume_quota_with_booster(INTEGER, VARCHAR, INTEGER);
DROP FUNCTION IF EXISTS check_combined_quota(INTEGER, VARCHAR);

-- 删除 user_booster_quotas 表
DROP TABLE IF EXISTS user_booster_quotas;

-- 删除 user_subscriptions 表的 plan_type 字段
ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_plan_type_check;
DROP INDEX IF EXISTS idx_user_subscriptions_plan_type;
ALTER TABLE user_subscriptions DROP COLUMN IF EXISTS plan_type;

-- 删除 subscription_plans 表的 plan_type 字段
ALTER TABLE subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_plan_type_check;
DROP INDEX IF EXISTS idx_subscription_plans_type;
ALTER TABLE subscription_plans DROP COLUMN IF EXISTS plan_type;
