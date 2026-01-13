-- ==================== UP ====================
-- 迁移 059: 性能优化 - 添加关键复合索引
-- 创建时间: 2026-01-13
-- 描述: 解决 Dashboard 和列表查询的全表扫描问题

-- 1. publishing_tasks 表优化索引
-- 解决 32,967 次全表扫描问题
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_publishing_tasks_user_created 
ON publishing_tasks(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_publishing_tasks_user_status_created 
ON publishing_tasks(user_id, status, created_at DESC);

-- 2. articles 表优化索引
-- 解决 Dashboard 文章统计查询
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_user_created 
ON articles(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_user_published_created 
ON articles(user_id, is_published, created_at DESC);

-- 3. distillations 表优化索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_distillations_user_created 
ON distillations(user_id, created_at DESC);

-- 4. generation_tasks 表优化索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generation_tasks_user_created 
ON generation_tasks(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generation_tasks_user_status_created 
ON generation_tasks(user_id, status, created_at DESC);

-- 5. topics 表优化索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_topics_user_created 
ON topics(user_id, created_at DESC);

-- 6. publishing_records 表优化索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_publishing_records_user_task 
ON publishing_records(user_id, task_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_publishing_records_task_platform 
ON publishing_records(task_id, platform_id);

-- 7. subscription_plans 表优化（解决 1,698 次全表扫描）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscription_plans_code_active 
ON subscription_plans(plan_code) WHERE is_active = true;

-- 8. platform_accounts 表优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_platform_accounts_user_platform 
ON platform_accounts(user_id, platform_id);

-- 9. 更新表统计信息
ANALYZE publishing_tasks;
ANALYZE articles;
ANALYZE distillations;
ANALYZE generation_tasks;
ANALYZE topics;
ANALYZE publishing_records;
ANALYZE subscription_plans;
ANALYZE platform_accounts;

-- ==================== DOWN ====================
-- DROP INDEX CONCURRENTLY IF EXISTS idx_publishing_tasks_user_created;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_publishing_tasks_user_status_created;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_articles_user_created;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_articles_user_published_created;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_distillations_user_created;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_generation_tasks_user_created;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_generation_tasks_user_status_created;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_topics_user_created;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_publishing_records_user_task;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_publishing_records_task_platform;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_subscription_plans_code_active;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_platform_accounts_user_platform;
