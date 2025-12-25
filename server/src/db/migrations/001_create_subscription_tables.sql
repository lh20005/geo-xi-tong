-- ==================== 商品管理与订阅系统数据库迁移 ====================
-- 创建时间: 2025-01-25
-- 描述: 创建订阅套餐、功能配额、用户订阅、订单、使用量统计、配置历史表

-- 1. 套餐配置表
CREATE TABLE IF NOT EXISTS subscription_plans (
  id SERIAL PRIMARY KEY,
  plan_code VARCHAR(50) UNIQUE NOT NULL,
  plan_name VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  billing_cycle VARCHAR(20) DEFAULT 'monthly',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_plans_code ON subscription_plans(plan_code);
CREATE INDEX idx_plans_active ON subscription_plans(is_active);

-- 2. 套餐功能配额表
CREATE TABLE IF NOT EXISTS plan_features (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER REFERENCES subscription_plans(id) ON DELETE CASCADE,
  feature_code VARCHAR(50) NOT NULL,
  feature_name VARCHAR(100) NOT NULL,
  feature_value INTEGER NOT NULL,
  feature_unit VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plan_id, feature_code)
);

CREATE INDEX idx_features_plan ON plan_features(plan_id);
CREATE INDEX idx_features_code ON plan_features(feature_code);

-- 3. 用户订阅表
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES subscription_plans(id),
  status VARCHAR(20) DEFAULT 'active',
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  auto_renew BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_subscriptions_end_date ON user_subscriptions(end_date);

-- 4. 订单表
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_no VARCHAR(50) UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES subscription_plans(id),
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  payment_method VARCHAR(20),
  transaction_id VARCHAR(100),
  paid_at TIMESTAMP,
  expired_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_no ON orders(order_no);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_transaction ON orders(transaction_id);

-- 5. 用户使用量统计表
CREATE TABLE IF NOT EXISTS user_usage (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  feature_code VARCHAR(50) NOT NULL,
  usage_count INTEGER DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, feature_code, period_start)
);

CREATE INDEX idx_usage_user_feature ON user_usage(user_id, feature_code);
CREATE INDEX idx_usage_period ON user_usage(period_start);

-- 6. 配置变更历史表
CREATE TABLE IF NOT EXISTS product_config_history (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER REFERENCES subscription_plans(id),
  changed_by INTEGER REFERENCES users(id),
  change_type VARCHAR(50) NOT NULL,
  field_name VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_history_plan ON product_config_history(plan_id);
CREATE INDEX idx_history_user ON product_config_history(changed_by);
CREATE INDEX idx_history_time ON product_config_history(created_at);

-- 初始化默认套餐数据
INSERT INTO subscription_plans (plan_code, plan_name, price, billing_cycle, is_active, display_order, description)
VALUES 
  ('free', '体验版', 0.00, 'monthly', true, 1, '适合个人用户体验基础功能'),
  ('professional', '专业版', 99.00, 'monthly', true, 2, '适合个人创作者和小团队'),
  ('enterprise', '企业版', 299.00, 'monthly', true, 3, '适合企业和专业团队')
ON CONFLICT (plan_code) DO NOTHING;

-- 初始化功能配额数据
-- 体验版配额
INSERT INTO plan_features (plan_id, feature_code, feature_name, feature_value, feature_unit)
SELECT 
  p.id,
  'articles_per_day',
  '每日生成文章数',
  10,
  '篇'
FROM subscription_plans p WHERE p.plan_code = 'free'
ON CONFLICT (plan_id, feature_code) DO NOTHING;

INSERT INTO plan_features (plan_id, feature_code, feature_name, feature_value, feature_unit)
SELECT 
  p.id,
  'publish_per_day',
  '每日发布文章数',
  20,
  '篇'
FROM subscription_plans p WHERE p.plan_code = 'free'
ON CONFLICT (plan_id, feature_code) DO NOTHING;

INSERT INTO plan_features (plan_id, feature_code, feature_name, feature_value, feature_unit)
SELECT 
  p.id,
  'platform_accounts',
  '可管理平台账号数',
  1,
  '个'
FROM subscription_plans p WHERE p.plan_code = 'free'
ON CONFLICT (plan_id, feature_code) DO NOTHING;

INSERT INTO plan_features (plan_id, feature_code, feature_name, feature_value, feature_unit)
SELECT 
  p.id,
  'keyword_distillation',
  '关键词蒸馏数',
  50,
  '个'
FROM subscription_plans p WHERE p.plan_code = 'free'
ON CONFLICT (plan_id, feature_code) DO NOTHING;

-- 专业版配额
INSERT INTO plan_features (plan_id, feature_code, feature_name, feature_value, feature_unit)
SELECT 
  p.id,
  'articles_per_day',
  '每日生成文章数',
  100,
  '篇'
FROM subscription_plans p WHERE p.plan_code = 'professional'
ON CONFLICT (plan_id, feature_code) DO NOTHING;

INSERT INTO plan_features (plan_id, feature_code, feature_name, feature_value, feature_unit)
SELECT 
  p.id,
  'publish_per_day',
  '每日发布文章数',
  200,
  '篇'
FROM subscription_plans p WHERE p.plan_code = 'professional'
ON CONFLICT (plan_id, feature_code) DO NOTHING;

INSERT INTO plan_features (plan_id, feature_code, feature_name, feature_value, feature_unit)
SELECT 
  p.id,
  'platform_accounts',
  '可管理平台账号数',
  3,
  '个'
FROM subscription_plans p WHERE p.plan_code = 'professional'
ON CONFLICT (plan_id, feature_code) DO NOTHING;

INSERT INTO plan_features (plan_id, feature_code, feature_name, feature_value, feature_unit)
SELECT 
  p.id,
  'keyword_distillation',
  '关键词蒸馏数',
  500,
  '个'
FROM subscription_plans p WHERE p.plan_code = 'professional'
ON CONFLICT (plan_id, feature_code) DO NOTHING;

-- 企业版配额（-1 表示无限制）
INSERT INTO plan_features (plan_id, feature_code, feature_name, feature_value, feature_unit)
SELECT 
  p.id,
  'articles_per_day',
  '每日生成文章数',
  -1,
  '篇'
FROM subscription_plans p WHERE p.plan_code = 'enterprise'
ON CONFLICT (plan_id, feature_code) DO NOTHING;

INSERT INTO plan_features (plan_id, feature_code, feature_name, feature_value, feature_unit)
SELECT 
  p.id,
  'publish_per_day',
  '每日发布文章数',
  -1,
  '篇'
FROM subscription_plans p WHERE p.plan_code = 'enterprise'
ON CONFLICT (plan_id, feature_code) DO NOTHING;

INSERT INTO plan_features (plan_id, feature_code, feature_name, feature_value, feature_unit)
SELECT 
  p.id,
  'platform_accounts',
  '可管理平台账号数',
  10,
  '个'
FROM subscription_plans p WHERE p.plan_code = 'enterprise'
ON CONFLICT (plan_id, feature_code) DO NOTHING;

INSERT INTO plan_features (plan_id, feature_code, feature_name, feature_value, feature_unit)
SELECT 
  p.id,
  'keyword_distillation',
  '关键词蒸馏数',
  -1,
  '个'
FROM subscription_plans p WHERE p.plan_code = 'enterprise'
ON CONFLICT (plan_id, feature_code) DO NOTHING;
