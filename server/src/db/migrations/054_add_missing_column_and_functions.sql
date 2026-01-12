-- ==================== UP ====================
-- 迁移 054: 添加缺失的列和函数
-- 创建时间: 2026-01-12
-- 描述: 
--   1. 添加 user_subscriptions.next_plan_id 列
--   2. 添加缺失的基础函数

-- ============================================
-- 1. 添加 user_subscriptions.next_plan_id 列
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_subscriptions' AND column_name = 'next_plan_id'
  ) THEN
    ALTER TABLE user_subscriptions ADD COLUMN next_plan_id INTEGER REFERENCES subscription_plans(id);
    COMMENT ON COLUMN user_subscriptions.next_plan_id IS '下一个套餐ID（用于降级，到期后生效）';
  END IF;
END $$;

-- ============================================
-- 2. 添加 generate_invitation_code 函数
-- ============================================
CREATE OR REPLACE FUNCTION generate_invitation_code() RETURNS VARCHAR(6) AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result VARCHAR(6) := '';
  i INTEGER;
  code_exists BOOLEAN;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    
    -- 检查代码是否已存在
    SELECT EXISTS(SELECT 1 FROM users WHERE invitation_code = result) INTO code_exists;
    
    IF NOT code_exists THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_invitation_code() IS '生成唯一的6位邀请码';

-- ============================================
-- 3. 添加 cleanup_expired_tokens 函数
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_tokens() RETURNS void AS $$
BEGIN
  DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_tokens() IS '清理过期的刷新令牌';

-- ============================================
-- 4. 添加 update_updated_at_column 触发器函数
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at_column() IS '自动更新 updated_at 列的触发器函数';

-- ============================================
-- 5. 添加 update_security_config_updated_at 触发器函数
-- ============================================
CREATE OR REPLACE FUNCTION update_security_config_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_security_config_updated_at() IS '自动更新 security_config.updated_at 列的触发器函数';

-- ============================================
-- 6. 创建 users 表的 updated_at 触发器（如果不存在）
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at'
  ) THEN
    CREATE TRIGGER update_users_updated_at 
      BEFORE UPDATE ON users 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- 7. 创建 security_config 表的 updated_at 触发器（如果不存在）
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_security_config_updated_at_trigger'
  ) THEN
    CREATE TRIGGER update_security_config_updated_at_trigger 
      BEFORE UPDATE ON security_config 
      FOR EACH ROW 
      EXECUTE FUNCTION update_security_config_updated_at();
  END IF;
END $$;

-- ============================================
-- 8. 添加 sync_topic_keyword_snapshot 函数（兼容旧代码）
-- ============================================
CREATE OR REPLACE FUNCTION sync_topic_keyword_snapshot() RETURNS trigger AS $$
BEGIN
    -- 如果没有提供 keyword，从 distillations 表获取
    IF NEW.keyword IS NULL AND NEW.distillation_id IS NOT NULL THEN
        SELECT keyword INTO NEW.keyword
        FROM distillations
        WHERE id = NEW.distillation_id;
    END IF;

    -- 如果没有提供 user_id，从 distillations 表获取
    IF NEW.user_id IS NULL AND NEW.distillation_id IS NOT NULL THEN
        SELECT user_id INTO NEW.user_id
        FROM distillations
        WHERE id = NEW.distillation_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_topic_keyword_snapshot() IS '同步 topic 的 keyword 和 user_id（兼容旧代码）';

-- ============================================
-- 9. 添加 sync_topic_usage_keyword_snapshot 函数
-- ============================================
CREATE OR REPLACE FUNCTION sync_topic_usage_keyword_snapshot() RETURNS trigger AS $$
BEGIN
  IF NEW.distillation_id IS NOT NULL AND NEW.keyword IS NULL THEN
    SELECT keyword INTO NEW.keyword
    FROM distillations
    WHERE id = NEW.distillation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_topic_usage_keyword_snapshot() IS '同步 topic_usage 的 keyword';

-- ============================================
-- 10. 添加 sync_generation_task_distillation_snapshot 函数
-- ============================================
CREATE OR REPLACE FUNCTION sync_generation_task_distillation_snapshot() RETURNS trigger AS $$
BEGIN
  IF NEW.distillation_id IS NOT NULL AND NEW.distillation_keyword IS NULL THEN
    SELECT keyword INTO NEW.distillation_keyword
    FROM distillations
    WHERE id = NEW.distillation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_generation_task_distillation_snapshot() IS '同步 generation_task 的 distillation_keyword';

-- ==================== DOWN ====================
-- 回滚：删除添加的列和函数

-- 删除触发器
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_security_config_updated_at_trigger ON security_config;

-- 删除函数
DROP FUNCTION IF EXISTS sync_generation_task_distillation_snapshot();
DROP FUNCTION IF EXISTS sync_topic_usage_keyword_snapshot();
DROP FUNCTION IF EXISTS sync_topic_keyword_snapshot();
DROP FUNCTION IF EXISTS update_security_config_updated_at();
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS cleanup_expired_tokens();
DROP FUNCTION IF EXISTS generate_invitation_code();

-- 删除列
ALTER TABLE user_subscriptions DROP COLUMN IF EXISTS next_plan_id;
