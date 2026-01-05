-- 修复配额检查函数的参数不匹配问题
-- 问题：check_user_quota 调用 check_feature_quota 时传递了3个参数，但函数只接受2个

BEGIN;

-- 1. 重新创建 check_user_quota 函数，修正函数调用
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
  v_check_result RECORD;
BEGIN
  -- 调用 check_feature_quota 函数（只传递2个参数）
  SELECT * INTO v_check_result
  FROM check_feature_quota(p_user_id, p_feature_code)
  LIMIT 1;
  
  -- 返回结果，字段名匹配 UsageTrackingService 的期望
  RETURN QUERY SELECT
    v_check_result.has_quota,
    v_check_result.current_usage,
    v_check_result.quota_limit,
    v_check_result.remaining,
    CASE 
      WHEN v_check_result.quota_limit = -1 THEN 0::NUMERIC
      WHEN v_check_result.quota_limit = 0 THEN 100::NUMERIC
      ELSE ROUND((v_check_result.current_usage::NUMERIC / v_check_result.quota_limit::NUMERIC) * 100, 2)
    END as percentage;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_user_quota IS '检查用户配额 - 兼容 UsageTrackingService 的字段名';

COMMIT;

-- 验证修复
DO $$
DECLARE
  v_result RECORD;
BEGIN
  -- 测试函数调用
  SELECT * INTO v_result FROM check_user_quota(1, 'articles_per_month');
  
  RAISE NOTICE '✅ 配额函数修复成功';
  RAISE NOTICE '   has_quota: %', v_result.has_quota;
  RAISE NOTICE '   current_usage: %', v_result.current_usage;
  RAISE NOTICE '   quota_limit: %', v_result.quota_limit;
  RAISE NOTICE '   remaining: %', v_result.remaining;
  RAISE NOTICE '   percentage: %', v_result.percentage;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '❌ 配额函数修复失败: %', SQLERRM;
END $$;
