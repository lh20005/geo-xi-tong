-- ========================================
-- 迁移 022: 修复配额系统
-- 创建时间: 2026-01-04
-- 描述: 修复 record_feature_usage 函数，支持月度配额
-- ========================================

-- 1. 修复 record_feature_usage 函数，支持月度配额
CREATE OR REPLACE FUNCTION record_feature_usage(
  p_user_id INTEGER,
  p_feature_code VARCHAR(50),
  p_resource_type VARCHAR(50) DEFAULT NULL,
  p_resource_id INTEGER DEFAULT NULL,
  p_amount INTEGER DEFAULT 1,
  p_metadata JSONB DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_period_start TIMESTAMP;
  v_period_end TIMESTAMP;
  v_reset_period VARCHAR(20);
BEGIN
  -- 确定重置周期
  CASE p_feature_code
    -- 月度配额
    WHEN 'articles_per_month', 'publish_per_month', 'keyword_distillation' THEN
      v_reset_period := 'monthly';
      v_period_start := DATE_TRUNC('month', CURRENT_TIMESTAMP);
      v_period_end := v_period_start + INTERVAL '1 month';
    -- 永久配额（如平台账号数）
    ELSE
      v_reset_period := 'never';
      v_period_start := '2000-01-01'::TIMESTAMP;
      v_period_end := '2099-12-31'::TIMESTAMP;
  END CASE;
  
  -- 插入使用记录
  INSERT INTO usage_records (user_id, feature_code, resource_type, resource_id, amount, metadata)
  VALUES (p_user_id, p_feature_code, p_resource_type, p_resource_id, p_amount, p_metadata);
  
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

COMMENT ON FUNCTION record_feature_usage IS '记录功能使用量函数 - 支持月度配额';

-- 2. 修正所有用户的 user_usage 表周期
UPDATE user_usage
SET 
  period_start = DATE_TRUNC('month', CURRENT_DATE),
  period_end = DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month',
  last_reset_at = DATE_TRUNC('month', CURRENT_DATE)
WHERE feature_code IN ('articles_per_month', 'publish_per_month', 'keyword_distillation')
  AND (
    period_end < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    OR period_end > DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '2 month'
  );

-- 3. 重新计算本月使用量
DO $$
DECLARE
  v_user RECORD;
  v_feature VARCHAR(50);
  v_actual_usage INTEGER;
BEGIN
  -- 遍历所有用户和功能
  FOR v_user IN 
    SELECT DISTINCT user_id FROM user_usage 
    WHERE feature_code IN ('articles_per_month', 'publish_per_month')
  LOOP
    FOR v_feature IN 
      SELECT unnest(ARRAY['articles_per_month', 'publish_per_month'])
    LOOP
      -- 计算本月实际使用量
      SELECT COALESCE(SUM(amount), 0) INTO v_actual_usage
      FROM usage_records
      WHERE user_id = v_user.user_id 
        AND feature_code = v_feature
        AND created_at >= DATE_TRUNC('month', CURRENT_DATE);
      
      -- 更新 user_usage 表
      UPDATE user_usage
      SET usage_count = v_actual_usage
      WHERE user_id = v_user.user_id 
        AND feature_code = v_feature
        AND period_start = DATE_TRUNC('month', CURRENT_DATE);
    END LOOP;
  END LOOP;
  
  RAISE NOTICE '✅ 已重新计算所有用户的本月使用量';
END $$;

-- 4. 为所有有订阅但没有 user_usage 记录的用户初始化配额
INSERT INTO user_usage (user_id, feature_code, usage_count, period_start, period_end, last_reset_at)
SELECT 
  us.user_id,
  pf.feature_code,
  0 AS usage_count,
  DATE_TRUNC('month', CURRENT_DATE) AS period_start,
  DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' AS period_end,
  DATE_TRUNC('month', CURRENT_DATE) AS last_reset_at
FROM user_subscriptions us
JOIN plan_features pf ON pf.plan_id = us.plan_id
WHERE us.status = 'active'
  AND us.end_date > CURRENT_TIMESTAMP
  AND pf.feature_code IN ('articles_per_month', 'publish_per_month', 'keyword_distillation')
  AND NOT EXISTS (
    SELECT 1 FROM user_usage uu
    WHERE uu.user_id = us.user_id
      AND uu.feature_code = pf.feature_code
      AND uu.period_start = DATE_TRUNC('month', CURRENT_DATE)
  )
ON CONFLICT (user_id, feature_code, period_start) DO NOTHING;

-- ========================================
-- 迁移完成
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ 迁移 022 成功完成';
  RAISE NOTICE '   - record_feature_usage 函数已更新为支持月度配额';
  RAISE NOTICE '   - 所有用户的配额周期已修正为月度';
  RAISE NOTICE '   - 本月使用量已重新计算';
  RAISE NOTICE '   - 缺失的配额记录已初始化';
END $$;

-- ==================== DOWN ====================
-- Rollback not implemented for this migration
