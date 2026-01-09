-- 修复配额周期判断
-- 将 articles_per_day 和 publish_per_day 改为 articles_per_month 和 publish_per_month

-- 1. 更新 record_feature_usage 函数
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
    -- ✅ 修复：使用 _per_month 而不是 _per_day
    WHEN 'articles_per_month', 'publish_per_month', 'keyword_distillation' THEN
      v_reset_period := 'monthly';
      v_period_start := DATE_TRUNC('month', CURRENT_TIMESTAMP);
      v_period_end := v_period_start + INTERVAL '1 month';
    ELSE
      -- 平台账号等不重置的配额
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

COMMENT ON FUNCTION record_feature_usage IS '记录功能使用量函数 - 修复后支持月度配额';

-- 2. 清理过期的使用记录
DELETE FROM user_usage 
WHERE period_end < CURRENT_TIMESTAMP;

-- 3. 为所有用户初始化当前月份的使用记录
INSERT INTO user_usage (user_id, feature_code, usage_count, period_start, period_end, last_reset_at)
SELECT 
  u.id,
  feature_code,
  0,
  DATE_TRUNC('month', CURRENT_TIMESTAMP),
  DATE_TRUNC('month', CURRENT_TIMESTAMP) + INTERVAL '1 month',
  DATE_TRUNC('month', CURRENT_TIMESTAMP)
FROM users u
CROSS JOIN (
  VALUES 
    ('articles_per_month'),
    ('publish_per_month'),
    ('keyword_distillation')
) AS features(feature_code)
WHERE NOT EXISTS (
  SELECT 1 FROM user_usage uu 
  WHERE uu.user_id = u.id 
    AND uu.feature_code = features.feature_code
    AND uu.period_end > CURRENT_TIMESTAMP
)
ON CONFLICT (user_id, feature_code, period_start) DO NOTHING;

-- 4. 记录迁移
INSERT INTO schema_migrations (version, name, executed_at)
VALUES ('021', 'fix_quota_period', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;

-- ==================== DOWN ====================
-- Rollback not implemented for this migration
