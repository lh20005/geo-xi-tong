-- ==================== UP ====================
-- ========================================
-- 迁移 062: 年度套餐保护机制
-- 创建时间: 2026-01-29
-- 描述: 年度套餐用户购买其他套餐时，转换为配额叠加而非替换订阅
-- ========================================

-- 1. 在 subscription_plans 表增加年度套餐保护标识
ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS is_protected_annual BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN subscription_plans.is_protected_annual IS '是否为受保护的年度套餐（购买其他套餐时不被替换，而是叠加配额）';

-- 2. 标记现有的年度套餐为受保护
UPDATE subscription_plans 
SET is_protected_annual = TRUE 
WHERE billing_cycle = 'yearly' AND plan_type = 'base';

-- 3. 在 user_booster_quotas 表增加来源标识
ALTER TABLE user_booster_quotas 
ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT 'booster';

COMMENT ON COLUMN user_booster_quotas.source_type IS '配额来源类型: booster=加量包, annual_addon=年度套餐额外购买';

-- 4. 在 user_subscriptions 表增加来源标识（用于区分年度套餐额外购买的订阅）
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT 'normal';

COMMENT ON COLUMN user_subscriptions.source_type IS '订阅来源类型: normal=正常购买, annual_addon=年度套餐额外购买转换';

-- 5. 创建函数：检查用户是否有受保护的年度订阅
CREATE OR REPLACE FUNCTION get_user_protected_annual_subscription(p_user_id INTEGER)
RETURNS TABLE (
    subscription_id INTEGER,
    plan_id INTEGER,
    plan_code VARCHAR(50),
    plan_name VARCHAR(100),
    start_date TIMESTAMP,
    end_date TIMESTAMP
) AS $
BEGIN
    RETURN QUERY
    SELECT 
        us.id as subscription_id,
        us.plan_id,
        sp.plan_code,
        sp.plan_name,
        us.start_date,
        us.end_date
    FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.user_id = p_user_id 
      AND us.status = 'active'
      AND us.end_date > CURRENT_TIMESTAMP
      AND sp.is_protected_annual = TRUE
      AND COALESCE(us.plan_type, 'base') = 'base'
    ORDER BY us.end_date DESC
    LIMIT 1;
END;
$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_protected_annual_subscription IS '获取用户受保护的年度订阅';

-- 6. 创建函数：将套餐转换为加量包配额（年度套餐用户额外购买时使用）
CREATE OR REPLACE FUNCTION convert_plan_to_booster_quotas(
    p_user_id INTEGER,
    p_plan_id INTEGER,
    p_order_id INTEGER,
    p_protected_subscription_id INTEGER
) RETURNS INTEGER AS $
DECLARE
    v_plan RECORD;
    v_feature RECORD;
    v_booster_subscription_id INTEGER;
    v_start_date TIMESTAMP;
    v_end_date TIMESTAMP;
    v_quota_count INTEGER := 0;
