-- 迁移 025: 更新配额函数以支持企业图库和知识库
-- 创建时间: 2026-01-04
-- 说明: 更新 record_feature_usage 和 check_feature_quota 函数以支持 gallery_albums 和 knowledge_bases

-- 1. 更新 record_feature_usage 函数，添加对 gallery_albums 和 knowledge_bases 的支持
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
    -- 永久配额（如平台账号数、相册数、知识库数）
    WHEN 'platform_accounts', 'gallery_albums', 'knowledge_bases' THEN
      v_reset_period := 'never';
      v_period_start := '2000-01-01'::TIMESTAMP;
      v_period_end := '2099-12-31'::TIMESTAMP;
    -- 默认为永久配额
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

COMMENT ON FUNCTION record_feature_usage IS '记录功能使用量函数 - 支持月度配额和永久配额（包括图库和知识库）';

-- 2. 更新 check_feature_quota 函数（简化版，直接使用默认配额）
CREATE OR REPLACE FUNCTION check_feature_quota(
  p_user_id INTEGER,
  p_feature_code VARCHAR(50)
) RETURNS TABLE (
  has_quota BOOLEAN,
  quota_limit INTEGER,
  current_usage INTEGER,
  remaining INTEGER
) AS $$
DECLARE
  v_quota_limit INTEGER;
  v_current_usage INTEGER;
BEGIN
  -- 使用默认配额值
  CASE p_feature_code
    WHEN 'articles_per_month' THEN v_quota_limit := 100;
    WHEN 'publish_per_month' THEN v_quota_limit := 200;
    WHEN 'platform_accounts' THEN v_quota_limit := 1;
    WHEN 'keyword_distillation' THEN v_quota_limit := 50;
    WHEN 'storage_space' THEN v_quota_limit := 100;
    WHEN 'gallery_albums' THEN v_quota_limit := 10;
    WHEN 'knowledge_bases' THEN v_quota_limit := 5;
    ELSE v_quota_limit := 0;
  END CASE;
  
  -- 获取当前使用量
  SELECT COALESCE(usage_count, 0) INTO v_current_usage
  FROM user_usage
  WHERE user_id = p_user_id
    AND feature_code = p_feature_code
    AND period_end > CURRENT_TIMESTAMP;
  
  -- 如果没有记录，使用量为0
  IF v_current_usage IS NULL THEN
    v_current_usage := 0;
  END IF;
  
  -- 返回结果
  RETURN QUERY SELECT 
    (v_quota_limit - v_current_usage) > 0 AS has_quota,
    v_quota_limit,
    v_current_usage,
    GREATEST(v_quota_limit - v_current_usage, 0) AS remaining;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_feature_quota IS '检查功能配额 - 使用默认配额值（包括图库和知识库）';

-- 3. 验证函数更新
DO $$
BEGIN
  RAISE NOTICE '✅ 配额函数已更新，现在支持 gallery_albums 和 knowledge_bases';
  RAISE NOTICE '   - record_feature_usage: 支持永久配额类型';
  RAISE NOTICE '   - check_feature_quota: 添加默认配额值';
END $$;
