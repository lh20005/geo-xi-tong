-- 迁移文件: 066_add_generation_task_knowledge_summary.sql

-- ==================== UP ====================

ALTER TABLE generation_tasks
ADD COLUMN IF NOT EXISTS knowledge_summary TEXT;

COMMENT ON COLUMN generation_tasks.knowledge_summary IS '本地知识库摘要（仅用于生成，不持久化本地数据）';

-- ==================== DOWN ====================

ALTER TABLE generation_tasks
DROP COLUMN IF EXISTS knowledge_summary;
