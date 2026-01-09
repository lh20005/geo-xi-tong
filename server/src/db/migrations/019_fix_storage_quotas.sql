-- ========================================
-- 迁移 019: 修复存储配额
-- 创建时间: 2026-01-04
-- 描述: 修复存储配额 - 普通用户20MB，管理员1GB
-- ========================================

-- 1. 更新 get_user_storage_quota 函数
CREATE OR REPLACE FUNCTION get_user_storage_quota(p_user_id INTEGER)
RETURNS BIGINT AS $$
DECLARE
  v_plan_id INTEGER;
  v_quota_bytes BIGINT;
  v_user_role VARCHAR(50);
BEGIN
  -- 检查用户角色
  SELECT role INTO v_user_role FROM users WHERE id = p_user_id;
  
  -- 管理员获得 1GB 存储
  IF v_user_role = 'admin' THEN
    RETURN 1073741824; -- 1GB in bytes
  END IF;
  
  -- 获取用户当前订阅的套餐
  SELECT us.plan_id INTO v_plan_id
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
  
  -- 获取套餐的存储配额
  SELECT pf.feature_value INTO v_quota_bytes
  FROM plan_features pf
  WHERE pf.plan_id = v_plan_id AND pf.feature_code = 'storage_space';
  
  -- 如果套餐没有定义存储配额，返回默认 10MB
  IF v_quota_bytes IS NULL THEN
    RETURN 10485760;
  END IF;
  
  RETURN v_quota_bytes;
END;
$$ LANGUAGE plpgsql;

-- 2. 更新现有管理员用户的存储配额为 1GB
UPDATE user_storage_usage
SET storage_quota_bytes = 1073741824
WHERE user_id IN (
  SELECT id FROM users WHERE role = 'admin'
) AND storage_quota_bytes = -1;

-- 3. 更新现有普通用户的存储配额为 10MB（如果当前是其他值）
UPDATE user_storage_usage
SET storage_quota_bytes = 10485760
WHERE user_id IN (
  SELECT id FROM users WHERE role != 'admin'
) AND storage_quota_bytes NOT IN (
  -- 保留已有订阅套餐的配额
  SELECT pf.feature_value 
  FROM user_subscriptions us
  JOIN plan_features pf ON us.plan_id = pf.plan_id
  WHERE us.user_id = user_storage_usage.user_id
    AND us.status = 'active'
    AND pf.feature_code = 'storage_space'
);

-- ========================================
-- 迁移完成
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✅ 迁移 019 成功完成';
  RAISE NOTICE '   - 已更新 get_user_storage_quota 函数';
  RAISE NOTICE '   - 管理员存储配额已更新为 1GB';
  RAISE NOTICE '   - 普通用户默认存储配额已更新为 10MB';
END $$;

-- ==================== DOWN ====================
-- Rollback not implemented for this migration
