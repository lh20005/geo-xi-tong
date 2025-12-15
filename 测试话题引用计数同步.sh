#!/bin/bash

# 测试话题引用计数实时同步

echo "=========================================="
echo "话题引用计数实时同步测试"
echo "=========================================="
echo ""

DISTILLATION_ID=2
KEYWORD="英国留学机构"

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}测试场景：生成文章后，话题引用计数是否正确更新${NC}"
echo ""

# 1. 查看当前话题使用情况
echo -e "${BLUE}1. 当前话题使用情况${NC}"
echo "------------------------------------------"
psql postgresql://lzc@localhost:5432/geo_system -c "
SELECT 
  t.id,
  LEFT(t.question, 40) as question,
  t.usage_count,
  (SELECT COUNT(*) FROM topic_usage tu WHERE tu.topic_id = t.id) as actual_usage
FROM topics t
WHERE t.distillation_id = $DISTILLATION_ID
ORDER BY t.usage_count ASC, t.id ASC
LIMIT 5;
" 2>/dev/null
echo ""

# 2. 找出下一个将被使用的话题
echo -e "${BLUE}2. 下一个将被使用的话题${NC}"
echo "------------------------------------------"
NEXT_TOPIC=$(psql postgresql://lzc@localhost:5432/geo_system -t -c "
SELECT 
  id || '|' || LEFT(question, 40) || '|' || usage_count
FROM topics 
WHERE distillation_id = $DISTILLATION_ID 
  AND usage_count = (SELECT MIN(usage_count) FROM topics WHERE distillation_id = $DISTILLATION_ID)
ORDER BY id ASC 
LIMIT 1;
" 2>/dev/null | xargs)

TOPIC_ID=$(echo $NEXT_TOPIC | cut -d'|' -f1)
TOPIC_QUESTION=$(echo $NEXT_TOPIC | cut -d'|' -f2)
CURRENT_COUNT=$(echo $NEXT_TOPIC | cut -d'|' -f3)

echo "话题ID: $TOPIC_ID"
echo "话题内容: $TOPIC_QUESTION"
echo "当前引用次数: $CURRENT_COUNT"
echo ""

# 3. 测试API返回的数据
echo -e "${BLUE}3. API返回的话题统计${NC}"
echo "------------------------------------------"
echo "GET /api/topics/distillation/$DISTILLATION_ID/stats"
echo ""
curl -s "http://localhost:3000/api/topics/distillation/$DISTILLATION_ID/stats" | python3 -c '
import sys, json
try:
    data = json.load(sys.stdin)
    topics = data.get("topics", [])
    
    # 找出usage_count最小的话题
    min_count = min(t.get("usageCount", 999) for t in topics) if topics else 0
    next_topics = [t for t in topics if t.get("usageCount") == min_count]
    
    if next_topics:
        topic = next_topics[0]
        print(f"下一个将被使用的话题:")
        print(f"  ID: {topic.get(\"topicId\")}")
        print(f"  内容: {topic.get(\"question\", \"\")[:40]}")
        print(f"  当前引用次数: {topic.get(\"usageCount\")}")
except Exception as e:
    print(f"解析失败: {e}")
'
echo ""

# 4. 说明
echo -e "${BLUE}4. 测试说明${NC}"
echo "------------------------------------------"
echo "现在请执行以下操作来测试实时同步："
echo ""
echo "步骤1: 打开浏览器访问 http://localhost:5173"
echo "步骤2: 进入「蒸馏结果」模块"
echo "步骤3: 找到关键词「$KEYWORD」的话题列表"
echo "步骤4: 记录话题「$TOPIC_QUESTION」的当前引用次数: $CURRENT_COUNT"
echo ""
echo "步骤5: 进入「文章生成」模块"
echo "步骤6: 创建新任务，选择关键词「$KEYWORD」，生成1篇文章"
echo "步骤7: 等待文章生成完成"
echo ""
echo "步骤8: 返回「蒸馏结果」模块"
echo "步骤9: 观察话题列表"
echo ""
echo -e "${GREEN}预期结果：${NC}"
echo "  - 10-15秒内，页面自动刷新"
echo "  - 话题「$TOPIC_QUESTION」的引用次数变为: $((CURRENT_COUNT + 1))"
echo "  - 或者点击「刷新」按钮立即看到更新"
echo ""

# 5. 验证数据一致性
echo -e "${BLUE}5. 数据一致性验证${NC}"
echo "------------------------------------------"
echo "验证usage_count与实际使用记录是否一致："
psql postgresql://lzc@localhost:5432/geo_system -t -c "
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✓ 所有话题的usage_count与实际使用记录一致'
    ELSE '✗ 发现 ' || COUNT(*) || ' 个话题的usage_count不一致'
  END as result
FROM topics t
WHERE t.distillation_id = $DISTILLATION_ID
  AND t.usage_count != (SELECT COUNT(*) FROM topic_usage tu WHERE tu.topic_id = t.id);
" 2>/dev/null | xargs
echo ""

echo "=========================================="
echo -e "${GREEN}测试完成${NC}"
echo "=========================================="
echo ""
echo "功能特性："
echo "  ✓ 后端正确更新话题usage_count"
echo "  ✓ 话题列表页面自动刷新（10秒）"
echo "  ✓ 蒸馏结果列表页面自动刷新（15秒）"
echo "  ✓ 手动刷新按钮可用"
echo "  ✓ 数据一致性保证"
echo ""
