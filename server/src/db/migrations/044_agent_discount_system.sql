-- ==================== UP ====================
-- 代理商折扣系统数据库迁移
-- Migration: 044_agent_discount_system.sql
-- Description: 为套餐添加代理商折扣配置，为订单添加折扣记录，为用户添加首次购买折扣标记

-- ============================================
-- 1. 为 subscription_plans 表添加代理商折扣字段
-- ============================================
ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS agent_discount_rate INTEGER DEFAULT 100;

-- 添加约束：折扣比例必须在 1-100 之间
-- 100 表示无折扣，80 表示 8 折（支付原价的 80%）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_agent_discount_rate'
  ) THEN
    ALTER TABLE subscription_plans 
    ADD CONSTRAINT chk_agent_discount_rate 
    CHECK (agent_discount_rate >= 1 AND agent_discount_rate <= 100);
  END IF;
END $$;

-- 添加注释
COMMENT ON COLUMN subscription_plans.agent_discount_rate IS '代理商折扣比例（1-100），100表示无折扣，80表示8折';

-- ============================================
-- 2. 为 orders 表添加折扣相关字段
-- ============================================
-- 原价（折扣前的价格）
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS original_price DECIMAL(12,2);

-- 使用的折扣比例
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS discount_rate INTEGER DEFAULT 100;

-- 是否使用代理商折扣
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS is_agent_discount BOOLEAN DEFAULT FALSE;

-- 添加注释
COMMENT ON COLUMN orders.original_price IS '原价（折扣前的价格）';
COMMENT ON COLUMN orders.discount_rate IS '使用的折扣比例（1-100）';
COMMENT ON COLUMN orders.is_agent_discount IS '是否使用代理商折扣';

-- ============================================
-- 3. 为 users 表添加首次购买折扣使用标记
-- ============================================
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS first_purchase_discount_used BOOLEAN DEFAULT FALSE;

-- 添加注释
COMMENT ON COLUMN users.first_purchase_discount_used IS '是否已使用首次购买折扣';

-- ============================================
-- 4. 创建索引优化查询
-- ============================================
-- 订单折扣索引（用于统计代理商折扣订单）
CREATE INDEX IF NOT EXISTS idx_orders_is_agent_discount 
ON orders(is_agent_discount) WHERE is_agent_discount = TRUE;

-- 用户首次购买折扣索引
CREATE INDEX IF NOT EXISTS idx_users_first_purchase_discount 
ON users(first_purchase_discount_used);

-- 套餐折扣比例索引（用于快速查询有折扣的套餐）
CREATE INDEX IF NOT EXISTS idx_subscription_plans_agent_discount 
ON subscription_plans(agent_discount_rate) WHERE agent_discount_rate < 100;

-- ==================== DOWN ====================
-- 回滚迁移

-- 删除索引
DROP INDEX IF EXISTS idx_orders_is_agent_discount;
DROP INDEX IF EXISTS idx_users_first_purchase_discount;
DROP INDEX IF EXISTS idx_subscription_plans_agent_discount;

-- 删除 users 表的首次购买折扣字段
ALTER TABLE users DROP COLUMN IF EXISTS first_purchase_discount_used;

-- 删除 orders 表的折扣字段
ALTER TABLE orders DROP COLUMN IF EXISTS original_price;
ALTER TABLE orders DROP COLUMN IF EXISTS discount_rate;
ALTER TABLE orders DROP COLUMN IF EXISTS is_agent_discount;

-- 删除 subscription_plans 表的折扣字段和约束
ALTER TABLE subscription_plans DROP CONSTRAINT IF EXISTS chk_agent_discount_rate;
ALTER TABLE subscription_plans DROP COLUMN IF EXISTS agent_discount_rate;
