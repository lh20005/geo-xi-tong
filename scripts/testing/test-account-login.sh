#!/bin/bash

# 测试账号登录功能
# 使用方法: ./test-account-login.sh <account_id>

ACCOUNT_ID=$1

if [ -z "$ACCOUNT_ID" ]; then
  echo "❌ 请提供账号ID"
  echo ""
  echo "使用方法:"
  echo "  ./test-account-login.sh <account_id>"
  echo ""
  echo "示例:"
  echo "  ./test-account-login.sh 123"
  echo ""
  echo "💡 提示: 可以在平台管理页面的账号列表中查看账号ID"
  exit 1
fi

# 获取认证token
TOKEN=$(cat ~/.kiro/auth_token 2>/dev/null || echo "")

if [ -z "$TOKEN" ]; then
  echo "❌ 未找到认证token，请先登录"
  echo "提示: token应该保存在 ~/.kiro/auth_token"
  exit 1
fi

echo "========================================="
echo "🧪 测试账号登录功能"
echo "========================================="
echo "账号ID: $ACCOUNT_ID"
echo "Token: ${TOKEN:0:20}..."
echo ""

# 先获取账号信息
echo "📋 获取账号信息..."
ACCOUNT_INFO=$(curl -s http://localhost:3000/api/platform-accounts/accounts/$ACCOUNT_ID \
  -H "Authorization: Bearer $TOKEN")

if echo "$ACCOUNT_INFO" | grep -q '"success":true'; then
  PLATFORM_ID=$(echo "$ACCOUNT_INFO" | jq -r '.data.platform_id' 2>/dev/null)
  ACCOUNT_NAME=$(echo "$ACCOUNT_INFO" | jq -r '.data.account_name' 2>/dev/null)
  REAL_USERNAME=$(echo "$ACCOUNT_INFO" | jq -r '.data.real_username' 2>/dev/null)
  
  echo "✅ 账号信息:"
  echo "  - 平台: $PLATFORM_ID"
  echo "  - 账号名: $ACCOUNT_NAME"
  echo "  - 真实用户名: $REAL_USERNAME"
  echo ""
else
  echo "❌ 获取账号信息失败"
  echo "$ACCOUNT_INFO" | jq '.' 2>/dev/null || echo "$ACCOUNT_INFO"
  exit 1
fi

# 测试登录
echo "🔄 开始测试登录..."
echo "💡 浏览器将自动打开，请稍候..."
echo ""

RESPONSE=$(curl -s -X POST http://localhost:3000/api/platform-accounts/accounts/$ACCOUNT_ID/test-login \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN")

echo "API响应:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# 检查是否成功
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "✅ 测试成功！"
  MESSAGE=$(echo "$RESPONSE" | jq -r '.message' 2>/dev/null)
  echo "📝 消息: $MESSAGE"
else
  echo "❌ 测试失败"
  MESSAGE=$(echo "$RESPONSE" | jq -r '.message' 2>/dev/null)
  echo "📝 错误: $MESSAGE"
fi

echo ""
echo "========================================="
echo "💡 提示:"
echo "  - 浏览器会自动打开并导航到平台"
echo "  - 查看是否已登录"
echo "  - 浏览器将在10秒后自动关闭"
echo "========================================="
