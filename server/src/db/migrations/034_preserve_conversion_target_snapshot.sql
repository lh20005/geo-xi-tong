-- ==================== UP ====================
-- 迁移：保留转化目标快照数据
-- 问题：删除转化目标后，generation_tasks 中的 conversion_target_id 被设为 NULL，导致文章管理页面丢失转化目标信息
-- 解决方案：在 generation_tasks 表中添加转化目标快照字段，删除源数据时保留衍生数据

-- 1. 添加转化目标快照字段到 generation_tasks 表
ALTER TABLE generation_tasks 
ADD COLUMN IF NOT EXISTS conversion_target_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS conversion_target_industry VARCHAR(100),
ADD COLUMN IF NOT EXISTS conversion_target_website VARCHAR(500),
ADD COLUMN IF NOT EXISTS conversion_target_address VARCHAR(500);

-- 2. 从现有关联数据填充快照字段
UPDATE generation_tasks gt
SET 
  conversion_target_name = ct.company_name,
  conversion_target_industry = ct.industry,
  conversion_target_website = ct.website,
  conversion_target_address = ct.address
FROM conversion_targets ct
WHERE gt.conversion_target_id = ct.id
  AND gt.conversion_target_name IS NULL;

-- 3. 删除旧的外键约束（ON DELETE SET NULL）
ALTER TABLE generation_tasks 
DROP CONSTRAINT IF EXISTS generation_tasks_conversion_target_id_fkey;

-- 4. 重新添加外键约束，改为 ON DELETE SET NULL 但保留快照数据
ALTER TABLE generation_tasks 
ADD CONSTRAINT generation_tasks_conversion_target_id_fkey 
FOREIGN KEY (conversion_target_id) REFERENCES conversion_targets(id) ON DELETE SET NULL;

-- 5. 创建触发器函数：在创建/更新任务时自动填充快照
CREATE OR REPLACE FUNCTION sync_conversion_target_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  -- 当设置了 conversion_target_id 且快照字段为空时，自动填充
  IF NEW.conversion_target_id IS NOT NULL THEN
    SELECT 
      company_name, industry, website, address
    INTO 
      NEW.conversion_target_name, 
      NEW.conversion_target_industry, 
      NEW.conversion_target_website, 
      NEW.conversion_target_address
    FROM conversion_targets
    WHERE id = NEW.conversion_target_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. 创建触发器
DROP TRIGGER IF EXISTS trigger_sync_conversion_target_snapshot ON generation_tasks;
CREATE TRIGGER trigger_sync_conversion_target_snapshot
BEFORE INSERT OR UPDATE OF conversion_target_id ON generation_tasks
FOR EACH ROW
EXECUTE FUNCTION sync_conversion_target_snapshot();

-- 7. 添加字段注释
COMMENT ON COLUMN generation_tasks.conversion_target_name IS '转化目标公司名称快照（删除源数据后仍保留）';
COMMENT ON COLUMN generation_tasks.conversion_target_industry IS '转化目标行业类型快照';
COMMENT ON COLUMN generation_tasks.conversion_target_website IS '转化目标官网快照';
COMMENT ON COLUMN generation_tasks.conversion_target_address IS '转化目标地址快照';

-- ==================== DOWN ====================
-- 回滚：删除转化目标快照字段

-- 1. 删除触发器
DROP TRIGGER IF EXISTS trigger_sync_conversion_target_snapshot ON generation_tasks;

-- 2. 删除触发器函数
DROP FUNCTION IF EXISTS sync_conversion_target_snapshot();

-- 3. 删除快照字段
ALTER TABLE generation_tasks 
DROP COLUMN IF EXISTS conversion_target_name,
DROP COLUMN IF EXISTS conversion_target_industry,
DROP COLUMN IF EXISTS conversion_target_website,
DROP COLUMN IF EXISTS conversion_target_address;
