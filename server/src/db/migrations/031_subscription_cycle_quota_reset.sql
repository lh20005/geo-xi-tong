-- ========================================
-- 迁移 031: 订阅周期配额重置系统
-- 创建时间: 2026-01-05
-- 描述: 配额重置基于用户订阅周期，而非固定日历周期
-- ========================================

-- 1. 为 user_subscriptions 表添加配额重置相关字段
ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS quota_reset_anchor TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS quota_cycle_type VARCHAR(20) DEFAULT 'monthly';

COMMENT ON COLUMN user_subscriptions.quota_reset_anchor IS '配额重置锚点时间（订阅开始时间）';
COMMENT ON COLUMN user_subscriptions.quota_cycle_type IS '配额周期类型：monthly(月度), yearly(年度)，继承自套餐的 billing_cycle';

-- 2. 为现有订阅初始化配额重置锚点
UPDATE user_subscriptions us
SET 
  quota_reset_anchor = us.start_date,
  quota_cycle_type = COALESCE(sp.billing_cycle, 'monthly')
FROM subscription_plans sp
WHERE us.plan_id = sp.id
  AND us.quota_reset_anchor IS NULL;

-- 3. 创建函数：计算用户配额周期
CREATE OR REPLACE FUNCTION get_user_quota_period(
  p_user_id INTEGER,
  p_feature_code VARCHAR(50)
) RETURNS TABLE (
  period_start TIMESTAMP,
  period_end TIMESTAMP,
  cycle_type VARCHAR(20),
  subscription_end TIMESTAMP
) AS $$
DECLARE
  v_subscription_start TIMESTAMP;
  v_subscription_end TIMESTAMP;
  v_quota_anchor TIMESTAMP;
  v_cycle_type VARCHAR(20);
  v_current_period_start TIMESTAMP;
  v_current_period_end TIMESTAMP;
  v_cycles_elapsed INTEGER;
BEGIN
  -- 获取用户订阅信息
  SELECT 
    us.start_date,
    us.end_date,
    us.quota_reset_anchor,
    us.quota_cycle_type
  INTO 
    v_subscription_start,
    v_subscription_end,
    v_quota_anchor,
    v_cycle_type
  FROM user_subscriptions us
  WHERE us.user_id = p_user_id 
    AND us.status = 'active'
    AND us.end_date > CURRENT_TIMESTAMP
  ORDER BY us.end_date DESC
  LIMIT 1;
  
  -- 如果没有有效订阅，返回空
  IF v_subscription_start IS NULL THEN
    RETURN;
  END IF;
  
  -- 使用锚点时间（如果没有则使用订阅开始时间）
  IF v_quota_anchor IS NULL THEN
    v_quota_anchor := v_subscription_start;
  END IF;
  
  -- 根据周期类型计算当前周期
  IF v_cycle_type = 'yearly' THEN
    -- 年度周期：计算从锚点开始经过了多少年
    v_cycles_elapsed := EXTRACT(YEAR FROM AGE(CURRENT_TIMESTAMP, v_quota_anchor))::INTEGER;
    v_current_period_start := v_quota_anchor + (v_cycles_elapsed || ' years')::INTERVAL;
    v_current_period_end := v_current_period_start + INTERVAL '1 year' - INTERVAL '1 second';
  ELSE
    -- 月度周期：计算从锚点开始经过了多少个月
    v_cycles_elapsed := (
      EXTRACT(YEAR FROM AGE(CURRENT_TIMESTAMP, v_quota_anchor)) * 12 +
      EXTRACT(MONTH FROM AGE(CURRENT_TIMESTAMP, v_quota_anchor))
    )::INTEGER;
    v_current_period_start := v_quota_anchor + (v_cycles_elapsed || ' months')::INTERVAL;
    v_current_period_end := v_current_period_start + INTERVAL '1 month' - INTERVAL '1 second';
  END IF;
  
  -- 确保周期开始时间不早于订阅开始时间
  IF v_current_period_start < v_subscription_start THEN
    v_current_period_start := v_subscription_start;
  END IF;
  
  -- 确保周期结束时间不晚于订阅结束时间
  IF v_current_period_end > v_subscription_end THEN
    v_current_period_end := v_subscription_end;
  END IF;
  
  RETURN QUERY SELECT 
    v_current_period_start, 
    v_current_period_end, 
    v_cycle_type,
    v_subscription_end;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_quota_period IS '计算用户配额周期 - 基于订阅锚点时间和周期类型';

-- 4. 更新 record_feature_usage 函数 - 使用订阅周期
CREATE OR REPLACE FUNCTION record_feature_usage(
  p_user_id INTEGER,
  p_feature_code VARCHAR(50),
  p_amount INTEGER DEFAULT 1
) RETURNS BOOLEAN AS $$
DECLARE
  v_period RECORD;
