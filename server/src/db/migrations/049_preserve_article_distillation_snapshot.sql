-- ==================== UP ====================
-- 迁移：为 articles 表添加蒸馏结果快照字段
-- 问题：删除蒸馏结果后，文章管理页面、发布任务页面的蒸馏结果列数据消失
-- 原因：topics 表的外键约束是 ON DELETE CASCADE，删除蒸馏结果时 topics 记录被级联删除
-- 解决方案：在 articles 表中添加快照字段，保存蒸馏结果信息

-- 1. 添加快照字段到 articles 表
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS distillation_keyword_snapshot VARCHAR(255),
ADD COLUMN IF NOT EXISTS topic_question_snapshot TEXT;

-- 2. 从现有关联数据填充快照字段
UPDATE articles a
SET 
  distillation_keyword_snapshot = COALESCE(t.keyword, d.keyword),
  topic_question_snapshot = t.question
FROM topics t
LEFT JOIN distillations d ON t.distillation_id = d.id
WHERE a.topic_id = t.id
  AND a.distillation_keyword_snapshot IS NULL;

-- 3. 对于没有 topic_id 但有 distillation_id 的文章，直接从 distillations 表获取
UPDATE articles a
SET distillation_keyword_snapshot = d.keyword
FROM distillations d
WHERE a.distillation_id = d.id
  AND a.topic_id IS NULL
  AND a.distillation_keyword_snapshot IS NULL;

-- 4. 创建触发器函数：在创建/更新文章时自动填充快照
CREATE OR REPLACE FUNCTION sync_article_distillation_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  -- 当设置了 topic_id 时，从 topics 表获取快照
  IF NEW.topic_id IS NOT NULL THEN
    SELECT 
      COALESCE(t.keyword, d.keyword),
      t.question
    INTO 
      NEW.distillation_keyword_snapshot,
      NEW.topic_question_snapshot
    FROM topics t
    LEFT JOIN distillations d ON t.distillation_id = d.id
    WHERE t.id = NEW.topic_id;
  -- 当只有 distillation_id 时，从 distillations 表获取
  ELSIF NEW.distillation_id IS NOT NULL AND NEW.distillation_keyword_snapshot IS NULL THEN
    SELECT keyword INTO NEW.distillation_keyword_snapshot
    FROM distillations
    WHERE id = NEW.distillation_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 创建触发器
DROP TRIGGER IF EXISTS trigger_sync_article_distillation_snapshot ON articles;
CREATE TRIGGER trigger_sync_article_distillation_snapshot
BEFORE INSERT OR UPDATE OF topic_id, distillation_id ON articles
FOR EACH ROW
EXECUTE FUNCTION sync_article_distillation_snapshot();

-- 6. 创建索引
CREATE INDEX IF NOT EXISTS idx_articles_distillation_keyword_snapshot ON articles(distillation_keyword_snapshot);

-- 7. 添加字段注释
COMMENT ON COLUMN articles.distillation_keyword_snapshot IS '蒸馏关键词快照（删除源数据后仍保留）';
COMMENT ON COLUMN articles.topic_question_snapshot IS '话题问题快照（删除源数据后仍保留）';

-- ==================== DOWN ====================
-- 回滚：删除快照字段和触发器

-- 1. 删除触发器
DROP TRIGGER IF EXISTS trigger_sync_article_distillation_snapshot ON articles;

-- 2. 删除触发器函数
DROP FUNCTION IF EXISTS sync_article_distillation_snapshot();

-- 3. 删除索引
DROP INDEX IF EXISTS idx_articles_distillation_keyword_snapshot;

-- 4. 删除快照字段
ALTER TABLE articles 
DROP COLUMN IF EXISTS distillation_keyword_snapshot,
DROP COLUMN IF EXISTS topic_question_snapshot;
