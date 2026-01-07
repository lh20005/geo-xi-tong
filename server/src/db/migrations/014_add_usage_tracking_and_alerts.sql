-- ==================== UP ====================
-- 迁移 014: 完善使用量追踪和配额预警系统
-- 创建时间: 2026-01-04
-- 描述: 添加使用记录明细表和配额预警表，完善订阅系统

-- 1. 创建使用记录明细表
CREATE TABLE IF NOT EXISTS usage_records (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_code VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50), -- article, publish, distillation, platform_account
  resource_id INTEGER, -- 关联的资源ID
  amount INTEGER DEFAULT 1, -- 本次使用量
  metadata JSONB, -- 额外信息（如文章标题、平台名称等）
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_usage_records_user_id ON usage_records(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_feature_code ON usage_records(feature_code);
CREATE INDEX IF NOT EXISTS idx_usage_records_created_at ON usage_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_records_user_feature ON usage_records(user_id, feature_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_records_resource ON usage_records(resource_type, resource_id);

COMMENT ON TABLE usage_records IS '使用记录明细表 - 记录每次功能使用的详细信息';
COMMENT ON COLUMN usage_records.feature_code IS '功能代码：articles_per_day, publish_per_day, platform_accounts, keyword_distillation';
COMMENT ON COLUMN usage_records.resource_type IS '资源类型：article(文章), publish(发布), distillation(蒸馏), platform_account(平台账号)';
COMMENT ON COLUMN usage_records.resource_id IS '关联的资源ID，如文章ID、发布记录ID等';
COMMENT ON COLUMN usage_records.metadata IS 'JSON格式的额外信息，如 {"title": "文章标题", "platform": "小红书"}';

-- 2. 创建配额预警表
CREATE TABLE IF NOT EXISTS quota_alerts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_code VARCHAR(50) NOT NULL,
  alert_type VARCHAR(20) NOT NULL CHECK (alert_type IN ('warning', 'critical', 'depleted')),
  threshold_percentage INTEGER NOT NULL, -- 触发阈值：80, 95, 100
  current_usage INTEGER NOT NULL, -- 当前使用量
  quota_limit INTEGER NOT NULL, -- 配额限制
  is_sent BOOLEAN DEFAULT FALSE, -- 是否已发送通知
  sent_at TIMESTAMP, -- 发送时间
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_quota_alerts_user_id ON quota_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_quota_alerts_feature_code ON quota_alerts(feature_code);
CREATE INDEX IF NOT EXISTS idx_quota_alerts_is_sent ON quota_alerts(is_sent);
CREATE INDEX IF NOT EXISTS idx_quota_alerts_created_at ON quota_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quota_alerts_user_feature_type ON quota_alerts(user_id, feature_code, alert_type);

COMMENT ON TABLE quota_alerts IS '配额预警表 - 记录配额使用预警信息';
COMMENT ON COLUMN quota_alerts.alert_type IS '预警类型：warning(警告-80%), critical(严重-95%), depleted(耗尽-100%)';
COMMENT ON COLUMN quota_alerts.threshold_percentage IS '触发阈值百分比';
COMMENT ON COLUMN quota_alerts.is_sent IS '是否已通过WebSocket发送通知给用户';

-- 3. 更新 user_usage 表结构（如果需要）
-- 添加 last_reset_at 字段，记录上次重置时间
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_usage' AND column_name = 'last_reset_at'
  ) THEN
    ALTER TABLE user_usage ADD COLUMN last_reset_at TIMESTAMP;
    COMMENT ON COLUMN user_usage.last_reset_at IS '上次配额重置时间';
  END IF;
END $$;

-- 4. 更新 subscription_plans 表，添加 billing_cycle 字段（如果不存在）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscription_plans' AND column_name = 'billing_cycle'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN billing_cycle VARCHAR(20) DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly'));
    COMMENT ON COLUMN subscription_plans.billing_cycle IS '计费周期：monthly(月付), yearly(年付)';
  END IF;
END $$;

