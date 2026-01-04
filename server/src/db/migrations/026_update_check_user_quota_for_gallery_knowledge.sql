-- 迁移 026: 更新 check_user_quota 函数以支持企业图库和知识库
-- 创建时间: 2026-01-04
-- 说明: 为 gallery_albums 和 knowledge_bases 添加默认配额支持

-- 更新 check_user_quota 函数，添加对新功能的默认配额支持
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
  v_feature_value INTEGER;
  v_current_usage INTEGER;
  v_period_start TIMESTAMP;
BEGIN
  -- 获取用户当前订阅
  SELECT us.id, us.plan_id INTO v_subscription_id, v_plan_id
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
  
  -- 获取功能配额
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

COMMENT ON FUNCTION check_user_quota IS '检查用户配额函数 - 支持所有功能类型（包括图库和知识库）的默认配额';

-- 验证函数更新
DO $$
BEGIN
  RAISE NOTICE '✅ check_user_quota 函数已更新';
  RAISE NOTICE '   现在支持 gallery_albums (默认: 10) 和 knowledge_bases (默认: 5)';
END $$;
