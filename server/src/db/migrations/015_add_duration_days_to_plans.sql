-- ==================== UP ====================
-- Migration: 015_add_duration_days_to_plans
-- Description: 添加 duration_days 字段到 subscription_plans 表
-- Date: 2026-01-04

-- 添加 duration_days 字段（默认30天）
ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS duration_days INTEGER NOT NULL DEFAULT 30;

-- 为现有套餐设置合理的默认值
-- 月付套餐：30天
UPDATE subscription_plans 
SET duration_days = 30 
WHERE billing_cycle = 'monthly' AND duration_days = 30;

-- 年付套餐：365天
UPDATE subscription_plans 
SET duration_days = 365 
WHERE billing_cycle = 'yearly' AND duration_days = 30;

-- 添加注释
COMMENT ON COLUMN subscription_plans.duration_days IS '套餐有效期（天数）';

-- ==================== DOWN ====================
-- 回滚：删除 duration_days 字段

ALTER TABLE subscription_plans 
DROP COLUMN IF EXISTS duration_days;
