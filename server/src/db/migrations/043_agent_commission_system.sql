-- ==================== UP ====================
-- 代理商分佣系统数据库迁移
-- Migration: 043_agent_commission_system.sql
-- Description: 创建代理商、佣金记录、分账记录表

-- ============================================
-- 1. 代理商表 (agents)
-- ============================================
CREATE TABLE IF NOT EXISTS agents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitation_code VARCHAR(20) UNIQUE,  -- 邀请码（从用户表复制）
  status VARCHAR(20) NOT NULL DEFAULT 'active',  -- active/suspended（无需审核，直接激活）
  commission_rate DECIMAL(5,4) NOT NULL DEFAULT 0.30,  -- 默认30%（微信支付最大比例）
  wechat_openid VARCHAR(128),  -- 微信OpenID（用于分账）
  wechat_nickname VARCHAR(100),  -- 微信昵称
  wechat_bindtime TIMESTAMP,  -- 绑定时间
  receiver_added BOOLEAN DEFAULT FALSE,  -- 是否已添加为分账接收方
  total_earnings DECIMAL(12,2) DEFAULT 0,  -- 累计收益
  settled_earnings DECIMAL(12,2) DEFAULT 0,  -- 已结算收益
  pending_earnings DECIMAL(12,2) DEFAULT 0,  -- 待结算收益
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 代理商表索引
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_wechat_openid ON agents(wechat_openid);
CREATE INDEX IF NOT EXISTS idx_agents_invitation_code ON agents(invitation_code);

-- ============================================
-- 1.5 修改 users 表添加邀请关联字段
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by_agent INTEGER REFERENCES agents(id);
CREATE INDEX IF NOT EXISTS idx_users_invited_by_agent ON users(invited_by_agent);

-- ============================================
-- 2. 佣金记录表 (commission_records)
-- ============================================
CREATE TABLE IF NOT EXISTS commission_records (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  invited_user_id INTEGER NOT NULL REFERENCES users(id),
  order_amount DECIMAL(12,2) NOT NULL,  -- 订单金额
  commission_rate DECIMAL(5,4) NOT NULL,  -- 佣金比例（快照）
  commission_amount DECIMAL(12,2) NOT NULL,  -- 佣金金额
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending/settled/cancelled/refunded
  settle_date DATE,  -- 预计结算日期（T+1）
  settled_at TIMESTAMP,  -- 实际结算时间
  fail_reason TEXT,  -- 失败原因
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 佣金记录表索引
CREATE INDEX IF NOT EXISTS idx_commission_agent_id ON commission_records(agent_id);
CREATE INDEX IF NOT EXISTS idx_commission_order_id ON commission_records(order_id);
CREATE INDEX IF NOT EXISTS idx_commission_status ON commission_records(status);
CREATE INDEX IF NOT EXISTS idx_commission_status_settle_date ON commission_records(status, settle_date);
CREATE INDEX IF NOT EXISTS idx_commission_invited_user ON commission_records(invited_user_id);

-- ============================================
-- 3. 分账记录表 (profit_sharing_records)
-- ============================================
CREATE TABLE IF NOT EXISTS profit_sharing_records (
  id SERIAL PRIMARY KEY,
  commission_id INTEGER NOT NULL REFERENCES commission_records(id),
  transaction_id VARCHAR(64) NOT NULL,  -- 微信支付订单号
  out_order_no VARCHAR(64) NOT NULL,  -- 商户分账单号
  wechat_order_id VARCHAR(64),  -- 微信分账单号
  amount INTEGER NOT NULL,  -- 分账金额（分）
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending/processing/success/failed
  fail_reason TEXT,
  retry_count INTEGER DEFAULT 0,  -- 查询重试次数
  request_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  finish_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 分账记录表索引
CREATE INDEX IF NOT EXISTS idx_profit_sharing_commission_id ON profit_sharing_records(commission_id);
CREATE INDEX IF NOT EXISTS idx_profit_sharing_out_order_no ON profit_sharing_records(out_order_no);
CREATE INDEX IF NOT EXISTS idx_profit_sharing_status ON profit_sharing_records(status);
CREATE INDEX IF NOT EXISTS idx_profit_sharing_transaction_id ON profit_sharing_records(transaction_id);

-- ============================================
-- 4. 修改 orders 表添加分账相关字段
-- ============================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS agent_id INTEGER REFERENCES agents(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS profit_sharing BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS expected_commission DECIMAL(12,2);

-- orders 表分账相关索引
CREATE INDEX IF NOT EXISTS idx_orders_agent_id ON orders(agent_id);
CREATE INDEX IF NOT EXISTS idx_orders_profit_sharing ON orders(profit_sharing);

-- ============================================
-- 5. 代理商统计更新触发器
-- ============================================
CREATE OR REPLACE FUNCTION update_agent_earnings()
RETURNS TRIGGER AS $$
BEGIN
  -- 更新代理商的收益统计
  UPDATE agents SET
    total_earnings = (
      SELECT COALESCE(SUM(commission_amount), 0)
      FROM commission_records
      WHERE agent_id = NEW.agent_id
      AND status IN ('pending', 'settled')
    ),
    settled_earnings = (
      SELECT COALESCE(SUM(commission_amount), 0)
      FROM commission_records
      WHERE agent_id = NEW.agent_id
      AND status = 'settled'
    ),
    pending_earnings = (
      SELECT COALESCE(SUM(commission_amount), 0)
      FROM commission_records
      WHERE agent_id = NEW.agent_id
      AND status = 'pending'
    ),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.agent_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_update_agent_earnings ON commission_records;
CREATE TRIGGER trigger_update_agent_earnings
AFTER INSERT OR UPDATE ON commission_records
FOR EACH ROW
EXECUTE FUNCTION update_agent_earnings();

-- ============================================
-- 6. 代理商审计日志表
-- ============================================
CREATE TABLE IF NOT EXISTS agent_audit_logs (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER REFERENCES agents(id),
  action_type VARCHAR(50) NOT NULL,  -- apply/bindWechat/unbindWechat/suspend/resume/delete/rateChange
  operator_id INTEGER REFERENCES users(id),  -- 操作者（管理员或用户自己）
  old_value JSONB,
  new_value JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_audit_agent_id ON agent_audit_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_audit_action_type ON agent_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_agent_audit_created_at ON agent_audit_logs(created_at);

-- ==================== DOWN ====================
-- 回滚迁移

-- 删除触发器
DROP TRIGGER IF EXISTS trigger_update_agent_earnings ON commission_records;
DROP FUNCTION IF EXISTS update_agent_earnings();

-- 删除 orders 表的分账字段
ALTER TABLE orders DROP COLUMN IF EXISTS agent_id;
ALTER TABLE orders DROP COLUMN IF EXISTS profit_sharing;
ALTER TABLE orders DROP COLUMN IF EXISTS expected_commission;

-- 删除索引
DROP INDEX IF EXISTS idx_orders_agent_id;
DROP INDEX IF EXISTS idx_orders_profit_sharing;

-- 删除表（按依赖顺序）
DROP TABLE IF EXISTS agent_audit_logs;
DROP TABLE IF EXISTS profit_sharing_records;
DROP TABLE IF EXISTS commission_records;
DROP TABLE IF EXISTS agents;
