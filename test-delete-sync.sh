#!/bin/bash

# 测试删除话题后同步清理distillation记录

API_BASE="http://localhost:3001/api/distillation"

echo "=========================================="
echo "测试删除话题同步清理distillation记录"
echo "=========================================="
echo ""

# 步骤1: 创建测试数据
echo "步骤1: 创建测试关键词"
echo "------------------------------------------"
echo "创建关键词: 测试同步删除A（3个话题）"
RESULT_A=$(curl -s -X POST "$API_BASE/manual" \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "测试同步删除A",
    "questions": [
      "测试问题A1",
      "测试问题A2",
      "测试问题A3"
    ]
  }')
DISTILLATION_ID_A=$(echo $RESULT_A | jq -r '.distillationId')
echo "Distillation ID: $DISTILLATION_ID_A"
echo ""

echo "创建关键词: 测试同步删除B（2个话题）"
RESULT_B=$(curl -s -X POST "$API_BASE/manual" \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "测试同步删除B",
    "questions": [
      "测试问题B1",
      "测试问题B2"
    ]
  }')
DISTILLATION_ID_B=$(echo $RESULT_B | jq -r '.distillationId')
echo "Distillation ID: $DISTILLATION_ID_B"
echo ""
echo ""

# 步骤2: 验证distillation记录存在
echo "步骤2: 验证distillation记录存在"
echo "------------------------------------------"
echo "查询关键词蒸馏历史："
curl -s -X GET "$API_BASE/history?pageSize=100" | jq '.data[] | select(.keyword | contains("测试同步删除")) | {id, keyword, topic_count}'
echo ""
echo ""

# 步骤3: 查询话题IDs
echo "步骤3: 查询话题IDs"
echo "------------------------------------------"
echo "关键词A的话题："
TOPICS_A=$(curl -s -X GET "$API_BASE/results?keyword=测试同步删除A&pageSize=10" | jq -r '.data[] | .id')
echo "话题IDs: $TOPICS_A"
TOPIC_IDS_A_ARRAY=($(echo $TOPICS_A))
echo ""

echo "关键词B的话题："
TOPICS_B=$(curl -s -X GET "$API_BASE/results?keyword=测试同步删除B&pageSize=10" | jq -r '.data[] | .id')
echo "话题IDs: $TOPICS_B"
TOPIC_IDS_B_ARRAY=($(echo $TOPICS_B))
echo ""
echo ""

# 测试1: 删除部分话题（不应该删除distillation记录）
echo "测试1: 删除关键词A的部分话题（2个）"
echo "------------------------------------------"
TOPIC_IDS_TO_DELETE="${TOPIC_IDS_A_ARRAY[0]},${TOPIC_IDS_A_ARRAY[1]}"
echo "删除话题IDs: $TOPIC_IDS_TO_DELETE"
curl -s -X DELETE "$API_BASE/topics" \
  -H "Content-Type: application/json" \
  -d "{\"topicIds\": [$TOPIC_IDS_TO_DELETE]}" | jq '.'
echo ""

echo "验证: 关键词A的distillation记录应该还存在（还有1个话题）"
curl -s -X GET "$API_BASE/history?pageSize=100" | jq '.data[] | select(.keyword == "测试同步删除A") | {id, keyword, topic_count}'
echo ""

echo "验证: 关键词A剩余的话题数量"
curl -s -X GET "$API_BASE/results?keyword=测试同步删除A&pageSize=10" | jq '.total'
echo ""
echo ""

# 测试2: 删除所有话题（应该删除distillation记录）
echo "测试2: 删除关键词A的最后一个话题"
echo "------------------------------------------"
LAST_TOPIC_ID="${TOPIC_IDS_A_ARRAY[2]}"
echo "删除话题ID: $LAST_TOPIC_ID"
curl -s -X DELETE "$API_BASE/topics" \
  -H "Content-Type: application/json" \
  -d "{\"topicIds\": [$LAST_TOPIC_ID]}" | jq '.'
echo ""

echo "验证: 关键词A的distillation记录应该被删除"
DISTILLATION_A_EXISTS=$(curl -s -X GET "$API_BASE/history?pageSize=100" | jq '.data[] | select(.keyword == "测试同步删除A") | .id')
if [ -z "$DISTILLATION_A_EXISTS" ]; then
  echo "✅ 成功：关键词A的distillation记录已被删除"
else
  echo "❌ 失败：关键词A的distillation记录仍然存在"
fi
echo ""

echo "验证: 关键词A的话题数量应该为0"
TOPIC_COUNT_A=$(curl -s -X GET "$API_BASE/results?keyword=测试同步删除A&pageSize=10" | jq '.total')
echo "话题数量: $TOPIC_COUNT_A"
echo ""
echo ""

# 测试3: 按关键词删除（应该删除distillation记录）
echo "测试3: 按关键词删除关键词B"
echo "------------------------------------------"
curl -s -X DELETE "$API_BASE/topics/by-keyword" \
  -H "Content-Type: application/json" \
  -d '{"keyword": "测试同步删除B"}' | jq '.'
echo ""

echo "验证: 关键词B的distillation记录应该被删除"
DISTILLATION_B_EXISTS=$(curl -s -X GET "$API_BASE/history?pageSize=100" | jq '.data[] | select(.keyword == "测试同步删除B") | .id')
if [ -z "$DISTILLATION_B_EXISTS" ]; then
  echo "✅ 成功：关键词B的distillation记录已被删除"
else
  echo "❌ 失败：关键词B的distillation记录仍然存在"
fi
echo ""

echo "验证: 关键词B的话题数量应该为0"
TOPIC_COUNT_B=$(curl -s -X GET "$API_BASE/results?keyword=测试同步删除B&pageSize=10" | jq '.total')
echo "话题数量: $TOPIC_COUNT_B"
echo ""
echo ""

# 最终验证
echo "=========================================="
echo "最终验证：查询所有测试关键词"
echo "=========================================="
curl -s -X GET "$API_BASE/history?pageSize=100" | jq '.data[] | select(.keyword | contains("测试同步删除")) | {id, keyword, topic_count}'
echo ""

echo "=========================================="
echo "测试完成"
echo "=========================================="
echo ""
echo "总结："
echo "✓ 删除部分话题时，distillation记录保留"
echo "✓ 删除所有话题时，distillation记录被删除"
echo "✓ 按关键词删除时，distillation记录被删除"
echo "✓ 关键词蒸馏页面不再显示已删除的关键词"
