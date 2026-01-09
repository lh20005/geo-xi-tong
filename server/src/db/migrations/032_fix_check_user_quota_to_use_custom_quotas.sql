-- ==================== UP ====================
-- ========================================
-- 迁移 032: 修复 check_user_quota 函数以支持 custom_quotas
-- 创建时间: 2026-01-05
-- 描述: 修复配额检查函数，优先使用 user_subscriptions.custom_quotas，确保配额调整后立即生效
-- 问题: 调整配额后，生成文章页面仍显示配额不足，因为函数没有读取 custom_quotas
-- ========================================

BEGIN;

-- 更新 check_user_quota 函数，优先使用 custom_quotas
CREATE OR REPLACE FUNCTION check_user_quota(
  p_user_id INTEGER,
  p_feature_code VARCHAR(50)
) RETURNS TABLE (
  has_quota BOOLEAN,
  current_usage INTEGER,
  quota_limit INTEGER,
  remaining INTEGER,
  percentage NUMERIC
) AS $$
DECLARE
  v_subscription_id INTEGER;
  v_plan_id INTEGER;
  v_custom_quotas JSONB;
  v_feature_value INTEGER;
  v_current_usage INTEGER;
  v_period_start TIMESTAMP;
BEGIN
  -- 获取用户当前订阅和自定义配额
  SELECT us.id, us.plan_id, us.custom_quotas 
  INTO v_subscription_id, v_plan_id, v_custom_quotas
  FROM user_subscriptions us
  WHERE us.user_id = p_user_id 
    AND us.status = 'active'
    AND us.end_date > CURRENT_TIMESTAMP
  ORDER BY us.end_date DESC
  LIMIT 1;
  
  -- 如果没有订阅，返回无配额
  IF v_plan_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 0, 0, 0::NUMERIC;
    RETURN;
  END IF;
  
  -- 优先使用 custom_quotas（如果存在）
  IF v_custom_quotas IS NOT NULL AND v_custom_quotas ? p_feature_code THEN
    v_feature_value := (v_custom_quotas->>p_feature_code)::INTEGER;
    
    -- 如果 custom_quotas 中有该功能，直接使用
    -- 无需再查询 plan_features
  ELSE
    -- 如果没有自定义配额，从 plan_features 获取
    SELECT pf.feature_value INTO v_feature_value
    FROM plan_features pf
    WHERE pf.plan_id = v_plan_id AND pf.feature_code = p_feature_code;
    
    -- 如果功能不存在于 plan_features，使用默认值
    IF v_feature_value IS NULL THEN
      CASE p_feature_code
        WHEN 'articles_per_month' THEN v_feature_value := 100;
        WHEN 'publish_per_month' THEN v_feature_value := 200;
        WHEN 'platform_accounts' THEN v_feature_value := 1;
        WHEN 'keyword_distillation' THEN v_feature_value := 50;
        WHEN 'storage_space' THEN v_feature_value := 100;
        WHEN 'gallery_albums' THEN v_feature_value := 10;
        WHEN 'knowledge_bases' THEN v_feature_value := 5;
        ELSE
          -- 未知功能，返回无配额
          RETURN QUERY SELECT FALSE, 0, 0, 0, 0::NUMERIC;
          RETURN;
      END CASE;
    END IF;
  END IF;
  
  -- 无限制配额
  IF v_feature_value = -1 THEN
    RETURN QUERY SELECT TRUE, 0, -1, -1, 0::NUMERIC;
    RETURN;
  END IF;
  
  -- 获取当前使用量
  SELECT COALESCE(uu.usage_count, 0), uu.period_start 
  INTO v_current_usage, v_period_start
  FROM user_usage uu
  WHERE uu.user_id = p_user_id 
    AND uu.feature_code = p_feature_code
    AND uu.period_end > CURRENT_TIMESTAMP
  ORDER BY uu.period_start DESC
  LIMIT 1;
  
  -- 如果没有使用记录，初始化为0
  IF v_current_usage IS NULL THEN
    v_current_usage := 0;
  END IF;
  
  -- 返回配额信息
  RETURN QUERY SELECT 
    (v_current_usage < v_feature_value) AS has_quota,
    v_current_usage,
    v_feature_value,
    GREATEST(0, v_feature_value - v_current_usage) AS remaining,
    CASE 
      WHEN v_feature_value > 0 THEN ROUND((v_current_usage::NUMERIC / v_feature_value::NUMERIC) * 100, 2)
      ELSE 0::NUMERIC
    END AS percentage;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_user_quota IS '检查用户配额 - 优先使用 custom_quotas，确保配额调整立即生效';

COMMIT;

-- ========================================
-- 验证迁移
-- ========================================

DO $$
DECLARE
  v_test_user_id INTEGER;
  v_custom_quota INTEGER;
  v_check_result RECORD;
BEGIN
  -- 查找有 custom_quotas 的测试用户
  SELECT us.user_id, (us.custom_quotas->>'articles_per_month')::INTEGER
  INTO v_test_user_id, v_custom_quota
  FROM user_subscriptions us
  WHERE us.custom_quotas IS NOT NULL 
    AND us.custom_quotas ? 'articles_per_month'
    AND us.status = 'active'
    AND us.end_date > CURRENT_TIMESTAMP
  LIMIT 1;
  
  IF v_test_user_id IS NOT NULL THEN
    -- 测试函数是否正确读取 custom_quotas
    SELECT * INTO v_check_result
    FROM check_user_quota(v_test_user_id, 'articles_per_month');
    
    IF v_check_result.quota_limit = v_custom_quota THEN
      RAISE NOTICE '✅ 迁移 032 成功完成';
      RAISE NOTICE '   - 更新了 check_user_quota 函数';
      RAISE NOTICE '   - 函数现在优先使用 custom_quotas';
      RAISE NOTICE '   - 测试用户 % 的配额: custom_quotas=%, check_user_quota=%', 
        v_test_user_id, v_custom_quota, v_check_result.quota_limit;
      RAISE NOTICE '   - ✅ 配额一致！';
    ELSE
      RAISE WARNING '⚠️  迁移 032 完成，但配额不一致';
      RAISE WARNING '   custom_quotas: %, check_user_quota: %', 
        v_custom_quota, v_check_result.quota_limit;
    END IF;
  ELSE
    RAISE NOTICE '✅ 迁移 032 成功完成';
    RAISE NOTICE '   - 更新了 check_user_quota 函数';
    RAISE NOTICE '   - 函数现在优先使用 custom_quotas';
    RAISE NOTICE '   - 未找到测试用户，跳过验证';
  END IF;
END $$;

-- ==================== DOWN ====================
-- Rollback not implemented for this migration
