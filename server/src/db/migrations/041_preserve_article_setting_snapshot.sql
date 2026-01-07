-- ==================== UP ====================
-- 迁移：文章设置快照保留
-- 目标：删除 article_settings 记录后，generation_tasks 数据仍然完整可用
-- 方案：generation_tasks 独立存储 article_setting_name 和 article_setting_prompt，不依赖外键关联

-- ========== 1. generation_tasks 表添加快照字段 ==========
-- 1.1 添加独立字段
ALTER TABLE generation_tasks ADD COLUMN IF NOT EXISTS article_setting_name VARCHAR(255);
ALTER TABLE generation_tasks ADD COLUMN IF NOT EXISTS article_setting_prompt TEXT;

-- 1.2 从现有关联数据填充字段
UPDATE generation_tasks gt
SET 
  article_setting_name = ast.name,
  article_setting_prompt = ast.prompt
FROM article_settings ast
WHERE gt.article_setting_id = ast.id
  AND (gt.article_setting_name IS NULL OR gt.article_setting_prompt IS NULL);

-- 1.3 修改外键约束为 ON DELETE SET NULL
ALTER TABLE generation_tasks DROP CONSTRAINT IF EXISTS generation_tasks_article_setting_id_fkey;
ALTER TABLE generation_tasks ALTER COLUMN article_setting_id DROP NOT NULL;
ALTER TABLE generation_tasks ADD CONSTRAINT generation_tasks_article_setting_id_fkey 
  FOREIGN KEY (article_setting_id) REFERENCES article_settings(id) ON DELETE SET NULL;

-- 1.4 更新触发器函数：添加文章设置快照同步
CREATE OR REPLACE FUNCTION sync_generation_task_snapshots()
RETURNS TRIGGER AS $$
BEGIN
  -- 同步转化目标快照
  IF NEW.conversion_target_id IS NOT NULL THEN
    SELECT company_name, industry, website, address
    INTO NEW.conversion_target_name, NEW.conversion_target_industry, 
         NEW.conversion_target_website, NEW.conversion_target_address
    FROM conversion_targets
    WHERE id = NEW.conversion_target_id;
  END IF;
  
  -- 同步蒸馏关键词快照
  IF NEW.distillation_id IS NOT NULL AND NEW.distillation_keyword IS NULL THEN
    SELECT keyword INTO NEW.distillation_keyword
    FROM distillations
    WHERE id = NEW.distillation_id;
  END IF;
  
  -- 同步图库名称快照
  IF NEW.album_id IS NOT NULL AND NEW.album_name IS NULL THEN
    SELECT name INTO NEW.album_name
    FROM albums
    WHERE id = NEW.album_id;
  END IF;
  
  -- 同步知识库名称快照
  IF NEW.knowledge_base_id IS NOT NULL AND NEW.knowledge_base_name IS NULL THEN
    SELECT name INTO NEW.knowledge_base_name
    FROM knowledge_bases
    WHERE id = NEW.knowledge_base_id;
  END IF;
  
  -- 同步文章设置快照
  IF NEW.article_setting_id IS NOT NULL THEN
    IF NEW.article_setting_name IS NULL OR NEW.article_setting_name = '' THEN
      SELECT name INTO NEW.article_setting_name
      FROM article_settings
      WHERE id = NEW.article_setting_id;
    END IF;
    IF NEW.article_setting_prompt IS NULL OR NEW.article_setting_prompt = '' THEN
      SELECT prompt INTO NEW.article_setting_prompt
      FROM article_settings
      WHERE id = NEW.article_setting_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1.5 创建索引
CREATE INDEX IF NOT EXISTS idx_generation_tasks_article_setting_name ON generation_tasks(article_setting_name);

-- 1.6 添加字段注释
COMMENT ON COLUMN generation_tasks.article_setting_name IS '文章设置名称（独立存储，不依赖 article_settings）';
COMMENT ON COLUMN generation_tasks.article_setting_prompt IS '文章设置提示词（独立存储，不依赖 article_settings）';
COMMENT ON COLUMN generation_tasks.article_setting_id IS '来源文章设置ID（可选，仅作追踪用途，ON DELETE SET NULL）';

-- ==================== DOWN ====================
-- 回滚脚本

-- 1. 删除索引
DROP INDEX IF EXISTS idx_generation_tasks_article_setting_name;

-- 2. 删除快照字段
ALTER TABLE generation_tasks DROP COLUMN IF EXISTS article_setting_name;
ALTER TABLE generation_tasks DROP COLUMN IF EXISTS article_setting_prompt;

-- 3. 恢复外键约束为 ON DELETE CASCADE
ALTER TABLE generation_tasks DROP CONSTRAINT IF EXISTS generation_tasks_article_setting_id_fkey;
ALTER TABLE generation_tasks ALTER COLUMN article_setting_id SET NOT NULL;
ALTER TABLE generation_tasks ADD CONSTRAINT generation_tasks_article_setting_id_fkey 
  FOREIGN KEY (article_setting_id) REFERENCES article_settings(id) ON DELETE CASCADE;

-- 4. 恢复旧的触发器函数（不包含文章设置快照）
CREATE OR REPLACE FUNCTION sync_generation_task_snapshots()
RETURNS TRIGGER AS $$
BEGIN
  -- 同步转化目标快照
  IF NEW.conversion_target_id IS NOT NULL THEN
    SELECT company_name, industry, website, address
    INTO NEW.conversion_target_name, NEW.conversion_target_industry, 
         NEW.conversion_target_website, NEW.conversion_target_address
    FROM conversion_targets
    WHERE id = NEW.conversion_target_id;
  END IF;
  
  -- 同步蒸馏关键词快照
  IF NEW.distillation_id IS NOT NULL AND NEW.distillation_keyword IS NULL THEN
    SELECT keyword INTO NEW.distillation_keyword
    FROM distillations
    WHERE id = NEW.distillation_id;
  END IF;
  
  -- 同步图库名称快照
  IF NEW.album_id IS NOT NULL AND NEW.album_name IS NULL THEN
    SELECT name INTO NEW.album_name
    FROM albums
    WHERE id = NEW.album_id;
  END IF;
  
  -- 同步知识库名称快照
  IF NEW.knowledge_base_id IS NOT NULL AND NEW.knowledge_base_name IS NULL THEN
    SELECT name INTO NEW.knowledge_base_name
    FROM knowledge_bases
    WHERE id = NEW.knowledge_base_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