-- 5. 更新 subscription_plans 表，添加 display_order 字段（如果不存在）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscription_plans' AND column_name = 'display_order'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN display_order INTEGER DEFAULT 0;
    COMMENT ON COLUMN subscription_plans.display_order IS '显示顺序，数字越小越靠前';
    
    -- 设置默认顺序
    UPDATE subscription_plans SET display_order = 1 WHERE plan_code = 'free';
    UPDATE subscription_plans SET display_order = 2 WHERE plan_code = 'professional';
    UPDATE subscription_plans SET display_order = 3 WHERE plan_code = 'enterprise';
  END IF;
END $$;

-- 6. 更新 plan_features 表，添加唯一约束（如果不存在）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'plan_features_plan_id_feature_code_key'
  ) THEN
    ALTER TABLE plan_features ADD CONSTRAINT plan_features_plan_id_feature_code_key UNIQUE (plan_id, feature_code);
  END IF;
END $$;

-- 7. 创建配额检查函数
CREATE OR REPLACE FUNCTION check_user_quota(
  p_user_id INTEGER,
  p_feature_code VARCHAR(50)
) RETURNS TABLE (
  has_quota BOOLEAN,
  current_usage INTEGER,
  quota_limit INTEGER,
  remaining INTEGER,
  percentage NUMERIC
) AS $$
DECLARE
  v_subscription_id INTEGER;
  v_plan_id INTEGER;
  v_feature_value INTEGER;
  v_current_usage INTEGER;
  v_period_start TIMESTAMP;
BEGIN
  -- 获取用户当前订阅
  SELECT us.id, us.plan_id INTO v_subscription_id, v_plan_id
  FROM user_subscriptions us
  WHERE us.user_id = p_user_id 
    AND us.status = 'active'
    AND us.end_date > CURRENT_TIMESTAMP
  ORDER BY us.end_date DESC
  LIMIT 1;
  
  -- 如果没有订阅，返回无配额
  IF v_plan_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 0, 0, 0::NUMERIC;
    RETURN;
  END IF;
  
  -- 获取功能配额
  SELECT pf.feature_value INTO v_feature_value
  FROM plan_features pf
  WHERE pf.plan_id = v_plan_id AND pf.feature_code = p_feature_code;
  
  -- 如果功能不存在，返回无配额
  IF v_feature_value IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 0, 0, 0::NUMERIC;
    RETURN;
  END IF;
  
  -- 无限制配额
  IF v_feature_value = -1 THEN
    RETURN QUERY SELECT TRUE, 0, -1, -1, 0::NUMERIC;
    RETURN;
  END IF;
  
  -- 获取当前使用量
  SELECT COALESCE(uu.usage_count, 0), uu.period_start 
  INTO v_current_usage, v_period_start
  FROM user_usage uu
  WHERE uu.user_id = p_user_id 
    AND uu.feature_code = p_feature_code
    AND uu.period_end > CURRENT_TIMESTAMP
  ORDER BY uu.period_start DESC
  LIMIT 1;
  
  -- 如果没有使用记录，初始化为0
  IF v_current_usage IS NULL THEN
    v_current_usage := 0;
  END IF;
  
  -- 返回配额信息
  RETURN QUERY SELECT 
    (v_current_usage < v_feature_value) AS has_quota,
    v_current_usage,
    v_feature_value,
    GREATEST(0, v_feature_value - v_current_usage) AS remaining,
    CASE 
      WHEN v_feature_value > 0 THEN ROUND((v_current_usage::NUMERIC / v_feature_value::NUMERIC) * 100, 2)
      ELSE 0::NUMERIC
    END AS percentage;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_user_quota IS '检查用户配额函数 - 返回配额使用情况';

