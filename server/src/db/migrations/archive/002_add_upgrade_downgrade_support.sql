-- 添加升级支持

-- 在 orders 表中添加 order_type 字段
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'purchase' CHECK (order_type IN ('purchase', 'upgrade', 'renew'));

-- 添加注释
COMMENT ON COLUMN orders.order_type IS '订单类型：purchase-购买，upgrade-升级，renew-续费';