BEGIN
  -- 获取用户配额周期
  SELECT * INTO v_period 
  FROM get_user_quota_period(p_user_id, p_feature_code)
  LIMIT 1;
  
  -- 如果没有有效订阅，拒绝记录使用量
  IF v_period IS NULL THEN
    RAISE EXCEPTION '用户没有有效订阅';
  END IF;
  
  -- 记录使用量
  INSERT INTO user_usage (
    user_id, 
    feature_code, 
    usage_count, 
    period_start, 
    period_end, 
    last_reset_at
  )
  VALUES (
    p_user_id, 
    p_feature_code, 
    p_amount,
    v_period.period_start, 
    v_period.period_end, 
    v_period.period_start
  )
  ON CONFLICT (user_id, feature_code, period_start)
  DO UPDATE SET 
    usage_count = user_usage.usage_count + p_amount,
    updated_at = CURRENT_TIMESTAMP;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION record_feature_usage IS '记录功能使用量 - 基于用户订阅周期';

-- 5. 更新 check_feature_quota 函数 - 使用订阅周期
CREATE OR REPLACE FUNCTION check_feature_quota(
  p_user_id INTEGER,
  p_feature_code VARCHAR(50),
  p_amount INTEGER DEFAULT 1
) RETURNS TABLE (
  allowed BOOLEAN,
  current_usage INTEGER,
  quota_limit INTEGER,
  remaining INTEGER,
  reason TEXT
) AS $$
DECLARE
  v_subscription_id INTEGER;
  v_plan_id INTEGER;
  v_subscription_end TIMESTAMP;
  v_feature_value INTEGER;
  v_custom_quotas JSONB;
  v_current_usage INTEGER := 0;
  v_period RECORD;
BEGIN
  -- 获取用户当前有效订阅
  SELECT us.id, us.plan_id, us.end_date, us.custom_quotas
  INTO v_subscription_id, v_plan_id, v_subscription_end, v_custom_quotas
  FROM user_subscriptions us
  WHERE us.user_id = p_user_id 
    AND us.status = 'active'
    AND us.end_date > CURRENT_TIMESTAMP
  ORDER BY us.end_date DESC
  LIMIT 1;
  
  -- 如果没有有效订阅，拒绝访问
  IF v_plan_id IS NULL THEN
    RETURN QUERY SELECT 
      FALSE,
      0,
      0,
      0,
      '没有有效订阅'::TEXT;
    RETURN;
  END IF;
  
  -- 检查订阅是否已暂停
  IF EXISTS (
    SELECT 1 FROM user_subscriptions 
    WHERE id = v_subscription_id AND paused_at IS NOT NULL
  ) THEN
    RETURN QUERY SELECT 
      FALSE,
      0,
      0,
      0,
      '订阅已暂停'::TEXT;
    RETURN;
  END IF;
  
  -- 获取功能配额（优先使用自定义配额）
  IF v_custom_quotas IS NOT NULL AND v_custom_quotas ? p_feature_code THEN
    v_feature_value := (v_custom_quotas->>p_feature_code)::INTEGER;
  ELSE
    SELECT pf.feature_value INTO v_feature_value
    FROM plan_features pf
    WHERE pf.plan_id = v_plan_id AND pf.feature_code = p_feature_code;
  END IF;
  
  -- 如果功能不存在，拒绝访问
  IF v_feature_value IS NULL THEN
    RETURN QUERY SELECT 
      FALSE,
      0,
      0,
      0,
      '功能不存在'::TEXT;
    RETURN;
  END IF;
  
  -- 无限制配额
  IF v_feature_value = -1 THEN
    RETURN QUERY SELECT 
      TRUE,
      0,
      -1,
      -1,
      '无限制'::TEXT;
    RETURN;
  END IF;
  
  -- 获取用户配额周期
  SELECT * INTO v_period 
  FROM get_user_quota_period(p_user_id, p_feature_code)
  LIMIT 1;
  
  IF v_period IS NULL THEN
    RETURN QUERY SELECT 
      FALSE,
      0,
      0,
      0,
      '无法计算配额周期'::TEXT;
    RETURN;
  END IF;
  
  -- 获取当前周期的使用量
  SELECT COALESCE(uu.usage_count, 0)
  INTO v_current_usage
  FROM user_usage uu
  WHERE uu.user_id = p_user_id 
    AND uu.feature_code = p_feature_code
    AND uu.period_start = v_period.period_start
    AND uu.period_end = v_period.period_end;
  
  -- 检查配额
  IF v_current_usage + p_amount <= v_feature_value THEN
    RETURN QUERY SELECT 
      TRUE,
      v_current_usage,
      v_feature_value,
      v_feature_value - v_current_usage,
      '配额充足'::TEXT;
  ELSE
    RETURN QUERY SELECT 
      FALSE,
      v_current_usage,
      v_feature_value,
      GREATEST(0, v_feature_value - v_current_usage),
      '配额不足'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_feature_quota IS '检查功能配额 - 基于用户订阅周期';

