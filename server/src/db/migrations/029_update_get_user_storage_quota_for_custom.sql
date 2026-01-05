-- ========================================
-- 迁移 029: 更新 get_user_storage_quota 函数以支持自定义配额
-- 创建时间: 2026-01-05
-- 描述: 修改函数优先使用 custom_quotas，如果没有则使用套餐默认配额
-- ========================================

BEGIN;

-- 更新 get_user_storage_quota 函数
CREATE OR REPLACE FUNCTION get_user_storage_quota(p_user_id INTEGER)
RETURNS BIGINT AS $$
DECLARE
  v_subscription_id INTEGER;
  v_plan_id INTEGER;
  v_custom_quotas JSONB;
  v_custom_quota_mb INTEGER;
  v_quota_value BIGINT;
  v_quota_unit VARCHAR(20);
  v_quota_bytes BIGINT;
  v_user_role VARCHAR(50);
BEGIN
  -- 检查用户角色
  SELECT role INTO v_user_role FROM users WHERE id = p_user_id;
  
  -- 管理员获得 1GB 存储
  IF v_user_role = 'admin' THEN
    RETURN 1073741824; -- 1GB in bytes
  END IF;
  
  -- 获取用户当前订阅的套餐和自定义配额
  SELECT us.id, us.plan_id, us.custom_quotas
  INTO v_subscription_id, v_plan_id, v_custom_quotas
  FROM user_subscriptions us
  WHERE us.user_id = p_user_id 
    AND us.status = 'active'
    AND us.end_date > CURRENT_TIMESTAMP
  ORDER BY us.end_date DESC
  LIMIT 1;
  
  -- 如果没有订阅，返回默认 10MB
  IF v_plan_id IS NULL THEN
    RETURN 10485760; -- 10MB in bytes
  END IF;
  
  -- 优先检查自定义配额
  IF v_custom_quotas IS NOT NULL AND v_custom_quotas ? 'storage_space' THEN
    v_custom_quota_mb := (v_custom_quotas->>'storage_space')::INTEGER;
    
    -- 无限制配额
    IF v_custom_quota_mb = -1 THEN
      RETURN -1;
    END IF;
    
    -- 转换为字节（自定义配额单位是 MB）
    RETURN v_custom_quota_mb::BIGINT * 1024 * 1024;
  END IF;
  
  -- 如果没有自定义配额，使用套餐默认配额
  SELECT pf.feature_value, pf.feature_unit 
  INTO v_quota_value, v_quota_unit
  FROM plan_features pf
  WHERE pf.plan_id = v_plan_id AND pf.feature_code = 'storage_space';
  
  -- 如果套餐没有定义存储配额，返回默认 10MB
  IF v_quota_value IS NULL THEN
    RETURN 10485760;
  END IF;
  
  -- 无限制配额
  IF v_quota_value = -1 THEN
    RETURN -1;
  END IF;
  
  -- 根据单位转换为字节
  IF v_quota_unit = 'MB' THEN
    v_quota_bytes := v_quota_value * 1024 * 1024;
  ELSIF v_quota_unit = 'GB' THEN
    v_quota_bytes := v_quota_value * 1024 * 1024 * 1024;
  ELSIF v_quota_unit = 'bytes' THEN
    v_quota_bytes := v_quota_value;
  ELSE
    -- 默认假设是 MB
    v_quota_bytes := v_quota_value * 1024 * 1024;
  END IF;
  
  RETURN v_quota_bytes;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_storage_quota IS 
  '获取用户的存储配额（字节），优先使用 custom_quotas，否则使用套餐默认配额';

COMMIT;

-- ========================================
-- 验证迁移
-- ========================================

DO $$
DECLARE
  v_test_user_id INTEGER;
  v_quota_bytes BIGINT;
BEGIN
  -- 查找 testuser2
  SELECT id INTO v_test_user_id FROM users WHERE username = 'testuser2';
  
  IF v_test_user_id IS NOT NULL THEN
    -- 测试函数
    SELECT get_user_storage_quota(v_test_user_id) INTO v_quota_bytes;
    
    RAISE NOTICE '✅ 迁移 029 成功完成';
    RAISE NOTICE '   - 更新了 get_user_storage_quota 函数';
    RAISE NOTICE '   - 函数现在优先使用 custom_quotas';
    RAISE NOTICE '   - testuser2 的配额: % MB', v_quota_bytes / (1024 * 1024);
  ELSE
    RAISE NOTICE '✅ 迁移 029 成功完成';
    RAISE NOTICE '   - 更新了 get_user_storage_quota 函数';
  END IF;
END $$;
