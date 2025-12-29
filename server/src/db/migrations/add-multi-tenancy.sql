-- ========================================
-- 多租户数据隔离迁移脚本
-- 为核心业务表添加 user_id 字段
-- ========================================

-- 1. 为相册表添加用户关联
ALTER TABLE albums 
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- 为现有数据设置默认用户（假设ID为1的用户）
UPDATE albums SET user_id = 1 WHERE user_id IS NULL;

-- 设置为必填字段
ALTER TABLE albums ALTER COLUMN user_id SET NOT NULL;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_albums_user_id ON albums(user_id);

-- 2. 为知识库表添加用户关联
ALTER TABLE knowledge_bases 
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

UPDATE knowledge_bases SET user_id = 1 WHERE user_id IS NULL;
ALTER TABLE knowledge_bases ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_user_id ON knowledge_bases(user_id);

-- 3. 为转化目标表添加用户关联
ALTER TABLE conversion_targets 
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

UPDATE conversion_targets SET user_id = 1 WHERE user_id IS NULL;
ALTER TABLE conversion_targets ALTER COLUMN user_id SET NOT NULL;

-- 修改唯一约束：公司名称在同一用户下唯一
ALTER TABLE conversion_targets DROP CONSTRAINT IF EXISTS unique_company_name;
ALTER TABLE conversion_targets ADD CONSTRAINT unique_user_company_name UNIQUE (user_id, company_name);
CREATE INDEX IF NOT EXISTS idx_conversion_targets_user_id ON conversion_targets(user_id);

-- 4. 为文章设置表添加用户关联
ALTER TABLE article_settings 
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

UPDATE article_settings SET user_id = 1 WHERE user_id IS NULL;
ALTER TABLE article_settings ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_article_settings_user_id ON article_settings(user_id);

-- 5. 为关键词蒸馏记录表添加用户关联
ALTER TABLE distillations 
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

UPDATE distillations SET user_id = 1 WHERE user_id IS NULL;
ALTER TABLE distillations ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_distillations_user_id ON distillations(user_id);

-- 6. 为文章表添加用户关联
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

UPDATE articles SET user_id = 1 WHERE user_id IS NULL;
ALTER TABLE articles ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_articles_user_id ON articles(user_id);

-- 7. 为文章生成任务表添加用户关联
ALTER TABLE generation_tasks 
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

UPDATE generation_tasks SET user_id = 1 WHERE user_id IS NULL;
ALTER TABLE generation_tasks ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_generation_tasks_user_id ON generation_tasks(user_id);

-- 8. 为平台账号表添加用户关联
ALTER TABLE platform_accounts 
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

UPDATE platform_accounts SET user_id = 1 WHERE user_id IS NULL;
ALTER TABLE platform_accounts ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_platform_accounts_user_id ON platform_accounts(user_id);

-- 9. 为关键词蒸馏配置表添加用户关联（可选，如果希望每个用户有自己的配置）
ALTER TABLE distillation_config 
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

UPDATE distillation_config SET user_id = 1 WHERE user_id IS NULL;
-- 注意：这里不设置为必填，NULL表示全局配置
CREATE INDEX IF NOT EXISTS idx_distillation_config_user_id ON distillation_config(user_id);

-- 10. 为API配置表添加用户关联（每个用户可以有自己的API配置）
ALTER TABLE api_configs 
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

UPDATE api_configs SET user_id = 1 WHERE user_id IS NULL;
ALTER TABLE api_configs ALTER COLUMN user_id SET NOT NULL;

-- 修改唯一约束：同一用户下每个provider只能有一个激活的配置
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_configs_user_provider_active 
ON api_configs(user_id, provider) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_configs_user_id ON api_configs(user_id);

-- 11. 为发布任务表添加用户关联
ALTER TABLE publishing_tasks 
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

UPDATE publishing_tasks SET user_id = 1 WHERE user_id IS NULL;
ALTER TABLE publishing_tasks ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_publishing_tasks_user_id ON publishing_tasks(user_id);

-- ========================================
-- 完成
-- ========================================
