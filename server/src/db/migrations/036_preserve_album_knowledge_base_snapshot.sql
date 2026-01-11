-- ==================== UP ====================
-- 迁移：保留企业图库和企业知识库快照数据
-- 问题：删除图库或知识库后，generation_tasks 中的关联ID被设为 NULL，导致文章生成页面丢失相关信息
-- 解决方案：在 generation_tasks 表中添加快照字段，删除源数据时保留衍生数据

-- 1. 添加快照字段到 generation_tasks 表
ALTER TABLE generation_tasks 
ADD COLUMN IF NOT EXISTS album_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS knowledge_base_name VARCHAR(255);

-- 2. 从现有关联数据填充快照字段
UPDATE generation_tasks gt
SET album_name = a.name
FROM albums a
WHERE gt.album_id = a.id
  AND gt.album_name IS NULL;

UPDATE generation_tasks gt
SET knowledge_base_name = kb.name
FROM knowledge_bases kb
WHERE gt.knowledge_base_id = kb.id
  AND gt.knowledge_base_name IS NULL;

-- 3. 删除旧的外键约束
ALTER TABLE generation_tasks 
DROP CONSTRAINT IF EXISTS generation_tasks_album_id_fkey;

ALTER TABLE generation_tasks 
DROP CONSTRAINT IF EXISTS generation_tasks_knowledge_base_id_fkey;

-- 4. 重新添加外键约束，改为 ON DELETE SET NULL
ALTER TABLE generation_tasks 
ADD CONSTRAINT generation_tasks_album_id_fkey 
FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL;

ALTER TABLE generation_tasks 
ADD CONSTRAINT generation_tasks_knowledge_base_id_fkey 
FOREIGN KEY (knowledge_base_id) REFERENCES knowledge_bases(id) ON DELETE SET NULL;

-- 5. 更新触发器函数：统一处理所有快照字段
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

-- 6. 删除旧的单独触发器，创建统一触发器
DROP TRIGGER IF EXISTS trigger_sync_conversion_target_snapshot ON generation_tasks;
DROP TRIGGER IF EXISTS trigger_sync_distillation_keyword ON generation_tasks;
DROP TRIGGER IF EXISTS trigger_sync_generation_task_snapshots ON generation_tasks;

CREATE TRIGGER trigger_sync_generation_task_snapshots
BEFORE INSERT ON generation_tasks
FOR EACH ROW
EXECUTE FUNCTION sync_generation_task_snapshots();

-- 7. 添加索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_generation_tasks_album_name ON generation_tasks(album_name);
CREATE INDEX IF NOT EXISTS idx_generation_tasks_knowledge_base_name ON generation_tasks(knowledge_base_name);

-- 8. 添加字段注释
COMMENT ON COLUMN generation_tasks.album_name IS '企业图库名称快照（删除源数据后仍保留）';
COMMENT ON COLUMN generation_tasks.knowledge_base_name IS '企业知识库名称快照（删除源数据后仍保留）';

-- ==================== DOWN ====================
-- 回滚：删除快照字段

-- 1. 删除统一触发器
DROP TRIGGER IF EXISTS trigger_sync_generation_task_snapshots ON generation_tasks;

-- 2. 恢复旧的单独触发器
CREATE TRIGGER trigger_sync_conversion_target_snapshot
BEFORE INSERT OR UPDATE OF conversion_target_id ON generation_tasks
FOR EACH ROW
EXECUTE FUNCTION sync_conversion_target_snapshot();

-- 3. 删除索引
DROP INDEX IF EXISTS idx_generation_tasks_album_name;
DROP INDEX IF EXISTS idx_generation_tasks_knowledge_base_name;

-- 4. 删除快照字段
ALTER TABLE generation_tasks 
DROP COLUMN IF EXISTS album_name,
DROP COLUMN IF EXISTS knowledge_base_name;
