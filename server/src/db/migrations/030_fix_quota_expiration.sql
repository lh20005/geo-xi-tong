-- ========================================
-- 迁移 030: 修复配额时效性问题
-- 创建时间: 2026-01-05
-- 描述: 所有配额都应该与订阅周期绑定，到期即停止，不存在永久配额
-- ========================================

-- 1. 更新 record_feature_usage 函数 - 移除永久配额概念
CREATE OR REPLACE FUNCTION record_feature_usage(
  p_user_id INTEGER,
  p_feature_code VARCHAR(50),
  p_amount INTEGER DEFAULT 1
) RETURNS BOOLEAN AS $$
DECLARE
  v_period_start TIMESTAMP;
  v_period_end TIMESTAMP;
  v_reset_period VARCHAR(20);
  v_subscription_end TIMESTAMP;
BEGIN
  -- 获取用户订阅结束时间
  SELECT end_date INTO v_subscription_end
  FROM user_subscriptions
  WHERE user_id = p_user_id 
    AND status = 'active'
    AND end_date > CURRENT_TIMESTAMP
  ORDER BY end_date DESC
  LIMIT 1;
  
  -- 如果没有有效订阅，拒绝记录使用量
  IF v_subscription_end IS NULL THEN
    RAISE EXCEPTION '用户没有有效订阅';
  END IF;
  
  -- 确定重置周期（所有配额都在订阅周期内有效）
  CASE 
    -- 每月重置的配额
    WHEN p_feature_code IN (
      'articles_per_month', 
      'publish_per_month', 
      'keyword_distillation'
    ) THEN
      v_reset_period := 'monthly';
      v_period_start := DATE_TRUNC('month', CURRENT_TIMESTAMP);
      v_period_end := LEAST(
        v_period_start + INTERVAL '1 month',
        v_subscription_end
      );
    
    -- 订阅周期内有效的配额（平台账号、存储空间等）
    WHEN p_feature_code IN ('platform_accounts', 'storage_space') THEN
      v_reset_period := 'subscription';
      -- 使用订阅开始时间作为周期开始
      SELECT start_date INTO v_period_start
      FROM user_subscriptions
      WHERE user_id = p_user_id 
        AND status = 'active'
        AND end_date > CURRENT_TIMESTAMP
      ORDER BY end_date DESC
      LIMIT 1;
      
      v_period_end := v_subscription_end;
    
    -- 其他未知配额类型，默认为月度
    ELSE
      v_reset_period := 'monthly';
      v_period_start := DATE_TRUNC('month', CURRENT_TIMESTAMP);
      v_period_end := LEAST(
        v_period_start + INTERVAL '1 month',
        v_subscription_end
      );
  END CASE;
  
  -- 更新统计
  INSERT INTO user_usage (user_id, feature_code, usage_count, period_start, period_end, last_reset_at)
  VALUES (p_user_id, p_feature_code, p_amount, v_period_start, v_period_end, v_period_start)
  ON CONFLICT (user_id, feature_code, period_start)
  DO UPDATE SET 
    usage_count = user_usage.usage_count + p_amount,
    updated_at = CURRENT_TIMESTAMP;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION record_feature_usage IS '记录功能使用量 - 所有配额都与订阅周期绑定';

-- 2. 更新 check_feature_quota 函数 - 添加订阅到期检查
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
  v_period_start TIMESTAMP;
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
  
  -- 获取当前使用量
  SELECT COALESCE(uu.usage_count, 0)
  INTO v_current_usage
  FROM user_usage uu
  WHERE uu.user_id = p_user_id 
    AND uu.feature_code = p_feature_code
    AND uu.period_end > CURRENT_TIMESTAMP
    AND uu.period_end <= v_subscription_end  -- 确保在订阅周期内
  ORDER BY uu.period_start DESC
  LIMIT 1;
  
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

COMMENT ON FUNCTION check_feature_quota IS '检查功能配额 - 验证订阅有效性和配额限制';

-- 3. 更新 get_user_storage_quota 函数 - 添加订阅到期检查
CREATE OR REPLACE FUNCTION get_user_storage_quota(p_user_id INTEGER)
RETURNS BIGINT AS $$
DECLARE
  v_plan_id INTEGER;
  v_quota_bytes BIGINT;
  v_custom_quotas JSONB;
  v_subscription_end TIMESTAMP;
  v_user_role VARCHAR(50);
