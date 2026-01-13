-- ==================== UP ====================
-- ========================================
-- 迁移 027: 用户订阅管理功能
-- 创建时间: 2026-01-05
-- 描述: 添加订阅调整记录表，支持管理员管理用户订阅
-- ========================================

-- 1. 创建订阅调整记录表
CREATE TABLE IF NOT EXISTS subscription_adjustments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id INTEGER REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  adjustment_type VARCHAR(50) NOT NULL, -- upgrade, extend, pause, resume, cancel, quota_adjust, gift
  old_plan_id INTEGER REFERENCES subscription_plans(id),
  new_plan_id INTEGER REFERENCES subscription_plans(id),
  old_end_date TIMESTAMP,
  new_end_date TIMESTAMP,
  days_added INTEGER, -- 延长的天数
  quota_adjustments JSONB, -- {"feature_code": {"old": 100, "new": 200, "is_permanent": false}}
  reason TEXT, -- 调整原因
  admin_id INTEGER NOT NULL REFERENCES users(id),
  admin_note TEXT, -- 管理员备注
  ip_address VARCHAR(45), -- 操作IP
  user_agent TEXT, -- 浏览器信息
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_subscription_adjustments_user_id ON subscription_adjustments(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_adjustments_subscription_id ON subscription_adjustments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_adjustments_admin_id ON subscription_adjustments(admin_id);
CREATE INDEX IF NOT EXISTS idx_subscription_adjustments_type ON subscription_adjustments(adjustment_type);
CREATE INDEX IF NOT EXISTS idx_subscription_adjustments_created_at ON subscription_adjustments(created_at DESC);

COMMENT ON TABLE subscription_adjustments IS '订阅调整记录表 - 记录管理员对用户订阅的所有操作';
COMMENT ON COLUMN subscription_adjustments.adjustment_type IS '调整类型：upgrade(升级), extend(延期), pause(暂停), resume(恢复), cancel(取消), quota_adjust(配额调整), gift(赠送)';
COMMENT ON COLUMN subscription_adjustments.quota_adjustments IS 'JSON格式的配额调整详情';

-- 2. 扩展 user_subscriptions 表
DO $$ 
BEGIN
  -- 添加暂停相关字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_subscriptions' AND column_name = 'paused_at'
  ) THEN
    ALTER TABLE user_subscriptions ADD COLUMN paused_at TIMESTAMP;
    COMMENT ON COLUMN user_subscriptions.paused_at IS '暂停时间';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_subscriptions' AND column_name = 'pause_reason'
  ) THEN
    ALTER TABLE user_subscriptions ADD COLUMN pause_reason TEXT;
    COMMENT ON COLUMN user_subscriptions.pause_reason IS '暂停原因';
  END IF;

  -- 添加自定义配额字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_subscriptions' AND column_name = 'custom_quotas'
  ) THEN
    ALTER TABLE user_subscriptions ADD COLUMN custom_quotas JSONB;
    COMMENT ON COLUMN user_subscriptions.custom_quotas IS '自定义配额覆盖，格式：{"feature_code": value}';
  END IF;

  -- 添加是否为赠送字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_subscriptions' AND column_name = 'is_gift'
  ) THEN
    ALTER TABLE user_subscriptions ADD COLUMN is_gift BOOLEAN DEFAULT FALSE;
    COMMENT ON COLUMN user_subscriptions.is_gift IS '是否为管理员赠送的订阅';
  END IF;

  -- 添加赠送原因字段
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_subscriptions' AND column_name = 'gift_reason'
  ) THEN
    ALTER TABLE user_subscriptions ADD COLUMN gift_reason TEXT;
    COMMENT ON COLUMN user_subscriptions.gift_reason IS '赠送原因';
  END IF;
END $$;

-- 3. 创建获取用户订阅详情的函数
CREATE OR REPLACE FUNCTION get_user_subscription_detail(p_user_id INTEGER)
RETURNS TABLE (
  subscription_id INTEGER,
  plan_id INTEGER,
  plan_code VARCHAR(50),
  plan_name VARCHAR(100),
  price DECIMAL(10, 2),
  status VARCHAR(20),
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  days_remaining INTEGER,
  is_paused BOOLEAN,
  paused_at TIMESTAMP,
  pause_reason TEXT,
  is_gift BOOLEAN,
  custom_quotas JSONB,
  features JSONB
) AS $$
DECLARE
  v_subscription_id INTEGER;
  v_plan_id INTEGER;
  v_custom_quotas JSONB;
