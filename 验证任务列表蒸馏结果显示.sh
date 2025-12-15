#!/bin/bash

# 验证文章生成页面（任务列表）的蒸馏结果列显示正确的话题

echo "=========================================="
echo "任务列表 - 蒸馏结果列显示验证"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}1. 数据库验证 - 任务与文章话题的关联${NC}"
echo "------------------------------------------"
echo "查询任务及其生成的文章使用的话题："
psql postgresql://lzc@localhost:5432/geo_system -c "
SELECT 
  gt.id as task_id,
  gt.requested_count,
  gt.generated_count,
  gt.status,
  STRING_AGG(DISTINCT t.question, ', ' ORDER BY t.question) as topics_used
FROM generation_tasks gt
LEFT JOIN articles a ON a.task_id = gt.id
LEFT JOIN topics t ON a.topic_id = t.id
WHERE gt.generated_count > 0
GROUP BY gt.id, gt.requested_count, gt.generated_count, gt.status
ORDER BY gt.id DESC
LIMIT 8;
" 2>/dev/null
echo ""

echo -e "${BLUE}2. API验证 - 单篇文章任务${NC}"
echo "------------------------------------------"
echo "测试生成1篇文章的任务（应显示1个话题）:"
curl -s "http://localhost:3000/api/article-generation/tasks?page=1&pageSize=3" | python3 -c '
import sys, json
try:
    data = json.load(sys.stdin)
    tasks = data.get("tasks", [])
    
    for task in tasks:
        if task.get("requestedCount") == 1 and task.get("generatedCount") == 1:
            print(f"任务ID: {task.get(\"id\")}")
            print(f"  关键词: {task.get(\"keyword\")}")
            print(f"  请求数量: {task.get(\"requestedCount\")}")
            print(f"  生成数量: {task.get(\"generatedCount\")}")
            print(f"  蒸馏结果: {task.get(\"distillationResult\", \"无\")}")
            print()
            break
except Exception as e:
    print(f"解析失败: {e}")
'
echo ""

echo -e "${BLUE}3. API验证 - 多篇文章任务${NC}"
echo "------------------------------------------"
echo "测试生成3篇文章的任务（应显示3个话题）:"
curl -s "http://localhost:3000/api/article-generation/tasks/27" | python3 -c '
import sys, json
try:
    task = json.load(sys.stdin)
    print(f"任务ID: {task.get(\"id\")}")
    print(f"  关键词: {task.get(\"keyword\")}")
    print(f"  请求数量: {task.get(\"requestedCount\")}")
    print(f"  生成数量: {task.get(\"generatedCount\")}")
    print(f"  蒸馏结果: {task.get(\"distillationResult\", \"无\")}")
    print()
    
    # 分析话题数量
    result = task.get("distillationResult", "")
    if result:
        topics = [t.strip() for t in result.split(",")]
        print(f"  话题数量: {len(topics)}")
        for i, topic in enumerate(topics, 1):
            print(f"    {i}. {topic}")
except Exception as e:
    print(f"解析失败: {e}")
'
echo ""

echo -e "${BLUE}4. 数据一致性验证${NC}"
echo "------------------------------------------"
echo "验证任务的蒸馏结果与实际文章使用的话题一致："
psql postgresql://lzc@localhost:5432/geo_system -t -c "
WITH task_topics AS (
  SELECT 
    gt.id as task_id,
    COUNT(DISTINCT a.topic_id) as unique_topics,
    gt.generated_count
  FROM generation_tasks gt
  LEFT JOIN articles a ON a.task_id = gt.id
  WHERE gt.generated_count > 0
  GROUP BY gt.id, gt.generated_count
)
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✓ 所有任务的话题数量与生成文章数量匹配'
    ELSE '注意: ' || COUNT(*) || ' 个任务的话题数量与文章数量不匹配（可能有文章使用了相同话题）'
  END as result
FROM task_topics
WHERE unique_topics != generated_count;
" 2>/dev/null | xargs
echo ""

echo -e "${BLUE}5. 未生成文章的任务${NC}"
echo "------------------------------------------"
echo "验证未生成文章的任务（蒸馏结果应为空）："
psql postgresql://lzc@localhost:5432/geo_system -c "
SELECT 
  gt.id as task_id,
  gt.status,
  gt.requested_count,
  gt.generated_count,
  (
    SELECT STRING_AGG(DISTINCT t.question, ', ' ORDER BY t.question)
    FROM articles a
    INNER JOIN topics t ON a.topic_id = t.id
    WHERE a.task_id = gt.id
  ) as distillation_result
FROM generation_tasks gt
WHERE gt.generated_count = 0
ORDER BY gt.id DESC
LIMIT 3;
" 2>/dev/null
echo ""

echo -e "${BLUE}6. 话题显示示例${NC}"
echo "------------------------------------------"
echo "展示不同任务的蒸馏结果显示："
psql postgresql://lzc@localhost:5432/geo_system -c "
SELECT 
  gt.id,
  gt.requested_count as req,
  gt.generated_count as gen,
  LEFT(
    (
      SELECT STRING_AGG(DISTINCT t.question, ', ' ORDER BY t.question)
      FROM articles a
      INNER JOIN topics t ON a.topic_id = t.id
      WHERE a.task_id = gt.id
    ), 60
  ) as distillation_result
FROM generation_tasks gt
WHERE gt.generated_count > 0
ORDER BY gt.generated_count DESC, gt.id DESC
LIMIT 6;
" 2>/dev/null
echo ""

echo "=========================================="
echo -e "${GREEN}验证总结${NC}"
echo "=========================================="
echo ""
echo "修复内容："
echo "  1. 后端SQL查询改为使用 STRING_AGG 聚合实际使用的话题"
echo "  2. 显示任务实际生成的文章使用的所有话题"
echo ""
echo "预期效果："
echo "  - 生成1篇文章的任务：显示1个话题"
echo "  - 生成3篇文章的任务：显示3个话题（逗号分隔）"
echo "  - 未生成文章的任务：显示空（或\"待生成\"）"
echo "  - 话题内容准确反映文章实际使用的话题"
echo ""
echo "前端验证："
echo "  1. 打开浏览器: http://localhost:5173"
echo "  2. 进入「文章生成」模块"
echo "  3. 查看任务列表的「蒸馏结果」列"
echo "  4. 应该显示每个任务实际使用的话题"
echo ""
echo "=========================================="
