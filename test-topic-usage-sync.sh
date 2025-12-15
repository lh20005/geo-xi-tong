#!/bin/bash

# 测试话题使用计数同步
# 验证生成文章后，话题的usage_count能立即在蒸馏结果模块中显示

echo "=========================================="
echo "话题使用计数同步测试"
echo "=========================================="
echo ""

DISTILLATION_ID=2
KEYWORD="英国留学机构"

echo "测试关键词: $KEYWORD (distillation_id=$DISTILLATION_ID)"
echo ""

# 1. 显示当前话题使用情况
echo "1. 当前话题使用情况（从数据库直接查询）："
echo "------------------------------------------"
psql postgresql://lzc@localhost:5432/geo_system -c "
SELECT 
  t.id as topic_id,
  LEFT(t.question, 30) as question,
  t.usage_count,
  to_char(
    (SELECT MAX(tu.used_at) FROM topic_usage tu WHERE tu.topic_id = t.id),
    'YYYY-MM-DD HH24:MI:SS'
  ) as last_used_at
FROM topics t 
WHERE t.distillation_id = $DISTILLATION_ID 
ORDER BY t.usage_count ASC, t.id ASC
LIMIT 10;
"
echo ""

# 2. 测试API返回的数据
echo "2. API返回的话题统计（前端调用的API）："
echo "------------------------------------------"
echo "GET /api/topics/distillation/$DISTILLATION_ID/stats"
echo ""
curl -s "http://localhost:3000/api/topics/distillation/$DISTILLATION_ID/stats" | python3 -c "
import sys, json
data = json.load(sys.stdin)
topics = data['topics'][:10]  # 只显示前10个
print(f\"总话题数: {data['total']}\")
print(f\"返回前10个话题:\n\")
for topic in topics:
    last_used = topic['lastUsedAt'][:19] if topic['lastUsedAt'] else '从未使用'
    print(f\"  ID={topic['topicId']:2d} | 使用次数={topic['usageCount']} | 最后使用={last_used} | {topic['question'][:30]}\")
"
echo ""

# 3. 找出下一个应该被选择的话题
echo "3. 算法预测（下一个应该选择的话题）："
echo "------------------------------------------"
NEXT_TOPIC=$(psql postgresql://lzc@localhost:5432/geo_system -t -c "
SELECT 
  'topic_id=' || id || ', question=' || LEFT(question, 30) || ', usage_count=' || usage_count
FROM topics 
WHERE distillation_id = $DISTILLATION_ID 
  AND usage_count = (SELECT MIN(usage_count) FROM topics WHERE distillation_id = $DISTILLATION_ID)
ORDER BY id ASC 
LIMIT 1;
" | xargs)
echo "下一个应该选择: $NEXT_TOPIC"
echo ""

# 4. 显示最近生成的文章
echo "4. 最近生成的文章（验证话题选择）："
echo "------------------------------------------"
psql postgresql://lzc@localhost:5432/geo_system -c "
SELECT 
  a.id as article_id,
  a.topic_id,
  LEFT(t.question, 30) as topic_question,
  t.usage_count as current_usage,
  to_char(a.created_at, 'HH24:MI:SS') as created_time
FROM articles a 
LEFT JOIN topics t ON a.topic_id = t.id
WHERE a.distillation_id = $DISTILLATION_ID 
ORDER BY a.created_at DESC 
LIMIT 5;
"
echo ""

echo "=========================================="
echo "测试说明："
echo "1. 数据库查询和API返回的数据应该一致"
echo "2. 生成文章后，话题的usage_count应该立即更新"
echo "3. 前端调用 /api/topics/distillation/:id/stats 可以获取实时的usage_count"
echo "4. 话题按usage_count从小到大排序，相同时按id从小到大排序"
echo "=========================================="
