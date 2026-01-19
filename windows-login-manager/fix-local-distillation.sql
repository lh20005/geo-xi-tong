-- Windows 端本地数据库蒸馏问题修复脚本
-- 执行方式: psql -U lzc -d geo_windows -f fix-local-distillation.sql

-- ==================== 1. 修复现有数据 ====================

-- 更新所有蒸馏记录的 topic_count
UPDATE distillations d
SET topic_count = (
  SELECT COUNT(*)
  FROM topics t
  WHERE t.distillation_id = d.id
),
updated_at = NOW();

-- 显示修复结果
SELECT 
  id,
  keyword,
  topic_count,
  (SELECT COUNT(*) FROM topics t WHERE t.distillation_id = d.id) as actual_topics
FROM distillations d
ORDER BY created_at DESC
LIMIT 10;

-- ==================== 2. 创建自动更新触发器 ====================

-- 创建触发器函数
CREATE OR REPLACE FUNCTION update_distillation_topic_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- 插入话题时，topic_count + 1
    UPDATE distillations 
    SET topic_count = topic_count + 1,
        updated_at = NOW()
    WHERE id = NEW.distillation_id;
  ELSIF TG_OP = 'DELETE' THEN
    -- 删除话题时，topic_count - 1（不小于 0）
    UPDATE distillations 
    SET topic_count = GREATEST(topic_count - 1, 0),
        updated_at = NOW()
    WHERE id = OLD.distillation_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 删除旧触发器（如果存在）
DROP TRIGGER IF EXISTS trigger_update_topic_count ON topics;

-- 创建新触发器
CREATE TRIGGER trigger_update_topic_count
AFTER INSERT OR DELETE ON topics
FOR EACH ROW
EXECUTE FUNCTION update_distillation_topic_count();

-- ==================== 3. 验证修复 ====================

-- 显示统计信息
SELECT 
  '总蒸馏记录' as metric,
  COUNT(*) as value
FROM distillations
UNION ALL
SELECT 
  '有话题的蒸馏',
  COUNT(*)
FROM distillations
WHERE topic_count > 0
UNION ALL
SELECT 
  '总话题数',
  COUNT(*)
FROM topics
UNION ALL
SELECT 
  '不一致的记录',
  COUNT(*)
FROM distillations d
WHERE d.topic_count != (SELECT COUNT(*) FROM topics t WHERE t.distillation_id = d.id);

-- 显示触发器信息
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as enabled
FROM pg_trigger
WHERE tgname = 'trigger_update_topic_count';

-- ==================== 完成 ====================
\echo '✅ 修复完成！'
\echo ''
\echo '请执行以下命令验证:'
\echo '  node diagnose-local-distillation.js'
