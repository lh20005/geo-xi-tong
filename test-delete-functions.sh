#!/bin/bash

# 测试蒸馏结果删除功能

API_BASE="http://localhost:3001/api/distillation"

echo "=========================================="
echo "测试蒸馏结果删除功能"
echo "=========================================="
echo ""

# 准备测试数据
echo "步骤1: 准备测试数据"
echo "------------------------------------------"
echo "创建测试关键词1: 测试删除功能A"
curl -X POST "$API_BASE/manual" \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "测试删除功能A",
    "questions": [
      "测试问题A1",
      "测试问题A2",
      "测试问题A3"
    ]
  }' | jq '.distillationId, .count'
echo ""

echo "创建测试关键词2: 测试删除功能B"
curl -X POST "$API_BASE/manual" \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "测试删除功能B",
    "questions": [
      "测试问题B1",
      "测试问题B2"
    ]
  }' | jq '.distillationId, .count'
echo ""
echo ""

# 查询测试数据
echo "步骤2: 查询测试数据"
echo "------------------------------------------"
echo "查询关键词A的蒸馏结果："
KEYWORD_A_TOPICS=$(curl -s -X GET "$API_BASE/results?keyword=测试删除功能A&pageSize=10" | jq -r '.data[] | .id')
echo "话题IDs: $KEYWORD_A_TOPICS"
echo ""

echo "查询关键词B的蒸馏结果："
KEYWORD_B_TOPICS=$(curl -s -X GET "$API_BASE/results?keyword=测试删除功能B&pageSize=10" | jq -r '.data[] | .id')
echo "话题IDs: $KEYWORD_B_TOPICS"
echo ""
echo ""

# 测试1: 批量删除话题
echo "测试1: 批量删除话题（删除关键词A的前2个）"
echo "------------------------------------------"
TOPIC_IDS=$(echo "$KEYWORD_A_TOPICS" | head -2 | tr '\n' ',' | sed 's/,$//')
echo "删除话题IDs: $TOPIC_IDS"
curl -X DELETE "$API_BASE/topics" \
  -H "Content-Type: application/json" \
  -d "{\"topicIds\": [$(echo $TOPIC_IDS)]}" | jq '.'
echo ""
echo ""

# 验证删除结果
echo "验证: 查询关键词A剩余的蒸馏结果"
curl -s -X GET "$API_BASE/results?keyword=测试删除功能A&pageSize=10" | jq '.total, .data[].question'
echo ""
echo ""

# 测试2: 按关键词删除
echo "测试2: 按关键词删除（删除关键词A的所有剩余结果）"
echo "------------------------------------------"
curl -X DELETE "$API_BASE/topics/by-keyword" \
  -H "Content-Type: application/json" \
  -d '{"keyword": "测试删除功能A"}' | jq '.'
echo ""
echo ""

# 验证删除结果
echo "验证: 查询关键词A的蒸馏结果（应该为空）"
curl -s -X GET "$API_BASE/results?keyword=测试删除功能A&pageSize=10" | jq '.total'
echo ""
echo ""

# 测试3: 按筛选条件删除
echo "测试3: 按筛选条件删除（删除关键词B且provider=manual的结果）"
echo "------------------------------------------"
curl -X DELETE "$API_BASE/topics/by-filter" \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "测试删除功能B",
    "provider": "manual"
  }' | jq '.'
echo ""
echo ""

# 验证删除结果
echo "验证: 查询关键词B的蒸馏结果（应该为空）"
curl -s -X GET "$API_BASE/results?keyword=测试删除功能B&pageSize=10" | jq '.total'
echo ""
echo ""

# 测试4: 错误处理 - 空关键词
echo "测试4: 错误处理 - 空关键词（预期失败）"
echo "------------------------------------------"
curl -X DELETE "$API_BASE/topics/by-keyword" \
  -H "Content-Type: application/json" \
  -d '{"keyword": ""}' | jq '.'
echo ""
echo ""

# 测试5: 错误处理 - 无筛选条件
echo "测试5: 错误处理 - 无筛选条件（预期失败）"
echo "------------------------------------------"
curl -X DELETE "$API_BASE/topics/by-filter" \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.'
echo ""
echo ""

# 测试6: 删除不存在的关键词
echo "测试6: 删除不存在的关键词（应该返回deletedCount=0）"
echo "------------------------------------------"
curl -X DELETE "$API_BASE/topics/by-keyword" \
  -H "Content-Type: application/json" \
  -d '{"keyword": "不存在的关键词XYZ"}' | jq '.'
echo ""
echo ""

echo "=========================================="
echo "测试完成"
echo "=========================================="
echo ""
echo "总结："
echo "✓ 批量删除话题功能"
echo "✓ 按关键词删除功能"
echo "✓ 按筛选条件删除功能"
echo "✓ 错误处理机制"
echo "✓ 边界情况处理"
