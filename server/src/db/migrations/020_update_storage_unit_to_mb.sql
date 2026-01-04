-- Migration 020: 将存储空间单位从 bytes 改为 MB
-- Description: 更新 plan_features 表中存储空间的单位和值，从字节改为MB，便于用户理解
-- Date: 2026-01-04

BEGIN;

-- 1. 更新现有的存储空间功能配额，将单位从 bytes 改为 MB
-- 100MB (104857600 bytes) -> 100 MB
-- 1GB (1073741824 bytes) -> 1024 MB
-- 无限 (-1) -> -1

UPDATE plan_features
SET 
  feature_value = CASE 
    WHEN feature_value = 104857600 THEN 100  -- 100MB
    WHEN feature_value = 1073741824 THEN 1024  -- 1GB = 1024MB
    WHEN feature_value = -1 THEN -1  -- 无限制
    ELSE ROUND(feature_value / 1048576.0)  -- 其他值：bytes / (1024*1024) = MB
  END,
  feature_unit = 'MB'
WHERE feature_code = 'storage_space' AND feature_unit = 'bytes';

-- 2. 添加注释
COMMENT ON COLUMN plan_features.feature_unit IS '功能单位（如：篇、个、MB等）';

-- 3. 验证更新结果
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM plan_features
  WHERE feature_code = 'storage_space' AND feature_unit = 'MB';
  
  RAISE NOTICE '已更新 % 条存储空间配额记录，单位改为 MB', v_count;
END $$;

COMMIT;

-- 显示更新后的存储空间配额
SELECT 
  sp.plan_name,
  sp.plan_code,
  pf.feature_name,
  pf.feature_value,
  pf.feature_unit,
  CASE 
    WHEN pf.feature_value = -1 THEN '无限制'
    ELSE pf.feature_value || ' ' || pf.feature_unit
  END as display_value
FROM plan_features pf
JOIN subscription_plans sp ON pf.plan_id = sp.id
WHERE pf.feature_code = 'storage_space'
ORDER BY sp.display_order;