BEGIN
  -- 获取用户当前活跃订阅
  SELECT us.id, us.plan_id, us.custom_quotas
  INTO v_subscription_id, v_plan_id, v_custom_quotas
  FROM user_subscriptions us
  WHERE us.user_id = p_user_id 
    AND us.status = 'active'
    AND us.end_date > CURRENT_TIMESTAMP
  ORDER BY us.end_date DESC
  LIMIT 1;

  -- 如果没有订阅，返回空
  IF v_subscription_id IS NULL THEN
    RETURN;
  END IF;

  -- 返回订阅详情和配额信息
  RETURN QUERY
  SELECT 
    us.id AS subscription_id,
    sp.id AS plan_id,
    sp.plan_code,
    sp.plan_name,
    sp.price,
    us.status,
    us.start_date,
    us.end_date,
    GREATEST(0, EXTRACT(DAY FROM (us.end_date - CURRENT_TIMESTAMP))::INTEGER) AS days_remaining,
    (us.paused_at IS NOT NULL) AS is_paused,
    us.paused_at,
    us.pause_reason,
    us.is_gift,
    us.custom_quotas,
    (
      SELECT jsonb_agg(feature_data)
      FROM (
        SELECT DISTINCT ON (pf.feature_code)
          jsonb_build_object(
            'feature_code', pf.feature_code,
            'feature_name', pf.feature_name,
            'feature_value', COALESCE(
              (us.custom_quotas->>pf.feature_code)::INTEGER,
              pf.feature_value
            ),
            'current_usage', COALESCE(uu.usage_count, 0),
            'usage_percentage', CASE 
              WHEN COALESCE((us.custom_quotas->>pf.feature_code)::INTEGER, pf.feature_value) = -1 THEN 0
              WHEN COALESCE((us.custom_quotas->>pf.feature_code)::INTEGER, pf.feature_value) > 0 THEN 
                ROUND((COALESCE(uu.usage_count, 0)::NUMERIC / COALESCE((us.custom_quotas->>pf.feature_code)::INTEGER, pf.feature_value)::NUMERIC) * 100, 2)
              ELSE 0
            END
          ) AS feature_data
        FROM plan_features pf
        LEFT JOIN user_usage uu ON uu.user_id = p_user_id 
          AND uu.feature_code = pf.feature_code
          AND uu.period_end > CURRENT_TIMESTAMP
        WHERE pf.plan_id = sp.id
        ORDER BY pf.feature_code, uu.period_end DESC NULLS LAST
      ) sub
    ) AS features
  FROM user_subscriptions us
  JOIN subscription_plans sp ON sp.id = us.plan_id
  WHERE us.id = v_subscription_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_subscription_detail IS '获取用户订阅详情函数 - 包含配额使用情况';

-- 4. 创建订阅调整历史视图
CREATE OR REPLACE VIEW v_subscription_adjustment_history AS
SELECT 
  sa.id,
  sa.user_id,
  u.username,
  sa.subscription_id,
  sa.adjustment_type,
  CASE sa.adjustment_type
    WHEN 'upgrade' THEN '升级套餐'
    WHEN 'extend' THEN '延期订阅'
    WHEN 'pause' THEN '暂停订阅'
    WHEN 'resume' THEN '恢复订阅'
    WHEN 'cancel' THEN '取消订阅'
    WHEN 'quota_adjust' THEN '配额调整'
    WHEN 'gift' THEN '赠送套餐'
    ELSE sa.adjustment_type
  END AS adjustment_type_label,
  sp_old.plan_name AS old_plan_name,
  sp_new.plan_name AS new_plan_name,
  sa.old_end_date,
  sa.new_end_date,
  sa.days_added,
  sa.quota_adjustments,
  sa.reason,
  sa.admin_note,
  sa.admin_id,
  admin.username AS admin_username,
  sa.ip_address,
  sa.created_at
FROM subscription_adjustments sa
JOIN users u ON u.id = sa.user_id
LEFT JOIN subscription_plans sp_old ON sp_old.id = sa.old_plan_id
LEFT JOIN subscription_plans sp_new ON sp_new.id = sa.new_plan_id
JOIN users admin ON admin.id = sa.admin_id
ORDER BY sa.created_at DESC;

COMMENT ON VIEW v_subscription_adjustment_history IS '订阅调整历史视图 - 方便查询调整记录';

-- ========================================
-- 迁移完成
-- ========================================

-- 验证迁移
DO $$
DECLARE
  v_table_count INTEGER;
  v_function_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_table_count 
  FROM information_schema.tables 
  WHERE table_name = 'subscription_adjustments';
  
  SELECT COUNT(*) INTO v_function_count 
  FROM pg_proc 
  WHERE proname = 'get_user_subscription_detail';
  
  IF v_table_count > 0 AND v_function_count > 0 THEN
    RAISE NOTICE '✅ 迁移 027 成功完成';
    RAISE NOTICE '   - subscription_adjustments 表已创建';
    RAISE NOTICE '   - user_subscriptions 表已扩展';
    RAISE NOTICE '   - get_user_subscription_detail 函数已创建';
    RAISE NOTICE '   - v_subscription_adjustment_history 视图已创建';
  ELSE
    RAISE EXCEPTION '❌ 迁移 027 失败';
  END IF;
END $$;

-- ==================== DOWN ====================
-- Rollback not implemented for this migration