-- 6. 创建触发器：订阅创建时自动设置配额周期类型
CREATE OR REPLACE FUNCTION set_quota_cycle_on_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- 从套餐获取 billing_cycle 并设置为 quota_cycle_type
  SELECT billing_cycle INTO NEW.quota_cycle_type
  FROM subscription_plans
  WHERE id = NEW.plan_id;
  
  -- 如果没有设置锚点，使用订阅开始时间
  IF NEW.quota_reset_anchor IS NULL THEN
    NEW.quota_reset_anchor := NEW.start_date;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_quota_cycle ON user_subscriptions;
CREATE TRIGGER trigger_set_quota_cycle
  BEFORE INSERT OR UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION set_quota_cycle_on_subscription();

COMMENT ON FUNCTION set_quota_cycle_on_subscription IS '订阅创建/更新时自动设置配额周期类型';

-- 7. 创建函数：获取用户下次配额重置时间
CREATE OR REPLACE FUNCTION get_next_quota_reset_time(p_user_id INTEGER)
RETURNS TIMESTAMP AS $$
DECLARE
  v_period RECORD;
BEGIN
  -- 获取用户配额周期
  SELECT * INTO v_period 
  FROM get_user_quota_period(p_user_id, 'articles_per_month')
  LIMIT 1;
  
  IF v_period IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- 返回下次重置时间（当前周期结束后1秒）
  RETURN v_period.period_end + INTERVAL '1 second';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_next_quota_reset_time IS '获取用户下次配额重置时间';

-- 8. 创建函数：获取用户配额重置日期描述
CREATE OR REPLACE FUNCTION get_quota_reset_description(p_user_id INTEGER)
RETURNS TEXT AS $$
DECLARE
  v_anchor TIMESTAMP;
  v_cycle_type VARCHAR(20);
  v_reset_day INTEGER;
  v_reset_month INTEGER;
BEGIN
  -- 获取用户订阅信息
  SELECT quota_reset_anchor, quota_cycle_type
  INTO v_anchor, v_cycle_type
  FROM user_subscriptions
  WHERE user_id = p_user_id 
    AND status = 'active'
    AND end_date > CURRENT_TIMESTAMP
  ORDER BY end_date DESC
  LIMIT 1;
  
  IF v_anchor IS NULL THEN
    RETURN '无有效订阅';
  END IF;
  
  v_reset_day := EXTRACT(DAY FROM v_anchor)::INTEGER;
  v_reset_month := EXTRACT(MONTH FROM v_anchor)::INTEGER;
  
  IF v_cycle_type = 'yearly' THEN
    RETURN '每年 ' || v_reset_month || ' 月 ' || v_reset_day || ' 日重置';
  ELSE
    RETURN '每月 ' || v_reset_day || ' 号重置';
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_quota_reset_description IS '获取用户配额重置日期的可读描述';

-- 9. 清理旧的配额使用记录（保留最近3个周期）
-- 注意：这个操作可能需要较长时间，建议在低峰期执行
DO $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- 删除超过3个周期的旧记录
  WITH recent_periods AS (
    SELECT DISTINCT user_id, feature_code, period_start
    FROM user_usage
    ORDER BY user_id, feature_code, period_start DESC
  ),
  periods_to_keep AS (
    SELECT user_id, feature_code, period_start,
           ROW_NUMBER() OVER (PARTITION BY user_id, feature_code ORDER BY period_start DESC) as rn
    FROM recent_periods
  )
  DELETE FROM user_usage
  WHERE (user_id, feature_code, period_start) NOT IN (
    SELECT user_id, feature_code, period_start
    FROM periods_to_keep
    WHERE rn <= 3
  );
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE '清理了 % 条旧配额使用记录', v_deleted_count;
END $$;

-- 10. 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_quota_anchor 
  ON user_subscriptions(user_id, quota_reset_anchor) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_user_usage_period 
  ON user_usage(user_id, feature_code, period_start, period_end);

-- ========================================
-- 迁移完成
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ 迁移 031 成功完成';
  RAISE NOTICE '   - 已添加配额重置锚点字段';
  RAISE NOTICE '   - 已创建订阅周期计算函数';
  RAISE NOTICE '   - record_feature_usage 函数已更新';
  RAISE NOTICE '   - check_feature_quota 函数已更新';
  RAISE NOTICE '   - 已创建自动设置配额周期触发器';
  RAISE NOTICE '   - 已创建配额重置时间查询函数';
  RAISE NOTICE '   - 配额重置现在基于用户订阅周期（月度/年度）';
  RAISE NOTICE '   - 现有用户配额锚点已初始化';
END $$;