BEGIN
  -- 检查用户角色
  SELECT role INTO v_user_role FROM users WHERE id = p_user_id;
  
  -- 管理员获得 10GB 存储（但仍受订阅限制）
  IF v_user_role = 'admin' THEN
    -- 检查管理员是否有有效订阅
    SELECT end_date INTO v_subscription_end
    FROM user_subscriptions
    WHERE user_id = p_user_id 
      AND status = 'active'
      AND end_date > CURRENT_TIMESTAMP
    ORDER BY end_date DESC
    LIMIT 1;
    
    -- 如果管理员没有有效订阅，返回默认配额
    IF v_subscription_end IS NULL THEN
      RETURN 104857600; -- 100MB
    END IF;
    
    RETURN 10737418240; -- 10GB in bytes
  END IF;
  
  -- 获取用户当前有效订阅
  SELECT us.plan_id, us.end_date, us.custom_quotas
  INTO v_plan_id, v_subscription_end, v_custom_quotas
  FROM user_subscriptions us
  WHERE us.user_id = p_user_id 
    AND us.status = 'active'
    AND us.end_date > CURRENT_TIMESTAMP
  ORDER BY us.end_date DESC
  LIMIT 1;
  
  -- 如果没有有效订阅，返回免费版配额
  IF v_plan_id IS NULL THEN
    -- 获取免费版配额
    SELECT pf.feature_value INTO v_quota_bytes
    FROM plan_features pf
    JOIN subscription_plans sp ON sp.id = pf.plan_id
    WHERE sp.plan_code = 'free' AND pf.feature_code = 'storage_space'
    LIMIT 1;
    
    RETURN COALESCE(v_quota_bytes, 104857600); -- 默认100MB
  END IF;
  
  -- 检查是否有自定义存储配额
  IF v_custom_quotas IS NOT NULL AND v_custom_quotas ? 'storage_space' THEN
    v_quota_bytes := (v_custom_quotas->>'storage_space')::BIGINT;
    -- 自定义配额单位是 MB，需要转换为字节
    IF v_quota_bytes > 0 AND v_quota_bytes < 1000000 THEN
      v_quota_bytes := v_quota_bytes * 1024 * 1024;
    END IF;
  ELSE
    -- 获取套餐的存储配额
    SELECT pf.feature_value INTO v_quota_bytes
    FROM plan_features pf
    WHERE pf.plan_id = v_plan_id AND pf.feature_code = 'storage_space';
  END IF;
  
  -- 如果套餐没有定义存储配额，返回默认 100MB
  IF v_quota_bytes IS NULL THEN
    RETURN 104857600; -- 100MB in bytes
  END IF;
  
  RETURN v_quota_bytes;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_storage_quota IS '获取用户存储配额 - 订阅到期后返回0';

-- 4. 创建订阅到期处理函数（退回到免费版）
CREATE OR REPLACE FUNCTION handle_expired_subscriptions()
RETURNS INTEGER AS $$
DECLARE
  v_expired_count INTEGER := 0;
  v_user_record RECORD;
  v_free_plan_id INTEGER;
BEGIN
  -- 获取免费版套餐ID
  SELECT id INTO v_free_plan_id FROM subscription_plans WHERE plan_code = 'free' LIMIT 1;
  
  IF v_free_plan_id IS NULL THEN
    RAISE EXCEPTION '未找到免费版套餐';
  END IF;
  
  -- 查找所有刚过期的订阅（状态仍为 active 但已过期）
  FOR v_user_record IN
    SELECT DISTINCT us.user_id, us.id as subscription_id
    FROM user_subscriptions us
    WHERE us.status = 'active'
      AND us.end_date <= CURRENT_TIMESTAMP
      AND us.end_date > CURRENT_TIMESTAMP - INTERVAL '1 day'
      AND us.plan_id != v_free_plan_id  -- 排除已经是免费版的
  LOOP
    -- 更新订阅状态为已过期
    UPDATE user_subscriptions
    SET status = 'expired', updated_at = CURRENT_TIMESTAMP
    WHERE id = v_user_record.subscription_id;
    
    -- 创建免费版订阅（永久有效）
    INSERT INTO user_subscriptions (
      user_id, plan_id, status, start_date, end_date
    ) VALUES (
      v_user_record.user_id, 
      v_free_plan_id, 
      'active', 
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP + INTERVAL '100 years'  -- 免费版永久有效
    );
    
    -- 清除该用户的所有配额使用记录（重置为免费版配额）
    DELETE FROM user_usage
    WHERE user_id = v_user_record.user_id;
    
    -- 更新存储配额为免费版配额
    UPDATE user_storage_usage
    SET storage_quota_bytes = (
      SELECT feature_value 
      FROM plan_features 
      WHERE plan_id = v_free_plan_id AND feature_code = 'storage_space'
    ),
    last_updated_at = CURRENT_TIMESTAMP
    WHERE user_id = v_user_record.user_id;
    
    v_expired_count := v_expired_count + 1;
    
    RAISE NOTICE '用户 % 的订阅已过期，已退回到免费版', v_user_record.user_id;
  END LOOP;
  
  RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION handle_expired_subscriptions IS '处理过期订阅 - 退回到免费版配额';

