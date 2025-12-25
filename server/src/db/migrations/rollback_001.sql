-- ==========================================
-- 安全基础设施数据库回滚脚本
-- 版本: 001
-- 描述: 回滚安全相关表的创建
-- ==========================================

-- 删除表 (按依赖关系逆序删除)
DROP TABLE IF EXISTS login_attempts CASCADE;
DROP TABLE IF EXISTS password_history CASCADE;
DROP TABLE IF EXISTS config_history CASCADE;
DROP TABLE IF EXISTS security_events CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;

-- 回滚 refresh_tokens 表的修改
ALTER TABLE refresh_tokens 
  DROP COLUMN IF EXISTS ip_address,
  DROP COLUMN IF EXISTS user_agent,
  DROP COLUMN IF EXISTS last_used_at;

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '✅ 安全基础设施表回滚完成';
END $$;
