#!/bin/bash

# 验证文章列表中的蒸馏结果列显示正确的话题

echo "=========================================="
echo "文章列表 - 蒸馏结果列显示验证"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}1. 数据库验证 - 文章与话题的关联${NC}"
echo "------------------------------------------"
echo "查询最近5篇文章及其关联的话题："
psql postgresql://lzc@localhost:5432/geo_system -c "
SELECT 
  a.id as article_id,
  LEFT(a.title, 40) as article_title,
  a.keyword,
  a.topic_id,
  LEFT(t.question, 35) as topic_question
FROM articles a
LEFT JOIN topics t ON a.topic_id = t.id
ORDER BY a.created_at DESC
LIMIT 5;
" 2>/dev/null
echo ""

echo -e "${BLUE}2. API验证 - 检查返回的数据结构${NC}"
echo "------------------------------------------"
echo "调用 GET /api/articles?page=1&pageSize=3"
echo ""
curl -s "http://localhost:3000/api/articles?page=1&pageSize=3" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    articles = data.get('articles', [])
    
    print(f'返回文章数: {len(articles)}')
    print()
    
    for i, article in enumerate(articles, 1):
        print(f'文章 {i}:')
        print(f'  ID: {article.get(\"id\")}')
        print(f'  标题: {article.get(\"title\", \"\")[:40]}...')
        print(f'  关键词: {article.get(\"keyword\")}')
        print(f'  话题ID: {article.get(\"topicId\")}')
        print(f'  话题内容: {article.get(\"topicQuestion\", \"无\")}')
        print()
except Exception as e:
    print(f'解析失败: {e}')
"
echo ""

echo -e "${BLUE}3. 数据一致性验证${NC}"
echo "------------------------------------------"
echo "检查每篇文章的话题是否正确关联："
psql postgresql://lzc@localhost:5432/geo_system -t -c "
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✓ 所有文章的话题关联正确'
    ELSE '✗ 发现 ' || COUNT(*) || ' 篇文章的话题关联错误'
  END as result
FROM articles a
WHERE a.topic_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM topics t WHERE t.id = a.topic_id);
" 2>/dev/null | xargs
echo ""

echo -e "${BLUE}4. 话题多样性验证${NC}"
echo "------------------------------------------"
echo "验证同一关键词的文章使用了不同的话题："
psql postgresql://lzc@localhost:5432/geo_system -c "
SELECT 
  a.keyword,
  COUNT(DISTINCT a.topic_id) as unique_topics,
  COUNT(*) as total_articles,
  ROUND(COUNT(DISTINCT a.topic_id)::numeric / COUNT(*)::numeric * 100, 1) as diversity_rate
FROM articles a
WHERE a.topic_id IS NOT NULL
GROUP BY a.keyword
ORDER BY total_articles DESC
LIMIT 5;
" 2>/dev/null
echo ""

echo -e "${BLUE}5. 示例数据展示${NC}"
echo "------------------------------------------"
echo "关键词「英国留学机构」的文章使用的话题分布："
psql postgresql://lzc@localhost:5432/geo_system -c "
SELECT 
  t.id as topic_id,
  LEFT(t.question, 40) as topic_question,
  COUNT(a.id) as article_count
FROM topics t
LEFT JOIN articles a ON t.id = a.topic_id
WHERE t.distillation_id = 2
GROUP BY t.id, t.question
HAVING COUNT(a.id) > 0
ORDER BY article_count DESC, t.id ASC;
" 2>/dev/null
echo ""

echo "=========================================="
echo -e "${GREEN}验证总结${NC}"
echo "=========================================="
echo ""
echo "修复内容："
echo "  1. 后端API添加 topicQuestion 字段"
echo "  2. 前端蒸馏结果列改为显示 topicQuestion"
echo ""
echo "预期效果："
echo "  - 每篇文章显示它实际使用的话题"
echo "  - 同一关键词的文章使用不同的话题"
echo "  - 话题内容准确反映文章生成时的选择"
echo ""
echo "前端验证："
echo "  1. 打开浏览器: http://localhost:5173"
echo "  2. 进入「文章管理」模块"
echo "  3. 查看「蒸馏结果」列"
echo "  4. 应该显示具体的话题内容，而不是关键词"
echo ""
echo "=========================================="