-- 5. 创建订阅续费处理函数
CREATE OR REPLACE FUNCTION handle_subscription_renewal(
  p_user_id INTEGER,
  p_new_plan_id INTEGER,
  p_duration_days INTEGER
)
RETURNS VOID AS $$
DECLARE
  v_old_subscription_id INTEGER;
  v_new_end_date TIMESTAMP;
BEGIN
  -- 获取当前订阅
  SELECT id INTO v_old_subscription_id
  FROM user_subscriptions
  WHERE user_id = p_user_id
    AND status IN ('active', 'expired')
  ORDER BY end_date DESC
  LIMIT 1;
  
  -- 计算新的结束日期
  v_new_end_date := CURRENT_TIMESTAMP + (p_duration_days || ' days')::INTERVAL;
  
  -- 如果有旧订阅，标记为已完成
  IF v_old_subscription_id IS NOT NULL THEN
    UPDATE user_subscriptions
    SET status = 'completed', updated_at = CURRENT_TIMESTAMP
    WHERE id = v_old_subscription_id;
  END IF;
  
  -- 创建新订阅
  INSERT INTO user_subscriptions (
    user_id, plan_id, status, start_date, end_date
  ) VALUES (
    p_user_id, p_new_plan_id, 'active', CURRENT_TIMESTAMP, v_new_end_date
  );
  
  -- 清除旧的配额使用记录
  DELETE FROM user_usage WHERE user_id = p_user_id;
  
  -- 更新存储配额
  UPDATE user_storage_usage
  SET storage_quota_bytes = get_user_storage_quota(p_user_id),
      last_updated_at = CURRENT_TIMESTAMP
  WHERE user_id = p_user_id;
  
  RAISE NOTICE '用户 % 订阅已续费，配额已重置', p_user_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION handle_subscription_renewal IS '处理订阅续费 - 重置配额和使用量';

-- 6. 更新现有用户的配额周期
-- 将所有 'never' 类型的配额周期更新为订阅周期
UPDATE user_usage uu
SET 
  period_start = us.start_date,
  period_end = us.end_date,
  updated_at = CURRENT_TIMESTAMP
FROM user_subscriptions us
WHERE uu.user_id = us.user_id
  AND us.status = 'active'
  AND us.end_date > CURRENT_TIMESTAMP
  AND uu.period_end > '2099-01-01'::TIMESTAMP  -- 识别永久配额
  AND uu.feature_code IN (
    'platform_accounts',
    'storage_space'
  );

-- 删除相册和知识库的配额记录（不再限制数量）
DELETE FROM user_usage
WHERE feature_code IN ('gallery_albums', 'knowledge_bases');

-- 7. 清理已过期订阅的配额
DELETE FROM user_usage
WHERE user_id IN (
  SELECT user_id
  FROM user_subscriptions
  WHERE status = 'active'
    AND end_date <= CURRENT_TIMESTAMP
);

-- 8. 更新已过期订阅的状态
UPDATE user_subscriptions
SET status = 'expired', updated_at = CURRENT_TIMESTAMP
WHERE status = 'active'
  AND end_date <= CURRENT_TIMESTAMP;

-- ========================================
-- 迁移完成
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ 迁移 030 成功完成';
  RAISE NOTICE '   - 已移除永久配额概念';
  RAISE NOTICE '   - 所有配额现在都与订阅周期绑定';
  RAISE NOTICE '   - record_feature_usage 函数已更新';
  RAISE NOTICE '   - check_feature_quota 函数已更新';
  RAISE NOTICE '   - get_user_storage_quota 函数已更新';
  RAISE NOTICE '   - 已创建订阅到期处理函数';
  RAISE NOTICE '   - 已创建订阅续费处理函数';
  RAISE NOTICE '   - 现有用户配额周期已更新';
  RAISE NOTICE '   - 已过期订阅已清理';
END $$;