BEGIN
    -- 获取套餐信息
    SELECT * INTO v_plan FROM subscription_plans WHERE id = p_plan_id;
    
    IF v_plan IS NULL THEN
        RAISE EXCEPTION '套餐不存在: %', p_plan_id;
    END IF;
    
    -- 计算有效期
    v_start_date := CURRENT_TIMESTAMP;
    v_end_date := v_start_date + (COALESCE(v_plan.duration_days, 30) || ' days')::INTERVAL;
    v_end_date := DATE_TRUNC('day', v_end_date) + INTERVAL '23:59:59';
    
    -- 创建一个特殊的"加量包订阅"记录（用于追踪）
    INSERT INTO user_subscriptions (
        user_id, plan_id, plan_type, status, start_date, end_date, source_type
    ) VALUES (
        p_user_id, p_plan_id, 'booster', 'active', v_start_date, v_end_date, 'annual_addon'
    ) RETURNING id INTO v_booster_subscription_id;
    
    -- 为每个功能创建加量包配额记录
    FOR v_feature IN 
        SELECT feature_code, feature_name, feature_value 
        FROM plan_features 
        WHERE plan_id = p_plan_id AND feature_value > 0
    LOOP
        INSERT INTO user_booster_quotas (
            user_id, booster_subscription_id, feature_code, 
            quota_limit, quota_used, status, expires_at, source_type
        ) VALUES (
            p_user_id, v_booster_subscription_id, v_feature.feature_code,
            v_feature.feature_value, 0, 'active', v_end_date, 'annual_addon'
        );
        v_quota_count := v_quota_count + 1;
    END LOOP;
    
    -- 记录使用记录（审计）
    INSERT INTO usage_records (
        user_id, feature_code, amount, resource_type, resource_id, metadata, source
    ) VALUES (
        p_user_id, 'annual_addon_activation', 1, 'annual_addon', v_booster_subscription_id,
        jsonb_build_object(
            'planId', p_plan_id,
            'planName', v_plan.plan_name,
            'orderId', p_order_id,
            'protectedSubscriptionId', p_protected_subscription_id,
            'quotaCount', v_quota_count,
            'expiresAt', v_end_date
        ),
        'booster'
    );
    
    RAISE NOTICE '年度套餐用户 % 额外购买套餐 % 已转换为加量包，创建 % 个配额记录', 
        p_user_id, v_plan.plan_name, v_quota_count;
    
    RETURN v_booster_subscription_id;
END;
$ LANGUAGE plpgsql;

COMMENT ON FUNCTION convert_plan_to_booster_quotas IS '将套餐转换为加量包配额（年度套餐用户额外购买时使用）';

-- 7. 更新 get_user_booster_summary 函数，包含年度套餐额外购买的配额
-- 原函数已经会查询所有 user_booster_quotas，无需修改

-- ========================================
-- 验证迁移
-- ========================================
DO $
DECLARE
    v_protected_column_exists BOOLEAN;
    v_source_type_column_exists BOOLEAN;
    v_function_exists BOOLEAN;
BEGIN
    -- 检查 is_protected_annual 字段
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subscription_plans' AND column_name = 'is_protected_annual'
    ) INTO v_protected_column_exists;
    
    -- 检查 source_type 字段
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_booster_quotas' AND column_name = 'source_type'
    ) INTO v_source_type_column_exists;
    
    -- 检查函数
    SELECT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'get_user_protected_annual_subscription'
    ) INTO v_function_exists;
    
    IF NOT v_protected_column_exists THEN
        RAISE EXCEPTION 'Migration failed: is_protected_annual column not created';
    END IF;
    
    IF NOT v_source_type_column_exists THEN
        RAISE EXCEPTION 'Migration failed: source_type column not created';
    END IF;
    
    IF NOT v_function_exists THEN
        RAISE EXCEPTION 'Migration failed: get_user_protected_annual_subscription function not created';
    END IF;
    
    RAISE NOTICE '✅ 迁移 062 成功完成';
    RAISE NOTICE '   - is_protected_annual 字段已添加';
    RAISE NOTICE '   - source_type 字段已添加';
    RAISE NOTICE '   - get_user_protected_annual_subscription 函数已创建';
    RAISE NOTICE '   - convert_plan_to_booster_quotas 函数已创建';
    RAISE NOTICE '   - 年度套餐已标记为受保护';
END $;

-- ==================== DOWN ====================
-- 回滚迁移

-- 删除函数
DROP FUNCTION IF EXISTS convert_plan_to_booster_quotas(INTEGER, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_user_protected_annual_subscription(INTEGER);

-- 删除字段
ALTER TABLE user_subscriptions DROP COLUMN IF EXISTS source_type;
ALTER TABLE user_booster_quotas DROP COLUMN IF EXISTS source_type;
ALTER TABLE subscription_plans DROP COLUMN IF EXISTS is_protected_annual;
