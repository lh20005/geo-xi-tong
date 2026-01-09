-- ==================== UP ====================
-- 迁移 046: 在套餐表增加配额重置周期字段
-- 创建时间: 2026-01-09
-- 描述: 允许在商品管理中独立配置套餐的配额重置周期

-- 1. 在 subscription_plans 表增加 quota_cycle_type 字段
ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS quota_cycle_type VARCHAR(20) DEFAULT 'monthly';

COMMENT ON COLUMN subscription_plans.quota_cycle_type IS '配额重置周期：monthly(月度), yearly(年度)';

-- 2. 初始化现有套餐的 quota_cycle_type（从 billing_cycle 继承）
UPDATE subscription_plans 
SET quota_cycle_type = COALESCE(billing_cycle, 'monthly')
WHERE quota_cycle_type IS NULL OR quota_cycle_type = '';

-- 3. 更新触发器：订阅创建时从套餐的 quota_cycle_type 继承
CREATE OR REPLACE FUNCTION set_quota_cycle_on_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- 从套餐获取 quota_cycle_type（优先）或 billing_cycle
  SELECT COALESCE(quota_cycle_type, billing_cycle, 'monthly') 
  INTO NEW.quota_cycle_type
  FROM subscription_plans
  WHERE id = NEW.plan_id;
  
  -- 如果没有设置锚点，使用订阅开始时间
  IF NEW.quota_reset_anchor IS NULL THEN
    NEW.quota_reset_anchor := COALESCE(NEW.start_date, CURRENT_TIMESTAMP);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 确保触发器存在
DROP TRIGGER IF EXISTS trigger_set_quota_cycle ON user_subscriptions;
CREATE TRIGGER trigger_set_quota_cycle
  BEFORE INSERT ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION set_quota_cycle_on_subscription();

COMMENT ON FUNCTION set_quota_cycle_on_subscription IS '订阅创建时自动从套餐继承配额重置周期';

-- 4. 创建函数：更新现有用户订阅的配额周期（当套餐配置变更时调用）
CREATE OR REPLACE FUNCTION sync_subscription_quota_cycle(p_plan_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_quota_cycle_type VARCHAR(20);
  v_updated_count INTEGER;
BEGIN
  -- 获取套餐的配额周期类型
  SELECT quota_cycle_type INTO v_quota_cycle_type
  FROM subscription_plans
  WHERE id = p_plan_id;
  
  IF v_quota_cycle_type IS NULL THEN
    RETURN 0;
  END IF;
  
  -- 更新所有使用该套餐的活跃订阅
  UPDATE user_subscriptions
  SET quota_cycle_type = v_quota_cycle_type,
      updated_at = CURRENT_TIMESTAMP
  WHERE plan_id = p_plan_id
    AND status = 'active'
    AND quota_cycle_type != v_quota_cycle_type;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_subscription_quota_cycle IS '同步套餐配额周期到所有活跃订阅';

-- ==================== DOWN ====================
-- 回滚迁移

-- 删除同步函数
DROP FUNCTION IF EXISTS sync_subscription_quota_cycle(INTEGER);

-- 恢复原始触发器函数
CREATE OR REPLACE FUNCTION set_quota_cycle_on_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- 从套餐获取 billing_cycle 并设置为 quota_cycle_type
  SELECT billing_cycle INTO NEW.quota_cycle_type
  FROM subscription_plans
  WHERE id = NEW.plan_id;
  
  -- 如果没有设置锚点，使用订阅开始时间
  IF NEW.quota_reset_anchor IS NULL THEN
    NEW.quota_reset_anchor := NEW.start_date;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 删除 quota_cycle_type 字段
ALTER TABLE subscription_plans DROP COLUMN IF EXISTS quota_cycle_type;
