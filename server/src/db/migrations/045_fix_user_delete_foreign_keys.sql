-- ==================== UP ====================
-- 修复用户删除时的外键约束问题
-- 为缺少 ON DELETE CASCADE/SET NULL 的外键添加正确的删除行为

-- 1. 修复 commission_records 表的 invited_user_id 外键
ALTER TABLE commission_records 
DROP CONSTRAINT IF EXISTS commission_records_invited_user_id_fkey;

ALTER TABLE commission_records 
ADD CONSTRAINT commission_records_invited_user_id_fkey 
FOREIGN KEY (invited_user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 2. 修复 agent_audit_logs 表的 operator_id 外键
ALTER TABLE agent_audit_logs 
DROP CONSTRAINT IF EXISTS agent_audit_logs_operator_id_fkey;

ALTER TABLE agent_audit_logs 
ADD CONSTRAINT agent_audit_logs_operator_id_fkey 
FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE SET NULL;

-- 3. 修复 subscription_adjustments 表的 admin_id 外键
ALTER TABLE subscription_adjustments 
DROP CONSTRAINT IF EXISTS subscription_adjustments_admin_id_fkey;

ALTER TABLE subscription_adjustments 
ADD CONSTRAINT subscription_adjustments_admin_id_fkey 
FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL;

-- 4. 修复 plan_change_history 表的 changed_by 外键（如果存在）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_change_history') THEN
    ALTER TABLE plan_change_history 
    DROP CONSTRAINT IF EXISTS plan_change_history_changed_by_fkey;
    
    ALTER TABLE plan_change_history 
    ADD CONSTRAINT plan_change_history_changed_by_fkey 
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. 修复 system_api_configs 表的 created_by 外键（如果存在）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_api_configs') THEN
    ALTER TABLE system_api_configs 
    DROP CONSTRAINT IF EXISTS system_api_configs_created_by_fkey;
    
    ALTER TABLE system_api_configs 
    ADD CONSTRAINT system_api_configs_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6. 修复 security_config 表的外键（如果存在）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'security_config') THEN
    ALTER TABLE security_config 
    DROP CONSTRAINT IF EXISTS security_config_created_by_fkey;
    
    ALTER TABLE security_config 
    ADD CONSTRAINT security_config_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    
    ALTER TABLE security_config 
    DROP CONSTRAINT IF EXISTS security_config_updated_by_fkey;
    
    ALTER TABLE security_config 
    ADD CONSTRAINT security_config_updated_by_fkey 
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 7. 修复 security_config_history 表的 changed_by 外键（如果存在）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'security_config_history') THEN
    ALTER TABLE security_config_history 
    DROP CONSTRAINT IF EXISTS security_config_history_changed_by_fkey;
    
    ALTER TABLE security_config_history 
    ADD CONSTRAINT security_config_history_changed_by_fkey 
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;


-- ==================== DOWN ====================
-- 回滚迁移（恢复原始外键约束，不带 ON DELETE 行为）

-- 1. 恢复 commission_records 表的 invited_user_id 外键
ALTER TABLE commission_records 
DROP CONSTRAINT IF EXISTS commission_records_invited_user_id_fkey;

ALTER TABLE commission_records 
ADD CONSTRAINT commission_records_invited_user_id_fkey 
FOREIGN KEY (invited_user_id) REFERENCES users(id);

-- 2. 恢复 agent_audit_logs 表的 operator_id 外键
ALTER TABLE agent_audit_logs 
DROP CONSTRAINT IF EXISTS agent_audit_logs_operator_id_fkey;

ALTER TABLE agent_audit_logs 
ADD CONSTRAINT agent_audit_logs_operator_id_fkey 
FOREIGN KEY (operator_id) REFERENCES users(id);

-- 3. 恢复 subscription_adjustments 表的 admin_id 外键
ALTER TABLE subscription_adjustments 
DROP CONSTRAINT IF EXISTS subscription_adjustments_admin_id_fkey;

ALTER TABLE subscription_adjustments 
ADD CONSTRAINT subscription_adjustments_admin_id_fkey 
FOREIGN KEY (admin_id) REFERENCES users(id);
