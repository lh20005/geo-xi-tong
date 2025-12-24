#!/bin/bash

# 测试个人资料 API 返回的日期格式

echo "=== 测试个人资料 API ==="
echo ""

# 1. 登录获取 token
echo "1. 登录 testuser..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }')

echo "登录响应:"
echo "$LOGIN_RESPONSE" | jq '.'
echo ""

# 提取 token
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ 登录失败，无法获取 token"
  exit 1
fi

echo "✓ Token: ${TOKEN:0:20}..."
echo ""

# 2. 获取个人资料
echo "2. 获取个人资料..."
PROFILE_RESPONSE=$(curl -s -X GET http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer $TOKEN")

echo "个人资料响应:"
echo "$PROFILE_RESPONSE" | jq '.'
echo ""

# 3. 检查日期字段
echo "3. 检查日期字段..."
CREATED_AT=$(echo "$PROFILE_RESPONSE" | jq -r '.data.createdAt')
UPDATED_AT=$(echo "$PROFILE_RESPONSE" | jq -r '.data.updatedAt')
LAST_LOGIN_AT=$(echo "$PROFILE_RESPONSE" | jq -r '.data.lastLoginAt')
INVITATION_CODE=$(echo "$PROFILE_RESPONSE" | jq -r '.data.invitationCode')

echo "createdAt: $CREATED_AT"
echo "updatedAt: $UPDATED_AT"
echo "lastLoginAt: $LAST_LOGIN_AT"
echo "invitationCode: $INVITATION_CODE"
echo ""

# 4. 验证结果
echo "4. 验证结果..."
if [ "$CREATED_AT" != "null" ] && [ -n "$CREATED_AT" ]; then
  echo "✓ createdAt 存在"
else
  echo "❌ createdAt 缺失"
fi

if [ "$UPDATED_AT" != "null" ] && [ -n "$UPDATED_AT" ]; then
  echo "✓ updatedAt 存在"
else
  echo "❌ updatedAt 缺失"
fi

if [ "$LAST_LOGIN_AT" != "null" ] && [ -n "$LAST_LOGIN_AT" ]; then
  echo "✓ lastLoginAt 存在"
else
  echo "⚠ lastLoginAt 为空（可能从未登录）"
fi

if [ "$INVITATION_CODE" != "null" ] && [ -n "$INVITATION_CODE" ]; then
  echo "✓ invitationCode 存在: $INVITATION_CODE"
else
  echo "❌ invitationCode 缺失"
fi

echo ""
echo "=== 测试完成 ==="