-- 8. 创建记录使用量的函数
CREATE OR REPLACE FUNCTION record_feature_usage(
  p_user_id INTEGER,
  p_feature_code VARCHAR(50),
  p_resource_type VARCHAR(50) DEFAULT NULL,
  p_resource_id INTEGER DEFAULT NULL,
  p_amount INTEGER DEFAULT 1,
  p_metadata JSONB DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_period_start TIMESTAMP;
  v_period_end TIMESTAMP;
  v_reset_period VARCHAR(20);
BEGIN
  -- 确定重置周期
  CASE p_feature_code
    WHEN 'articles_per_day', 'publish_per_day' THEN
      v_reset_period := 'daily';
      v_period_start := DATE_TRUNC('day', CURRENT_TIMESTAMP);
      v_period_end := v_period_start + INTERVAL '1 day';
    WHEN 'keyword_distillation' THEN
      v_reset_period := 'monthly';
      v_period_start := DATE_TRUNC('month', CURRENT_TIMESTAMP);
      v_period_end := v_period_start + INTERVAL '1 month';
    ELSE
      v_reset_period := 'never';
      v_period_start := '2000-01-01'::TIMESTAMP;
      v_period_end := '2099-12-31'::TIMESTAMP;
  END CASE;
  
  -- 插入使用记录
  INSERT INTO usage_records (user_id, feature_code, resource_type, resource_id, amount, metadata)
  VALUES (p_user_id, p_feature_code, p_resource_type, p_resource_id, p_amount, p_metadata);
  
  -- 更新统计
  INSERT INTO user_usage (user_id, feature_code, usage_count, period_start, period_end, last_reset_at)
  VALUES (p_user_id, p_feature_code, p_amount, v_period_start, v_period_end, v_period_start)
  ON CONFLICT (user_id, feature_code, period_start)
  DO UPDATE SET 
    usage_count = user_usage.usage_count + p_amount,
    updated_at = CURRENT_TIMESTAMP;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION record_feature_usage IS '记录功能使用量函数 - 自动处理周期和统计';

-- 9. 创建配额预警触发器函数
CREATE OR REPLACE FUNCTION trigger_quota_alert() RETURNS TRIGGER AS $$
DECLARE
  v_plan_id INTEGER;
  v_feature_value INTEGER;
  v_percentage NUMERIC;
  v_alert_type VARCHAR(20);
  v_threshold INTEGER;
BEGIN
  -- 获取用户套餐和配额限制
  SELECT us.plan_id, pf.feature_value 
  INTO v_plan_id, v_feature_value
  FROM user_subscriptions us
  JOIN plan_features pf ON pf.plan_id = us.plan_id
  WHERE us.user_id = NEW.user_id 
    AND us.status = 'active'
    AND pf.feature_code = NEW.feature_code
  ORDER BY us.end_date DESC
  LIMIT 1;
  
  -- 无限制配额不需要预警
  IF v_feature_value = -1 OR v_feature_value IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- 计算使用百分比
  v_percentage := (NEW.usage_count::NUMERIC / v_feature_value::NUMERIC) * 100;
  
  -- 确定预警类型和阈值
  IF v_percentage >= 100 THEN
    v_alert_type := 'depleted';
    v_threshold := 100;
  ELSIF v_percentage >= 95 THEN
    v_alert_type := 'critical';
    v_threshold := 95;
  ELSIF v_percentage >= 80 THEN
    v_alert_type := 'warning';
    v_threshold := 80;
  ELSE
    RETURN NEW;
  END IF;
  
  -- 检查是否已经发送过相同类型的预警（同一周期内）
  IF NOT EXISTS (
    SELECT 1 FROM quota_alerts
    WHERE user_id = NEW.user_id
      AND feature_code = NEW.feature_code
      AND alert_type = v_alert_type
      AND created_at >= NEW.period_start
  ) THEN
    -- 插入预警记录
    INSERT INTO quota_alerts (
      user_id, feature_code, alert_type, threshold_percentage,
      current_usage, quota_limit, is_sent
    ) VALUES (
      NEW.user_id, NEW.feature_code, v_alert_type, v_threshold,
      NEW.usage_count, v_feature_value, FALSE
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS quota_alert_trigger ON user_usage;
CREATE TRIGGER quota_alert_trigger
  AFTER INSERT OR UPDATE OF usage_count ON user_usage
  FOR EACH ROW
  EXECUTE FUNCTION trigger_quota_alert();

COMMENT ON FUNCTION trigger_quota_alert IS '配额预警触发器函数 - 自动创建预警记录';

-- 10. 创建视图：用户配额使用概览
CREATE OR REPLACE VIEW v_user_quota_overview AS
SELECT 
  u.id AS user_id,
  u.username,
  us.plan_id,
  sp.plan_name,
  sp.plan_code,
  pf.feature_code,
  pf.feature_name,
  pf.feature_value AS quota_limit,
  COALESCE(uu.usage_count, 0) AS current_usage,
  CASE 
    WHEN pf.feature_value = -1 THEN -1
    ELSE GREATEST(0, pf.feature_value - COALESCE(uu.usage_count, 0))
  END AS remaining,
  CASE 
    WHEN pf.feature_value = -1 THEN 0
    WHEN pf.feature_value > 0 THEN ROUND((COALESCE(uu.usage_count, 0)::NUMERIC / pf.feature_value::NUMERIC) * 100, 2)
    ELSE 0
  END AS usage_percentage,
  uu.period_start,
  uu.period_end,
  us.end_date AS subscription_end_date
FROM users u
JOIN user_subscriptions us ON us.user_id = u.id AND us.status = 'active'
JOIN subscription_plans sp ON sp.id = us.plan_id
JOIN plan_features pf ON pf.plan_id = sp.id
LEFT JOIN user_usage uu ON uu.user_id = u.id 
  AND uu.feature_code = pf.feature_code
  AND uu.period_end > CURRENT_TIMESTAMP
ORDER BY u.id, pf.feature_code;

COMMENT ON VIEW v_user_quota_overview IS '用户配额使用概览视图 - 方便查询用户配额使用情况';

-- 11. 插入初始数据（如果需要）
-- 为现有用户初始化使用量记录（基于现有数据）
INSERT INTO user_usage (user_id, feature_code, usage_count, period_start, period_end, last_reset_at)
SELECT 
  a.user_id,
  'articles_per_day' AS feature_code,
  COUNT(*) AS usage_count,
  DATE_TRUNC('day', CURRENT_TIMESTAMP) AS period_start,
  DATE_TRUNC('day', CURRENT_TIMESTAMP) + INTERVAL '1 day' AS period_end,
  DATE_TRUNC('day', CURRENT_TIMESTAMP) AS last_reset_at
FROM articles a
WHERE a.created_at >= DATE_TRUNC('day', CURRENT_TIMESTAMP)
  AND a.user_id IS NOT NULL
GROUP BY a.user_id
ON CONFLICT (user_id, feature_code, period_start) DO NOTHING;

-- ========================================
-- 迁移完成
-- ========================================

-- 验证迁移
DO $$
DECLARE
  v_usage_records_count INTEGER;
  v_quota_alerts_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_usage_records_count FROM information_schema.tables WHERE table_name = 'usage_records';
  SELECT COUNT(*) INTO v_quota_alerts_count FROM information_schema.tables WHERE table_name = 'quota_alerts';
  
  IF v_usage_records_count > 0 AND v_quota_alerts_count > 0 THEN
    RAISE NOTICE '✅ 迁移 014 成功完成';
    RAISE NOTICE '   - usage_records 表已创建';
    RAISE NOTICE '   - quota_alerts 表已创建';
    RAISE NOTICE '   - 配额检查函数已创建';
    RAISE NOTICE '   - 使用量记录函数已创建';
    RAISE NOTICE '   - 配额预警触发器已创建';
    RAISE NOTICE '   - 用户配额概览视图已创建';
  ELSE
    RAISE EXCEPTION '❌ 迁移 014 失败';
  END IF;
END $$;

-- ==================== DOWN ====================
-- 回滚迁移 014

-- 删除视图
DROP VIEW IF EXISTS v_user_quota_overview;

-- 删除触发器
DROP TRIGGER IF EXISTS quota_alert_trigger ON user_usage;

-- 删除函数
DROP FUNCTION IF EXISTS trigger_quota_alert();
DROP FUNCTION IF EXISTS record_feature_usage(INTEGER, VARCHAR, VARCHAR, INTEGER, INTEGER, JSONB);
DROP FUNCTION IF EXISTS check_user_quota(INTEGER, VARCHAR);

-- 删除表
DROP TABLE IF EXISTS quota_alerts;
DROP TABLE IF EXISTS usage_records;

-- 删除添加的列
ALTER TABLE user_usage DROP COLUMN IF EXISTS last_reset_at;
ALTER TABLE subscription_plans DROP COLUMN IF EXISTS billing_cycle;
ALTER TABLE subscription_plans DROP COLUMN IF EXISTS display_order;
