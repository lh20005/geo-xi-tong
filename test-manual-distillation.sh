#!/bin/bash

# 测试手动批量输入蒸馏结果API

API_URL="http://localhost:3001/api/distillation/manual"

echo "=========================================="
echo "测试手动批量输入蒸馏结果API"
echo "=========================================="
echo ""

# 测试1: 正常输入
echo "测试1: 正常输入多个蒸馏结果"
echo "------------------------------------------"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "产品设计",
    "questions": [
      "用户体验设计的核心原则是什么？",
      "如何进行用户研究？",
      "产品迭代的最佳实践？",
      "设计系统如何搭建？"
    ]
  }' | jq '.'
echo ""
echo ""

# 测试2: 单个蒸馏结果
echo "测试2: 输入单个蒸馏结果"
echo "------------------------------------------"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "时间管理",
    "questions": [
      "如何提高工作效率？"
    ]
  }' | jq '.'
echo ""
echo ""

# 测试3: 包含空字符串（应该被过滤）
echo "测试3: 包含空字符串（应该被自动过滤）"
echo "------------------------------------------"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "市场营销",
    "questions": [
      "如何制定营销策略？",
      "",
      "什么是内容营销？",
      "   ",
      "社交媒体营销技巧？"
    ]
  }' | jq '.'
echo ""
echo ""

# 测试4: 缺少关键词（应该失败）
echo "测试4: 缺少关键词（预期失败）"
echo "------------------------------------------"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "questions": [
      "这是一个问题？"
    ]
  }' | jq '.'
echo ""
echo ""

# 测试5: 缺少蒸馏结果（应该失败）
echo "测试5: 缺少蒸馏结果（预期失败）"
echo "------------------------------------------"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "测试关键词"
  }' | jq '.'
echo ""
echo ""

# 测试6: 空的蒸馏结果数组（应该失败）
echo "测试6: 空的蒸馏结果数组（预期失败）"
echo "------------------------------------------"
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "测试关键词",
    "questions": []
  }' | jq '.'
echo ""
echo ""

# 查询结果
echo "=========================================="
echo "查询蒸馏结果列表（验证数据已保存）"
echo "=========================================="
curl -X GET "http://localhost:3001/api/distillation/results?pageSize=20" \
  -H "Content-Type: application/json" | jq '.data[] | select(.provider == "manual") | {id, keyword, question, provider}'
echo ""

echo "=========================================="
echo "测试完成"
echo "=========================================="
