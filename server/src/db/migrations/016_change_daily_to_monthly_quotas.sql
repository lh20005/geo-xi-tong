-- Migration: 016_change_daily_to_monthly_quotas
-- Description: 将每日配额改为每月配额
-- Date: 2026-01-04

-- 1. 更新 plan_features 表中的功能代码和名称
UPDATE plan_features 
SET 
  feature_code = 'articles_per_month',
  feature_name = '每月生成文章数',
  feature_value = feature_value * 30  -- 每日 * 30 = 每月
WHERE feature_code = 'articles_per_day';

UPDATE plan_features 
SET 
  feature_code = 'publish_per_month',
  feature_name = '每月发布文章数',
  feature_value = feature_value * 30  -- 每日 * 30 = 每月
WHERE feature_code = 'publish_per_day';

-- 2. 更新 user_usage 表中的功能代码
UPDATE user_usage 
SET feature_code = 'articles_per_month'
WHERE feature_code = 'articles_per_day';

UPDATE user_usage 
SET feature_code = 'publish_per_month'
WHERE feature_code = 'publish_per_day';

-- 3. 更新 quota_alerts 表中的功能代码
UPDATE quota_alerts 
SET feature_code = 'articles_per_month'
WHERE feature_code = 'articles_per_day';

UPDATE quota_alerts 
SET feature_code = 'publish_per_month'
WHERE feature_code = 'publish_per_day';

-- 4. 添加注释
COMMENT ON COLUMN plan_features.feature_code IS '功能代码：articles_per_month, publish_per_month, platform_accounts, keyword_distillation';
COMMENT ON COLUMN user_usage.feature_code IS '功能代码：articles_per_month, publish_per_month, platform_accounts, keyword_distillation';
COMMENT ON COLUMN quota_alerts.feature_code IS '功能代码：articles_per_month, publish_per_month, platform_accounts, keyword_distillation';
