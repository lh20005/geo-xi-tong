#!/bin/bash

echo "=========================================="
echo "测试发布任务API"
echo "=========================================="
echo ""

API_URL="http://localhost:3001/api"

# 测试获取任务列表
echo "1. 测试获取任务列表"
echo "=========================================="
echo ""

RESPONSE=$(curl -s "$API_URL/publishing/tasks")

echo "完整响应:"
echo "$RESPONSE" | jq '.'
echo ""

# 检查响应结构
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
HAS_DATA=$(echo "$RESPONSE" | jq 'has("data")')
HAS_TASKS=$(echo "$RESPONSE" | jq '.data | has("tasks")')
HAS_TOTAL=$(echo "$RESPONSE" | jq '.data | has("total")')

echo "响应结构检查:"
echo "  success: $SUCCESS"
echo "  has data: $HAS_DATA"
echo "  has data.tasks: $HAS_TASKS"
echo "  has data.total: $HAS_TOTAL"
echo ""

if [ "$SUCCESS" == "true" ] && [ "$HAS_TASKS" == "true" ] && [ "$HAS_TOTAL" == "true" ]; then
  TASK_COUNT=$(echo "$RESPONSE" | jq '.data.tasks | length')
  TOTAL=$(echo "$RESPONSE" | jq '.data.total')
  
  echo "✅ API响应格式正确"
  echo "  任务数量: $TASK_COUNT"
  echo "  总数: $TOTAL"
  echo ""
  
  if [ "$TASK_COUNT" -gt 0 ]; then
    echo "任务列表:"
    echo "$RESPONSE" | jq '.data.tasks[] | {id, article_id, platform_id, status, created_at}'
  else
    echo "⚠️  任务列表为空"
  fi
else
  echo "❌ API响应格式不正确"
  echo ""
  echo "期望的格式:"
  echo '{'
  echo '  "success": true,'
  echo '  "data": {'
  echo '    "tasks": [...],'
  echo '    "total": 0'
  echo '  }'
  echo '}'
fi

echo ""
