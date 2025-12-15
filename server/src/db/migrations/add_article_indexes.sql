-- 为文章表添加索引以优化筛选和统计查询性能

-- 为发布状态添加索引
CREATE INDEX IF NOT EXISTS idx_articles_is_published ON articles(is_published);

-- 为蒸馏ID添加索引
CREATE INDEX IF NOT EXISTS idx_articles_distillation_id ON articles(distillation_id);

-- 为关键词添加索引
CREATE INDEX IF NOT EXISTS idx_articles_keyword ON articles(keyword);

-- 为创建时间添加降序索引（用于排序）
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC);

-- 验证索引创建
SELECT 
  indexname, 
  indexdef 
FROM pg_indexes 
WHERE tablename = 'articles' 
  AND indexname IN (
    'idx_articles_is_published',
    'idx_articles_distillation_id',
    'idx_articles_keyword',
    'idx_articles_created_at'
  );
