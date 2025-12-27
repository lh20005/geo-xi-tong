-- ==================== UP ====================
-- 初始数据库结构
-- 
-- 描述：创建所有基础表和索引
-- 日期：2025-12-27

-- 此迁移包含完整的数据库结构
-- 从 complete-migration.sql 导入

-- 由于内容较长，这里使用占位符
-- 实际部署时，将 complete-migration.sql 的内容复制到这里

-- 提示：运行以下命令生成完整的初始迁移：
-- cat server/src/db/complete-migration.sql > server/src/db/migrations/001_initial_schema_up.sql

SELECT 'Initial schema migration - placeholder' as message;

-- ==================== DOWN ====================
-- 回滚初始结构（删除所有表）

-- 警告：这将删除所有数据！

DROP TABLE IF EXISTS admin_logs CASCADE;
DROP TABLE IF EXISTS albums CASCADE;
DROP TABLE IF EXISTS api_configs CASCADE;
DROP TABLE IF EXISTS article_settings CASCADE;
DROP TABLE IF EXISTS articles CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS config_history CASCADE;
DROP TABLE IF EXISTS conversion_targets CASCADE;
DROP TABLE IF EXISTS distillation_config CASCADE;
DROP TABLE IF EXISTS distillation_usage CASCADE;
DROP TABLE IF EXISTS distillations CASCADE;
DROP TABLE IF EXISTS generation_tasks CASCADE;
DROP TABLE IF EXISTS image_usage CASCADE;
DROP TABLE IF EXISTS images CASCADE;
DROP TABLE IF EXISTS ip_whitelist CASCADE;
DROP TABLE IF EXISTS knowledge_bases CASCADE;
DROP TABLE IF EXISTS knowledge_documents CASCADE;
DROP TABLE IF EXISTS login_attempts CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS password_history CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS plan_features CASCADE;
DROP TABLE IF EXISTS platform_accounts CASCADE;
DROP TABLE IF EXISTS platforms_config CASCADE;
DROP TABLE IF EXISTS product_config_history CASCADE;
DROP TABLE IF EXISTS publishing_logs CASCADE;
DROP TABLE IF EXISTS publishing_records CASCADE;
DROP TABLE IF EXISTS publishing_tasks CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS security_alerts CASCADE;
DROP TABLE IF EXISTS security_config CASCADE;
DROP TABLE IF EXISTS security_config_history CASCADE;
DROP TABLE IF EXISTS security_events CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;
DROP TABLE IF EXISTS topic_usage CASCADE;
DROP TABLE IF EXISTS topics CASCADE;
DROP TABLE IF EXISTS user_permissions CASCADE;
DROP TABLE IF EXISTS user_subscriptions CASCADE;
DROP TABLE IF EXISTS user_usage CASCADE;
DROP TABLE IF EXISTS users CASCADE;
