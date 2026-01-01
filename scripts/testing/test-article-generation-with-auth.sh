#!/bin/bash

echo "=== 测试文章生成API（带认证） ==="
echo ""

# 1. 先登录获取token
echo "1. 登录获取token..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user1",
    "password": "User123456"
  }')

echo "登录响应: $LOGIN_RESPONSE"
echo ""

# 提取token
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ 登录失败，无法获取token"
  exit 1
fi

echo "✅ 获取到token: ${TOKEN:0:20}..."
echo ""

# 2. 使用token调用文章生成API
echo "2. 调用文章生成API..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/article-generation/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "distillationId": 1,
    "albumId": 1,
    "knowledgeBaseId": 1,
    "articleSettingId": 1,
    "articleCount": 1
  }')

echo "响应: $RESPONSE"
echo ""

# 检查响应
if echo "$RESPONSE" | grep -q '"taskId"'; then
  echo "✅ 文章生成任务创建成功！"
else
  echo "❌ 文章生成任务创建失败"
  echo "错误详情: $RESPONSE"
fi
