-- ==================== UP ====================
-- 添加缺失的数据库列
-- 
-- 描述：添加在初始迁移后发现缺失的列
-- 日期：2025-12-27

-- 1. conversion_targets 表：添加 address 列
ALTER TABLE conversion_targets 
ADD COLUMN IF NOT EXISTS address VARCHAR(500);

COMMENT ON COLUMN conversion_targets.address IS '公司地址';

-- 2. distillations 表：添加 usage_count 列
ALTER TABLE distillations 
ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

COMMENT ON COLUMN distillations.usage_count IS '使用次数统计';

-- 3. 创建索引以提升性能
CREATE INDEX IF NOT EXISTS idx_distillations_usage_count 
ON distillations(usage_count DESC);

-- 4. users 表：确保邀请相关字段存在
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS invitation_code VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS invited_by_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS is_temp_password BOOLEAN DEFAULT false;

-- 5. 为现有用户生成邀请码（如果没有）
UPDATE users 
SET invitation_code = LOWER(SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT) FROM 1 FOR 6))
WHERE invitation_code IS NULL;

-- 6. 创建邀请相关索引
CREATE INDEX IF NOT EXISTS idx_users_invitation_code 
ON users(invitation_code) WHERE invitation_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_invited_by_code 
ON users(invited_by_code) WHERE invited_by_code IS NOT NULL;

-- 7. articles 表：添加发布相关字段
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS topic_id INTEGER REFERENCES topics(id),
ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS published_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_articles_topic_id 
ON articles(topic_id) WHERE topic_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_articles_is_published 
ON articles(is_published);

-- 8. topics 表：添加使用统计字段
ALTER TABLE topics 
ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_topics_usage_count 
ON topics(usage_count DESC);

-- 9. publishing_tasks 表：添加批次相关字段
ALTER TABLE publishing_tasks 
ADD COLUMN IF NOT EXISTS batch_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS batch_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS interval_minutes INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_publishing_tasks_batch_id 
ON publishing_tasks(batch_id) WHERE batch_id IS NOT NULL;

-- 10. generation_tasks 表：添加智能选择字段
ALTER TABLE generation_tasks 
ADD COLUMN IF NOT EXISTS selected_distillation_ids TEXT;

COMMENT ON COLUMN generation_tasks.selected_distillation_ids IS '选中的蒸馏结果ID列表（JSON数组）';

-- ==================== DOWN ====================
-- 回滚：删除添加的列

-- 1. 删除 conversion_targets.address
ALTER TABLE conversion_targets 
DROP COLUMN IF EXISTS address;

-- 2. 删除 distillations.usage_count 及其索引
DROP INDEX IF EXISTS idx_distillations_usage_count;
ALTER TABLE distillations 
DROP COLUMN IF EXISTS usage_count;

-- 3. 删除 users 邀请相关字段及索引
DROP INDEX IF EXISTS idx_users_invitation_code;
DROP INDEX IF EXISTS idx_users_invited_by_code;
ALTER TABLE users 
DROP COLUMN IF EXISTS invitation_code,
DROP COLUMN IF EXISTS invited_by_code,
DROP COLUMN IF EXISTS is_temp_password;

-- 4. 删除 articles 发布相关字段及索引
DROP INDEX IF EXISTS idx_articles_topic_id;
DROP INDEX IF EXISTS idx_articles_is_published;
ALTER TABLE articles 
DROP COLUMN IF EXISTS topic_id,
DROP COLUMN IF EXISTS is_published,
DROP COLUMN IF EXISTS published_at;

-- 5. 删除 topics.usage_count 及其索引
DROP INDEX IF EXISTS idx_topics_usage_count;
ALTER TABLE topics 
DROP COLUMN IF EXISTS usage_count;

-- 6. 删除 publishing_tasks 批次相关字段及索引
DROP INDEX IF EXISTS idx_publishing_tasks_batch_id;
ALTER TABLE publishing_tasks 
DROP COLUMN IF EXISTS batch_id,
DROP COLUMN IF EXISTS batch_order,
DROP COLUMN IF EXISTS interval_minutes;

-- 7. 删除 generation_tasks.selected_distillation_ids
ALTER TABLE generation_tasks 
DROP COLUMN IF EXISTS selected_distillation_ids;
