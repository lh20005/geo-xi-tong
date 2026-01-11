-- ==================== UP ====================
-- 迁移：topics 表完全解耦设计
-- 目标：删除 distillations 记录后，topics 数据仍然完整可用
-- 方案：topics 独立存储 keyword 和 user_id，不依赖外键关联

-- ========== 1. topics 表 ==========
-- 1.1 添加独立字段
ALTER TABLE topics ADD COLUMN IF NOT EXISTS keyword VARCHAR(255);
ALTER TABLE topics ADD COLUMN IF NOT EXISTS user_id INTEGER;

-- 1.2 从现有关联数据填充字段
UPDATE topics t
SET keyword = d.keyword, user_id = d.user_id
FROM distillations d
WHERE t.distillation_id = d.id
  AND (t.keyword IS NULL OR t.user_id IS NULL);

-- 1.3 设置 NOT NULL 约束（确保数据完整性）
-- 注意：执行前需确保所有现有数据都已填充
ALTER TABLE topics ALTER COLUMN keyword SET NOT NULL;
ALTER TABLE topics ALTER COLUMN user_id SET NOT NULL;

-- 1.4 修改外键约束为 ON DELETE SET NULL
ALTER TABLE topics DROP CONSTRAINT IF EXISTS topics_distillation_id_fkey;
ALTER TABLE topics ADD CONSTRAINT topics_distillation_id_fkey 
  FOREIGN KEY (distillation_id) REFERENCES distillations(id) ON DELETE SET NULL;

-- 1.5 创建触发器：新建 topic 时自动填充（兼容旧代码）
CREATE OR REPLACE FUNCTION sync_topic_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.distillation_id IS NOT NULL THEN
    IF NEW.keyword IS NULL OR NEW.keyword = '' THEN
      SELECT keyword INTO NEW.keyword FROM distillations WHERE id = NEW.distillation_id;
    END IF;
    IF NEW.user_id IS NULL THEN
      SELECT user_id INTO NEW.user_id FROM distillations WHERE id = NEW.distillation_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_topic_keyword_snapshot ON topics;
DROP TRIGGER IF EXISTS trigger_sync_topic_snapshot ON topics;
CREATE TRIGGER trigger_sync_topic_snapshot
  BEFORE INSERT ON topics
  FOR EACH ROW
  EXECUTE FUNCTION sync_topic_snapshot();

-- 1.6 创建索引
CREATE INDEX IF NOT EXISTS idx_topics_keyword ON topics(keyword);
CREATE INDEX IF NOT EXISTS idx_topics_user_id ON topics(user_id);

-- 1.7 添加字段注释
COMMENT ON COLUMN topics.keyword IS '关键词（独立存储，不依赖 distillations）';
COMMENT ON COLUMN topics.user_id IS '用户ID（独立存储，用于多租户隔离）';
COMMENT ON COLUMN topics.distillation_id IS '来源蒸馏ID（可选，仅作追踪用途，ON DELETE SET NULL）';

-- ========== 2. generation_tasks 表 ==========
ALTER TABLE generation_tasks ADD COLUMN IF NOT EXISTS distillation_keyword VARCHAR(255);

UPDATE generation_tasks gt
SET distillation_keyword = d.keyword
FROM distillations d
WHERE gt.distillation_id = d.id AND gt.distillation_keyword IS NULL;

ALTER TABLE generation_tasks DROP CONSTRAINT IF EXISTS generation_tasks_distillation_id_fkey;
ALTER TABLE generation_tasks ALTER COLUMN distillation_id DROP NOT NULL;
ALTER TABLE generation_tasks ADD CONSTRAINT generation_tasks_distillation_id_fkey 
  FOREIGN KEY (distillation_id) REFERENCES distillations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_generation_tasks_distillation_keyword ON generation_tasks(distillation_keyword);
COMMENT ON COLUMN generation_tasks.distillation_keyword IS '关键词（独立存储）';

-- ========== 3. topic_usage 表 ==========
-- 添加 keyword 列用于独立存储
ALTER TABLE topic_usage ADD COLUMN IF NOT EXISTS keyword VARCHAR(255);

-- 通过 topic_id 关联获取 keyword（topic_usage 没有 distillation_id 列）
UPDATE topic_usage tu
SET keyword = t.keyword
FROM topics t
WHERE tu.topic_id = t.id AND tu.keyword IS NULL AND t.keyword IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_topic_usage_keyword ON topic_usage(keyword);
COMMENT ON COLUMN topic_usage.keyword IS '关键词（独立存储）';

-- ==================== DOWN ====================
-- 回滚：恢复原有设计

DROP TRIGGER IF EXISTS trigger_sync_topic_snapshot ON topics;
DROP FUNCTION IF EXISTS sync_topic_snapshot();

DROP INDEX IF EXISTS idx_topics_keyword;
DROP INDEX IF EXISTS idx_topics_user_id;
DROP INDEX IF EXISTS idx_generation_tasks_distillation_keyword;
DROP INDEX IF EXISTS idx_topic_usage_keyword;

ALTER TABLE topics ALTER COLUMN keyword DROP NOT NULL;
ALTER TABLE topics ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE topics DROP CONSTRAINT IF EXISTS topics_distillation_id_fkey;
ALTER TABLE topics ADD CONSTRAINT topics_distillation_id_fkey 
  FOREIGN KEY (distillation_id) REFERENCES distillations(id) ON DELETE CASCADE;

ALTER TABLE generation_tasks DROP CONSTRAINT IF EXISTS generation_tasks_distillation_id_fkey;
ALTER TABLE generation_tasks ALTER COLUMN distillation_id SET NOT NULL;
ALTER TABLE generation_tasks ADD CONSTRAINT generation_tasks_distillation_id_fkey 
  FOREIGN KEY (distillation_id) REFERENCES distillations(id) ON DELETE CASCADE;

ALTER TABLE topic_usage DROP COLUMN IF EXISTS keyword;

ALTER TABLE topics DROP COLUMN IF EXISTS keyword;
ALTER TABLE topics DROP COLUMN IF EXISTS user_id;
ALTER TABLE generation_tasks DROP COLUMN IF EXISTS distillation_keyword;
