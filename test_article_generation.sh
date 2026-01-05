#!/bin/bash

# 测试文章生成任务创建
# 使用管理员账号登录并创建任务

echo "🔐 步骤 1: 登录获取 token..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"lzc2005","password":"Woshixiaogou2005"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ 登录失败"
  echo "响应: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ 登录成功，token: ${TOKEN:0:20}..."

echo ""
echo "📊 步骤 2: 检查配额..."
QUOTA_RESPONSE=$(curl -s -X GET http://localhost:3000/api/usage/quota \
  -H "Authorization: Bearer $TOKEN")

echo "配额信息: $QUOTA_RESPONSE"

echo ""
echo "📝 步骤 3: 创建文章生成任务..."
TASK_RESPONSE=$(curl -s -X POST http://localhost:3000/api/article-generation/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "distillationId": 1,
    "albumId": 1,
    "knowledgeBaseId": 1,
    "articleSettingId": 1,
    "articleCount": 1
  }')

echo "任务创建响应:"
echo "$TASK_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$TASK_RESPONSE"

# 检查是否成功
if echo "$TASK_RESPONSE" | grep -q "taskId"; then
  echo ""
  echo "✅ 任务创建成功！"
  TASK_ID=$(echo $TASK_RESPONSE | grep -o '"taskId":[0-9]*' | cut -d':' -f2)
  echo "任务 ID: $TASK_ID"
else
  echo ""
  echo "❌ 任务创建失败"
  exit 1
fi
