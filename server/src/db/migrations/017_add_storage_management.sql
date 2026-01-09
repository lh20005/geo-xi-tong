-- ========================================
-- 迁移 017: 添加存储空间管理系统
-- 创建时间: 2026-01-04
-- 描述: 添加用户存储使用跟踪、历史记录和事务日志表
-- ========================================

-- ==================== UP ====================

-- 1. 创建用户存储使用表
CREATE TABLE IF NOT EXISTS user_storage_usage (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- 按资源类型的存储使用量（字节）
  image_storage_bytes BIGINT DEFAULT 0,
  document_storage_bytes BIGINT DEFAULT 0,
  article_storage_bytes BIGINT DEFAULT 0,
  total_storage_bytes BIGINT GENERATED ALWAYS AS 
    (image_storage_bytes + document_storage_bytes + article_storage_bytes) STORED,
  
  -- 项目计数
  image_count INTEGER DEFAULT 0,
  document_count INTEGER DEFAULT 0,
  article_count INTEGER DEFAULT 0,
  
  -- 配额信息（字节）
  storage_quota_bytes BIGINT NOT NULL, -- -1 表示无限制
  purchased_storage_bytes BIGINT DEFAULT 0, -- 额外购买的存储
  
  -- 时间戳
  last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_user_storage UNIQUE (user_id),
  CONSTRAINT check_non_negative_storage CHECK (
    image_storage_bytes >= 0 AND 
    document_storage_bytes >= 0 AND 
    article_storage_bytes >= 0
  ),
  CONSTRAINT check_non_negative_counts CHECK (
    image_count >= 0 AND 
    document_count >= 0 AND 
    article_count >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_user_storage_user_id ON user_storage_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_storage_quota_exceeded ON user_storage_usage(user_id) 
  WHERE total_storage_bytes >= storage_quota_bytes AND storage_quota_bytes != -1;

COMMENT ON TABLE user_storage_usage IS '用户存储使用表 - 跟踪每个用户的存储使用情况';
COMMENT ON COLUMN user_storage_usage.storage_quota_bytes IS '存储配额（字节），-1 表示无限制';
COMMENT ON COLUMN user_storage_usage.purchased_storage_bytes IS '通过产品卡购买的额外存储（字节）';
COMMENT ON COLUMN user_storage_usage.total_storage_bytes IS '总存储使用量，自动计算';

-- 2. 创建存储使用历史表
CREATE TABLE IF NOT EXISTS storage_usage_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- 此时间点的使用量快照
  image_storage_bytes BIGINT NOT NULL,
  document_storage_bytes BIGINT NOT NULL,
  article_storage_bytes BIGINT NOT NULL,
  total_storage_bytes BIGINT NOT NULL,
  
  -- 快照日期
  snapshot_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_user_snapshot UNIQUE (user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_storage_history_user_date ON storage_usage_history(user_id, snapshot_date DESC);

COMMENT ON TABLE storage_usage_history IS '存储使用历史表 - 每日快照用于趋势分析';

-- 3. 创建存储事务表
CREATE TABLE IF NOT EXISTS storage_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- 事务详情
  resource_type VARCHAR(20) NOT NULL CHECK (resource_type IN ('image', 'document', 'article')),
  resource_id INTEGER NOT NULL,
  operation VARCHAR(10) NOT NULL CHECK (operation IN ('add', 'remove')),
  size_bytes BIGINT NOT NULL,
  
  -- 元数据
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_storage_transactions_user ON storage_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_storage_transactions_resource ON storage_transactions(resource_type, resource_id);

COMMENT ON TABLE storage_transactions IS '存储事务表 - 审计跟踪所有存储变更';

-- 4. 创建管理员配额修改日志表
CREATE TABLE IF NOT EXISTS admin_quota_modifications (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_type VARCHAR(50) NOT NULL,
  old_quota BIGINT NOT NULL,
  new_quota BIGINT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_quota_mods_admin ON admin_quota_modifications(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_quota_mods_user ON admin_quota_modifications(user_id, created_at DESC);

COMMENT ON TABLE admin_quota_modifications IS '管理员配额修改日志表 - 记录所有管理员对用户配额的修改';

-- 4.1. 更新 quota_alerts 表以支持存储空间字节数
DO $$
BEGIN
  -- 添加 current_usage_bytes 列（如果不存在）
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quota_alerts' AND column_name = 'current_usage_bytes'
  ) THEN
    ALTER TABLE quota_alerts ADD COLUMN current_usage_bytes BIGINT;
  END IF;
  
  -- 添加 quota_bytes 列（如果不存在）
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quota_alerts' AND column_name = 'quota_bytes'
  ) THEN
    ALTER TABLE quota_alerts ADD COLUMN quota_bytes BIGINT;
  END IF;
  
  -- 添加 feature_type 列（如果不存在）- 用于兼容旧代码
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'quota_alerts' AND column_name = 'feature_type'
  ) THEN
    ALTER TABLE quota_alerts ADD COLUMN feature_type VARCHAR(50);
    -- 将现有的 feature_code 复制到 feature_type
    UPDATE quota_alerts SET feature_type = feature_code WHERE feature_type IS NULL;
  END IF;
END $$;

COMMENT ON COLUMN quota_alerts.current_usage_bytes IS '当前使用量（字节）- 用于存储空间';
COMMENT ON COLUMN quota_alerts.quota_bytes IS '配额限制（字节）- 用于存储空间';

-- 5. 在 plan_features 表中添加 storage_space 功能
-- 为现有套餐添加存储空间功能
DO $$
DECLARE
  v_free_plan_id INTEGER;
  v_professional_plan_id INTEGER;
  v_enterprise_plan_id INTEGER;
BEGIN
  -- 获取套餐 ID
  SELECT id INTO v_free_plan_id FROM subscription_plans WHERE plan_code = 'free';
  SELECT id INTO v_professional_plan_id FROM subscription_plans WHERE plan_code = 'professional';
  SELECT id INTO v_enterprise_plan_id FROM subscription_plans WHERE plan_code = 'enterprise';
  
  -- 为体验版添加 100MB 存储
  IF v_free_plan_id IS NOT NULL THEN
    INSERT INTO plan_features (plan_id, feature_code, feature_name, feature_value, feature_unit)
    VALUES (v_free_plan_id, 'storage_space', '存储空间', 104857600, 'bytes')
    ON CONFLICT (plan_id, feature_code) DO NOTHING;
  END IF;
  
  -- 为专业版添加 1GB 存储
  IF v_professional_plan_id IS NOT NULL THEN
    INSERT INTO plan_features (plan_id, feature_code, feature_name, feature_value, feature_unit)
    VALUES (v_professional_plan_id, 'storage_space', '存储空间', 1073741824, 'bytes')
    ON CONFLICT (plan_id, feature_code) DO NOTHING;
  END IF;
  
  -- 为企业版添加无限存储
  IF v_enterprise_plan_id IS NOT NULL THEN
    INSERT INTO plan_features (plan_id, feature_code, feature_name, feature_value, feature_unit)
    VALUES (v_enterprise_plan_id, 'storage_space', '存储空间', -1, 'bytes')
    ON CONFLICT (plan_id, feature_code) DO NOTHING;
  END IF;
END $$;

-- 6. 创建函数：获取用户有效配额
CREATE OR REPLACE FUNCTION get_user_storage_quota(p_user_id INTEGER)
RETURNS BIGINT AS $$
DECLARE
  v_plan_id INTEGER;
  v_quota_bytes BIGINT;
  v_user_role VARCHAR(50);
BEGIN
  -- 检查用户角色
  SELECT role INTO v_user_role FROM users WHERE id = p_user_id;
  
  -- 管理员获得 1GB 存储
  IF v_user_role = 'admin' THEN
    RETURN 1073741824; -- 1GB in bytes
  END IF;
  
  -- 获取用户当前订阅的套餐
  SELECT us.plan_id INTO v_plan_id
  FROM user_subscriptions us
  WHERE us.user_id = p_user_id 
    AND us.status = 'active'
    AND us.end_date > CURRENT_TIMESTAMP
  ORDER BY us.end_date DESC
  LIMIT 1;
  
  -- 如果没有订阅，返回默认 10MB
  IF v_plan_id IS NULL THEN
    RETURN 10485760; -- 10MB in bytes
  END IF;
  
  -- 获取套餐的存储配额
  SELECT pf.feature_value INTO v_quota_bytes
  FROM plan_features pf
  WHERE pf.plan_id = v_plan_id AND pf.feature_code = 'storage_space';
  
  -- 如果套餐没有定义存储配额，返回默认 10MB
  IF v_quota_bytes IS NULL THEN
    RETURN 10485760;
  END IF;
  
  RETURN v_quota_bytes;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_storage_quota IS '获取用户的存储配额（字节）';

-- 7. 创建函数：初始化用户存储
CREATE OR REPLACE FUNCTION initialize_user_storage(p_user_id INTEGER)
RETURNS VOID AS $$
DECLARE
  v_quota_bytes BIGINT;
BEGIN
  -- 获取用户配额
  v_quota_bytes := get_user_storage_quota(p_user_id);
  
  -- 插入存储记录
  INSERT INTO user_storage_usage (
    user_id, 
    storage_quota_bytes,
    image_storage_bytes,
    document_storage_bytes,
    article_storage_bytes,
    image_count,
    document_count,
    article_count
  ) VALUES (
    p_user_id,
    v_quota_bytes,
    0, 0, 0, 0, 0, 0
  )
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION initialize_user_storage IS '为新用户初始化存储跟踪记录';

-- 8. 创建函数：记录存储使用
CREATE OR REPLACE FUNCTION record_storage_usage(
  p_user_id INTEGER,
  p_resource_type VARCHAR(20),
  p_resource_id INTEGER,
  p_operation VARCHAR(10),
  p_size_bytes BIGINT,
  p_metadata JSONB DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_delta BIGINT;
BEGIN
  -- 确定增量（添加为正，删除为负）
  IF p_operation = 'add' THEN
    v_delta := p_size_bytes;
  ELSIF p_operation = 'remove' THEN
    v_delta := -p_size_bytes;
  ELSE
    RAISE EXCEPTION '无效的操作类型: %', p_operation;
  END IF;
  
  -- 记录事务
  INSERT INTO storage_transactions (
    user_id, resource_type, resource_id, operation, size_bytes, metadata
  ) VALUES (
    p_user_id, p_resource_type, p_resource_id, p_operation, p_size_bytes, p_metadata
  );
  
  -- 更新存储使用量
  IF p_resource_type = 'image' THEN
    UPDATE user_storage_usage
    SET 
      image_storage_bytes = GREATEST(0, image_storage_bytes + v_delta),
      image_count = CASE 
        WHEN p_operation = 'add' THEN image_count + 1
        WHEN p_operation = 'remove' THEN GREATEST(0, image_count - 1)
        ELSE image_count
      END,
      last_updated_at = CURRENT_TIMESTAMP
    WHERE user_id = p_user_id;
    
  ELSIF p_resource_type = 'document' THEN
    UPDATE user_storage_usage
    SET 
      document_storage_bytes = GREATEST(0, document_storage_bytes + v_delta),
      document_count = CASE 
        WHEN p_operation = 'add' THEN document_count + 1
        WHEN p_operation = 'remove' THEN GREATEST(0, document_count - 1)
        ELSE document_count
      END,
      last_updated_at = CURRENT_TIMESTAMP
    WHERE user_id = p_user_id;
    
  ELSIF p_resource_type = 'article' THEN
    UPDATE user_storage_usage
    SET 
      article_storage_bytes = GREATEST(0, article_storage_bytes + v_delta),
      article_count = CASE 
        WHEN p_operation = 'add' THEN article_count + 1
        WHEN p_operation = 'remove' THEN GREATEST(0, article_count - 1)
        ELSE article_count
      END,
      last_updated_at = CURRENT_TIMESTAMP
    WHERE user_id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION record_storage_usage IS '记录存储使用变更并更新统计';

-- 9. 创建函数：检查存储配额
CREATE OR REPLACE FUNCTION check_storage_quota(
  p_user_id INTEGER,
  p_size_bytes BIGINT
) RETURNS TABLE (
  allowed BOOLEAN,
  current_usage_bytes BIGINT,
  quota_bytes BIGINT,
  available_bytes BIGINT,
  usage_percentage NUMERIC
) AS $$
DECLARE
  v_usage user_storage_usage%ROWTYPE;
  v_effective_quota BIGINT;
BEGIN
  -- 获取用户存储使用情况
  SELECT * INTO v_usage FROM user_storage_usage WHERE user_id = p_user_id;
  
  -- 如果没有记录，初始化
  IF NOT FOUND THEN
    PERFORM initialize_user_storage(p_user_id);
    SELECT * INTO v_usage FROM user_storage_usage WHERE user_id = p_user_id;
  END IF;
  
  -- 计算有效配额（套餐配额 + 购买的存储）
  v_effective_quota := v_usage.storage_quota_bytes + v_usage.purchased_storage_bytes;
  
  -- 无限制配额
  IF v_effective_quota = -1 THEN
    RETURN QUERY SELECT 
      TRUE,
      v_usage.total_storage_bytes,
      v_effective_quota,
      -1::BIGINT,
      0::NUMERIC;
    RETURN;
  END IF;
  
  -- 检查是否超过配额
  RETURN QUERY SELECT 
    (v_usage.total_storage_bytes + p_size_bytes) <= v_effective_quota,
    v_usage.total_storage_bytes,
    v_effective_quota,
    GREATEST(0, v_effective_quota - v_usage.total_storage_bytes),
    ROUND((v_usage.total_storage_bytes::NUMERIC / v_effective_quota::NUMERIC) * 100, 2);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_storage_quota IS '检查用户是否有足够的存储配额';

-- 10. 创建触发器：存储配额警报
CREATE OR REPLACE FUNCTION trigger_storage_alert() RETURNS TRIGGER AS $$
DECLARE
  v_effective_quota BIGINT;
  v_percentage NUMERIC;
  v_alert_type VARCHAR(20);
  v_threshold INTEGER;
BEGIN
  -- 计算有效配额
  v_effective_quota := NEW.storage_quota_bytes + NEW.purchased_storage_bytes;
  
  -- 无限制配额不需要预警
  IF v_effective_quota = -1 THEN
    RETURN NEW;
  END IF;
  
  -- 计算使用百分比
  v_percentage := (NEW.total_storage_bytes::NUMERIC / v_effective_quota::NUMERIC) * 100;
  
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
  
  -- 检查是否已经发送过相同类型的预警（当天）
  IF NOT EXISTS (
    SELECT 1 FROM quota_alerts
    WHERE user_id = NEW.user_id
      AND feature_code = 'storage_space'
      AND alert_type = v_alert_type
      AND created_at >= DATE_TRUNC('day', CURRENT_TIMESTAMP)
  ) THEN
    -- 插入预警记录
    INSERT INTO quota_alerts (
      user_id, feature_code, alert_type, threshold_percentage,
      current_usage, quota_limit, is_sent
    ) VALUES (
      NEW.user_id, 'storage_space', v_alert_type, v_threshold,
      NEW.total_storage_bytes, v_effective_quota, FALSE
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS storage_alert_trigger ON user_storage_usage;
CREATE TRIGGER storage_alert_trigger
  AFTER INSERT OR UPDATE OF image_storage_bytes, document_storage_bytes, article_storage_bytes 
  ON user_storage_usage
  FOR EACH ROW
  EXECUTE FUNCTION trigger_storage_alert();

COMMENT ON FUNCTION trigger_storage_alert IS '存储配额预警触发器函数';

-- 11. 为现有用户初始化存储记录
DO $$
DECLARE
  v_user RECORD;
BEGIN
  FOR v_user IN SELECT id FROM users LOOP
    PERFORM initialize_user_storage(v_user.id);
  END LOOP;
END $$;

-- ========================================
-- 迁移完成
-- ========================================

-- 验证迁移
DO $$
DECLARE
  v_storage_usage_count INTEGER;
  v_storage_history_count INTEGER;
  v_storage_transactions_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_storage_usage_count FROM information_schema.tables WHERE table_name = 'user_storage_usage';
  SELECT COUNT(*) INTO v_storage_history_count FROM information_schema.tables WHERE table_name = 'storage_usage_history';
  SELECT COUNT(*) INTO v_storage_transactions_count FROM information_schema.tables WHERE table_name = 'storage_transactions';
  
  IF v_storage_usage_count > 0 AND v_storage_history_count > 0 AND v_storage_transactions_count > 0 THEN
    RAISE NOTICE '✅ 迁移 017 成功完成';
    RAISE NOTICE '   - user_storage_usage 表已创建';
    RAISE NOTICE '   - storage_usage_history 表已创建';
    RAISE NOTICE '   - storage_transactions 表已创建';
    RAISE NOTICE '   - 存储空间功能已添加到套餐';
    RAISE NOTICE '   - 存储管理函数已创建';
    RAISE NOTICE '   - 存储预警触发器已创建';
    RAISE NOTICE '   - 现有用户存储记录已初始化';
  ELSE
    RAISE EXCEPTION '❌ 迁移 017 失败';
  END IF;
END $$;


-- ==================== DOWN ====================

-- 删除触发器
DROP TRIGGER IF EXISTS storage_alert_trigger ON user_storage_usage;

-- 删除函数
DROP FUNCTION IF EXISTS trigger_storage_alert();
DROP FUNCTION IF EXISTS check_storage_quota(INTEGER, BIGINT);
DROP FUNCTION IF EXISTS record_storage_usage(INTEGER, VARCHAR, INTEGER, VARCHAR, BIGINT, JSONB);
DROP FUNCTION IF EXISTS initialize_user_storage(INTEGER);
DROP FUNCTION IF EXISTS get_user_storage_quota(INTEGER);

-- 删除表
DROP TABLE IF EXISTS admin_quota_modifications;
DROP TABLE IF EXISTS storage_transactions;
DROP TABLE IF EXISTS storage_usage_history;
DROP TABLE IF EXISTS user_storage_usage;

-- 删除 quota_alerts 表的新列
ALTER TABLE quota_alerts DROP COLUMN IF EXISTS current_usage_bytes;
ALTER TABLE quota_alerts DROP COLUMN IF EXISTS quota_bytes;
ALTER TABLE quota_alerts DROP COLUMN IF EXISTS feature_type;

-- 删除 plan_features 中的 storage_space 功能
DELETE FROM plan_features WHERE feature_code = 'storage_space';
