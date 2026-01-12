-- ==================== UP ====================
-- 迁移 057: 添加缺失的触发器
-- 创建时间: 2026-01-12
-- 描述: 添加 trigger_sync_topic_usage_keyword_snapshot 触发器
--       该触发器在迁移054中定义了函数但遗漏了触发器创建

-- ============================================
-- 1. 创建 topic_usage 表的 keyword 同步触发器
-- ============================================
-- 先删除再创建，确保幂等性
DROP TRIGGER IF EXISTS trigger_sync_topic_usage_keyword_snapshot ON topic_usage;

CREATE TRIGGER trigger_sync_topic_usage_keyword_snapshot
  BEFORE INSERT ON topic_usage
  FOR EACH ROW
  EXECUTE FUNCTION sync_topic_usage_keyword_snapshot();

-- ==================== DOWN ====================
-- 回滚：删除触发器

DROP TRIGGER IF EXISTS trigger_sync_topic_usage_keyword_snapshot ON topic_usage;
