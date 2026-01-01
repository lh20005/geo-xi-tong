#!/bin/bash

echo "🔍 测试蒸馏历史API..."
echo ""

# 获取管理员的token
echo "1️⃣ 登录获取token..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"lzc2005","password":"Lzc20050828"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ 登录失败"
  echo "响应: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ 登录成功，token: ${TOKEN:0:20}..."
echo ""

# 测试蒸馏历史API
echo "2️⃣ 测试 /api/distillation/stats API..."
STATS_RESPONSE=$(curl -s -X GET "http://localhost:3000/api/distillation/stats?page=1&pageSize=100" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "响应:"
echo "$STATS_RESPONSE" | jq '.'
echo ""

# 统计数量
TOTAL=$(echo "$STATS_RESPONSE" | jq -r '.total // 0')
DISTILLATIONS_COUNT=$(echo "$STATS_RESPONSE" | jq -r '.distillations | length // 0')

echo "📊 统计结果:"
echo "  - 总数: $TOTAL"
echo "  - 返回数量: $DISTILLATIONS_COUNT"
echo ""

if [ "$DISTILLATIONS_COUNT" -gt 0 ]; then
  echo "✅ 蒸馏历史API正常，找到 $DISTILLATIONS_COUNT 条记录"
  echo ""
  echo "前3条记录:"
  echo "$STATS_RESPONSE" | jq -r '.distillations[:3] | .[] | "  - ID: \(.distillationId), 关键词: \(.keyword), 话题数: \(.topicCount), 使用次数: \(.usageCount)"'
else
  echo "⚠️  没有找到蒸馏历史记录"
  echo "可能原因："
  echo "  1. 该用户还没有创建过蒸馏记录"
  echo "  2. 数据库中没有数据"
fi
