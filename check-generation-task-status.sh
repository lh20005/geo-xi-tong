#!/bin/bash

echo "=== 检查文章生成任务状态 ==="
echo ""

# 登录
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"123456"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ 登录失败"
  exit 1
fi

echo "✅ 登录成功"
echo ""

# 获取最近的任务列表
echo "📋 获取最近的任务列表..."
TASKS=$(curl -s -X GET "http://localhost:3000/api/article-generation/tasks?page=1&pageSize=5" \
  -H "Authorization: Bearer $TOKEN")

echo "$TASKS" | python3 -m json.tool 2>/dev/null || echo "$TASKS"
echo ""

# 提取最新任务ID
LATEST_TASK_ID=$(echo "$TASKS" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -n "$LATEST_TASK_ID" ]; then
  echo "🔍 查看最新任务详情 (ID: $LATEST_TASK_ID)..."
  TASK_DETAIL=$(curl -s -X GET "http://localhost:3000/api/article-generation/tasks/$LATEST_TASK_ID" \
    -H "Authorization: Bearer $TOKEN")
  
  echo "$TASK_DETAIL" | python3 -m json.tool 2>/dev/null || echo "$TASK_DETAIL"
  echo ""
  
  # 检查错误信息
  ERROR_MSG=$(echo "$TASK_DETAIL" | grep -o '"error_message":"[^"]*"' | cut -d'"' -f4)
  if [ -n "$ERROR_MSG" ]; then
    echo "❌ 任务失败原因: $ERROR_MSG"
  fi
  
  # 诊断任务
  echo ""
  echo "🔧 诊断任务..."
  DIAGNOSE=$(curl -s -X GET "http://localhost:3000/api/article-generation/tasks/$LATEST_TASK_ID/diagnose" \
    -H "Authorization: Bearer $TOKEN")
  
  echo "$DIAGNOSE" | python3 -m json.tool 2>/dev/null || echo "$DIAGNOSE"
fi
