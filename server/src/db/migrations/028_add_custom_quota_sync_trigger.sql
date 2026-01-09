-- ==================== UP ====================
-- ========================================
-- 迁移 028: 添加自定义配额同步触发器
-- 创建时间: 2026-01-05
-- 描述: 当 user_subscriptions.custom_quotas 更新时，自动同步 user_storage_usage.storage_quota_bytes
-- ========================================

BEGIN;

-- 1. 创建触发器函数：同步存储空间配额
CREATE OR REPLACE FUNCTION sync_storage_quota_on_custom_quota_change()
RETURNS TRIGGER AS $$
DECLARE
  v_storage_quota_mb INTEGER;
  v_storage_quota_bytes BIGINT;
BEGIN
  -- 检查是否有 storage_space 的自定义配额
  IF NEW.custom_quotas IS NOT NULL AND NEW.custom_quotas ? 'storage_space' THEN
    -- 从 custom_quotas 中获取存储空间配额（MB）
    v_storage_quota_mb := (NEW.custom_quotas->>'storage_space')::INTEGER;
    
    -- 转换为字节
    IF v_storage_quota_mb = -1 THEN
      v_storage_quota_bytes := -1;
    ELSE
      v_storage_quota_bytes := v_storage_quota_mb::BIGINT * 1024 * 1024;
    END IF;
    
    -- 更新 user_storage_usage 表
    UPDATE user_storage_usage
    SET storage_quota_bytes = v_storage_quota_bytes,
        last_updated_at = CURRENT_TIMESTAMP
    WHERE user_id = NEW.user_id;
    
    RAISE NOTICE '同步存储配额: 用户 %, 新配额 % MB (% bytes)', 
      NEW.user_id, v_storage_quota_mb, v_storage_quota_bytes;
  ELSIF (OLD.custom_quotas IS NOT NULL AND OLD.custom_quotas ? 'storage_space') 
        AND (NEW.custom_quotas IS NULL OR NOT NEW.custom_quotas ? 'storage_space') THEN
    -- 如果删除了自定义配额，恢复为套餐默认配额
    UPDATE user_storage_usage
    SET storage_quota_bytes = get_user_storage_quota(NEW.user_id),
        last_updated_at = CURRENT_TIMESTAMP
    WHERE user_id = NEW.user_id;
    
    RAISE NOTICE '恢复默认存储配额: 用户 %', NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_storage_quota_on_custom_quota_change IS 
  '当 user_subscriptions.custom_quotas 更新时，自动同步 user_storage_usage.storage_quota_bytes';

-- 2. 创建触发器
DROP TRIGGER IF EXISTS trigger_sync_storage_quota ON user_subscriptions;

CREATE TRIGGER trigger_sync_storage_quota
  AFTER INSERT OR UPDATE OF custom_quotas
  ON user_subscriptions
  FOR EACH ROW
  WHEN (NEW.status = 'active' AND NEW.end_date > CURRENT_TIMESTAMP)
  EXECUTE FUNCTION sync_storage_quota_on_custom_quota_change();

COMMENT ON TRIGGER trigger_sync_storage_quota ON user_subscriptions IS
  '自动同步存储空间配额到 user_storage_usage 表';

-- 3. 同步现有的自定义配额
DO $$
DECLARE
  v_sub RECORD;
  v_storage_quota_mb INTEGER;
  v_storage_quota_bytes BIGINT;
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE '开始同步现有的自定义存储配额...';
  
  FOR v_sub IN 
    SELECT user_id, custom_quotas
    FROM user_subscriptions
    WHERE status = 'active' 
      AND end_date > CURRENT_TIMESTAMP
      AND custom_quotas IS NOT NULL
      AND custom_quotas ? 'storage_space'
  LOOP
    v_storage_quota_mb := (v_sub.custom_quotas->>'storage_space')::INTEGER;
    
    IF v_storage_quota_mb = -1 THEN
      v_storage_quota_bytes := -1;
    ELSE
      v_storage_quota_bytes := v_storage_quota_mb::BIGINT * 1024 * 1024;
    END IF;
    
    UPDATE user_storage_usage
    SET storage_quota_bytes = v_storage_quota_bytes,
        last_updated_at = CURRENT_TIMESTAMP
    WHERE user_id = v_sub.user_id;
    
    v_count := v_count + 1;
    RAISE NOTICE '  同步用户 %: % MB', v_sub.user_id, v_storage_quota_mb;
  END LOOP;
  
  RAISE NOTICE '✅ 已同步 % 个用户的自定义存储配额', v_count;
END $$;

COMMIT;

-- ========================================
-- 验证迁移
-- ========================================

DO $$
BEGIN
  -- 检查触发器是否创建成功
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_sync_storage_quota'
  ) THEN
    RAISE NOTICE '✅ 迁移 028 成功完成';
    RAISE NOTICE '   - 创建了 sync_storage_quota_on_custom_quota_change 函数';
    RAISE NOTICE '   - 创建了 trigger_sync_storage_quota 触发器';
    RAISE NOTICE '   - 同步了现有的自定义存储配额';
  ELSE
    RAISE EXCEPTION '❌ 迁移 028 失败：触发器未创建';
  END IF;
END $$;

-- ==================== DOWN ====================
-- Rollback not implemented for this migration
