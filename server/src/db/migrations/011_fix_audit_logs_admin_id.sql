-- ==========================================
-- 修复审计日志表的 admin_id 约束
-- 版本: 011
-- 创建时间: 2024-12-24
-- 描述: 允许 admin_id 为 NULL 以支持系统操作
-- ==========================================

-- 修改 admin_id 列为可空
ALTER TABLE audit_logs 
  ALTER COLUMN admin_id DROP NOT NULL;

-- 添加注释说明
COMMENT ON COLUMN audit_logs.admin_id IS '执行操作的管理员ID (NULL表示系统操作)';

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '✅ audit_logs 表修复完成';
  RAISE NOTICE '   - admin_id 现在可以为 NULL (用于系统操作)';
END $$;
