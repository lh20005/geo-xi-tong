-- Migration: 添加存储购买表
-- Description: 支持用户购买额外存储空间
-- Date: 2026-01-04

-- 创建存储购买表
CREATE TABLE IF NOT EXISTS storage_purchases (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  storage_bytes BIGINT NOT NULL,
  expiration_date TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  activated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_storage_purchases_user_id ON storage_purchases(user_id);
CREATE INDEX idx_storage_purchases_order_id ON storage_purchases(order_id);
CREATE INDEX idx_storage_purchases_status ON storage_purchases(status);
CREATE INDEX idx_storage_purchases_expiration ON storage_purchases(expiration_date);

-- 添加注释
COMMENT ON TABLE storage_purchases IS '存储空间购买记录';
COMMENT ON COLUMN storage_purchases.user_id IS '用户ID';
COMMENT ON COLUMN storage_purchases.order_id IS '订单ID';
COMMENT ON COLUMN storage_purchases.storage_bytes IS '购买的存储空间（字节）';
COMMENT ON COLUMN storage_purchases.expiration_date IS '过期时间';
COMMENT ON COLUMN storage_purchases.status IS '状态: pending, active, expired, cancelled';
COMMENT ON COLUMN storage_purchases.activated_at IS '激活时间';

-- 创建触发器：订单支付成功后自动激活存储
CREATE OR REPLACE FUNCTION activate_storage_purchase()
RETURNS TRIGGER AS $$
BEGIN
  -- 当订单状态变为 paid 时，激活对应的存储购买
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    UPDATE storage_purchases
    SET 
      status = 'active',
      activated_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE order_id = NEW.id AND status = 'pending';
    
    -- 将购买的存储添加到用户配额
    UPDATE user_storage_usage
    SET 
      purchased_storage_bytes = purchased_storage_bytes + (
        SELECT COALESCE(SUM(storage_bytes), 0)
        FROM storage_purchases
        WHERE order_id = NEW.id AND status = 'active'
      ),
      last_updated_at = CURRENT_TIMESTAMP
    WHERE user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_activate_storage_purchase
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION activate_storage_purchase();

-- 创建函数：检查并处理过期的存储购买
CREATE OR REPLACE FUNCTION expire_storage_purchases()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER := 0;
  purchase_record RECORD;
BEGIN
  -- 查找所有已过期但状态仍为 active 的购买记录
  FOR purchase_record IN
    SELECT id, user_id, storage_bytes
    FROM storage_purchases
    WHERE status = 'active' 
      AND expiration_date IS NOT NULL 
      AND expiration_date < CURRENT_TIMESTAMP
  LOOP
    -- 更新购买记录状态
    UPDATE storage_purchases
    SET status = 'expired', updated_at = CURRENT_TIMESTAMP
    WHERE id = purchase_record.id;
    
    -- 从用户配额中减去过期的存储
    UPDATE user_storage_usage
    SET 
      purchased_storage_bytes = GREATEST(0, purchased_storage_bytes - purchase_record.storage_bytes),
      last_updated_at = CURRENT_TIMESTAMP
    WHERE user_id = purchase_record.user_id;
    
    expired_count := expired_count + 1;
  END LOOP;
  
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION expire_storage_purchases() IS '检查并处理过期的存储购买，返回处理的记录数';
