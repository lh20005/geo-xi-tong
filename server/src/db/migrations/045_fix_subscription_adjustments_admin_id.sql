-- ==================== UP ====================
-- 修复 subscription_adjustments 表的 admin_id 约束
-- Migration: 045_fix_subscription_adjustments_admin_id.sql
-- Description: 允许 admin_id 为 NULL，以支持系统自动操作（如订阅到期自动退回免费版）

-- 移除 admin_id 的 NOT NULL 约束
ALTER TABLE subscription_adjustments ALTER COLUMN admin_id DROP NOT NULL;

-- 添加注释说明
COMMENT ON COLUMN subscription_adjustments.admin_id IS '操作管理员ID，系统自动操作时为NULL';

-- ==================== DOWN ====================
-- 回滚迁移（注意：如果已有 NULL 值的记录，需要先处理）

-- 将 NULL 值更新为系统用户（假设 ID=1 是管理员）
-- UPDATE subscription_adjustments SET admin_id = 1 WHERE admin_id IS NULL;

-- 恢复 NOT NULL 约束
-- ALTER TABLE subscription_adjustments ALTER COLUMN admin_id SET NOT NULL;
