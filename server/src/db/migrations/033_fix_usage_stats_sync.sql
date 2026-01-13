-- ==================== UP ====================
-- 迁移 033: 修复配额使用统计同步问题
-- 创建时间: 2026-01-06
-- 更新时间: 2026-01-13 - 修复升级套餐后配额计算问题
-- 问题: 配额扣减后，个人中心的使用统计不同步
-- 原因: 查询使用量时的日期匹配条件有问题
-- 修复: 基于订阅的 quota_reset_anchor 来计算使用量
-- ========================================

BEGIN;

-- 0. 删除不再使用的视图
DROP VIEW IF EXISTS v_user_quota_overview;

-- 1. 修复 get_current_period_usage 函数
-- 基于订阅的 quota_reset_anchor 来计算使用量
-- 这样升级套餐后，使用量会从新订阅的锚点开始计算
CREATE OR REPLACE FUNCTION get_current_period_usage(
  p_user_id INTEGER,
  p_feature_code VARCHAR(50)
) RETURNS INTEGER AS $$
DECLARE
  v_usage INTEGER;
  v_anchor TIMESTAMP;
BEGIN
  -- 获取当前活跃订阅的配额重置锚点
  SELECT quota_reset_anchor INTO v_anchor
  FROM user_subscriptions
  WHERE user_id = p_user_id 
    AND status = 'active'
    AND end_date > CURRENT_TIMESTAMP
  ORDER BY end_date DESC
  LIMIT 1;
  
  -- 如果没有活跃订阅，返回0
  IF v_anchor IS NULL THEN
    RETURN 0;
  END IF;
  
  -- 查找从锚点开始的使用量记录
  SELECT COALESCE(usage_count, 0) INTO v_usage
  FROM user_usage
  WHERE user_id = p_user_id 
    AND feature_code = p_feature_code
    AND last_reset_at >= v_anchor
  ORDER BY last_reset_at DESC
  LIMIT 1;
  
  RETURN COALESCE(v_usage, 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_current_period_usage IS '获取用户当前周期的功能使用量（基于订阅锚点）';

-- 2. 更新 check_user_quota 函数，使用修复后的辅助函数
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
  v_quota_limit INTEGER;
  v_current_usage INTEGER;
  v_custom_quotas JSONB;
  v_plan_feature_value INTEGER;
BEGIN
  -- 获取用户订阅的套餐配额和自定义配额（只取最新的有效订阅）
  SELECT 
    us.custom_quotas,
    pf.feature_value
  INTO v_custom_quotas, v_plan_feature_value
  FROM user_subscriptions us
  JOIN subscription_plans sp ON sp.id = us.plan_id
  JOIN plan_features pf ON pf.plan_id = sp.id AND pf.feature_code = p_feature_code
  WHERE us.user_id = p_user_id 
    AND us.status = 'active'
    AND us.end_date > CURRENT_TIMESTAMP
  ORDER BY us.end_date DESC
  LIMIT 1;
  
  -- 如果没有找到订阅，返回无配额
  IF v_plan_feature_value IS NULL THEN
    RETURN QUERY SELECT false, 0, 0, 0, 0::NUMERIC;
    RETURN;
  END IF;
  
  -- 优先使用自定义配额
  IF v_custom_quotas IS NOT NULL AND v_custom_quotas ? p_feature_code THEN
    v_quota_limit := (v_custom_quotas->>p_feature_code)::INTEGER;
  ELSE
    v_quota_limit := v_plan_feature_value;
  END IF;
  
  -- 获取当前使用量
  v_current_usage := get_current_period_usage(p_user_id, p_feature_code);
  
  -- 返回结果
  RETURN QUERY SELECT 
    CASE WHEN v_quota_limit = -1 THEN true ELSE v_current_usage < v_quota_limit END,
    v_current_usage,
    v_quota_limit,
    CASE WHEN v_quota_limit = -1 THEN -1 ELSE GREATEST(0, v_quota_limit - v_current_usage) END,
    CASE 
      WHEN v_quota_limit = -1 THEN 0
      WHEN v_quota_limit > 0 THEN ROUND((v_current_usage::NUMERIC / v_quota_limit::NUMERIC) * 100, 2)
      ELSE 0
    END;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_user_quota IS '检查用户配额';

-- 3. 验证修复
DO $$
BEGIN
  RAISE NOTICE '✅ 迁移 033 完成: 修复配额使用统计同步';
  RAISE NOTICE '   - 删除 v_user_quota_overview 视图（改用直接查询）';
  RAISE NOTICE '   - get_current_period_usage: 基于订阅锚点计算使用量';
  RAISE NOTICE '   - check_user_quota: 调用修复后的辅助函数';
END $$;

COMMIT;

-- ==================== DOWN ====================
-- Rollback not implemented for this migration
