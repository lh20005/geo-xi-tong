#!/bin/bash

# 测试话题轮换算法验证脚本
# 验证下一个选择的话题是否为 topic_id=25 (usage_count=0)

echo "=========================================="
echo "话题轮换算法验证测试"
echo "=========================================="
echo ""

# 显示当前话题使用情况
echo "1. 当前话题使用情况（英国留学机构关键词）："
echo "------------------------------------------"
psql postgresql://lzc@localhost:5432/geo_system -c "
SELECT 
  t.id, 
  t.question, 
  t.usage_count,
  CASE 
    WHEN t.usage_count = (SELECT MIN(usage_count) FROM topics WHERE distillation_id = 2) 
    THEN '← 最少使用'
    ELSE ''
  END as status
FROM topics t 
WHERE t.distillation_id = 2 
ORDER BY t.usage_count ASC, t.id ASC;
"
echo ""

# 显示算法应该选择的话题
echo "2. 算法预测："
echo "------------------------------------------"
psql postgresql://lzc@localhost:5432/geo_system -t -c "
SELECT 
  '下一个应该选择: topic_id=' || id || ', question=' || question || ', usage_count=' || usage_count
FROM topics 
WHERE distillation_id = 2 
  AND usage_count = (SELECT MIN(usage_count) FROM topics WHERE distillation_id = 2)
ORDER BY id ASC 
LIMIT 1;
"
echo ""

# 显示最近生成的文章
echo "3. 最近生成的文章（验证轮换）："
echo "------------------------------------------"
psql postgresql://lzc@localhost:5432/geo_system -c "
SELECT 
  a.id as article_id,
  a.topic_id,
  t.question,
  t.usage_count,
  to_char(a.created_at, 'HH24:MI:SS') as time
FROM articles a 
LEFT JOIN topics t ON a.topic_id = t.id
WHERE a.distillation_id = 2 
ORDER BY a.created_at DESC 
LIMIT 5;
"
echo ""

echo "=========================================="
echo "测试说明："
echo "- 算法应该选择 usage_count 最小的话题"
echo "- 如果有多个话题的 usage_count 相同，选择 id 最小的"
echo "- 这样确保话题按 ID 顺序轮换使用"
echo "=========================================="
