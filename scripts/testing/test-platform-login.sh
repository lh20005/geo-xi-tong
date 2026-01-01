#!/bin/bash

# 测试各平台登录功能
# 使用方法: ./test-platform-login.sh <platform_id>

PLATFORM_ID=$1

if [ -z "$PLATFORM_ID" ]; then
  echo "❌ 请提供平台ID"
  echo ""
  echo "支持的平台:"
  echo "  - wangyi      (网易号)"
  echo "  - souhu       (搜狐号)"
  echo "  - baijiahao   (百家号)"
  echo "  - toutiao     (头条号) ✅ 已测试"
  echo "  - qie         (企鹅号)"
  echo "  - wechat      (微信公众号)"
  echo "  - xiaohongshu (小红书)"
  echo "  - bilibili    (B站)"
  echo "  - zhihu       (知乎)"
  echo "  - jianshu     (简书)"
  echo "  - csdn        (CSDN)"
  echo ""
  echo "使用示例:"
  echo "  ./test-platform-login.sh wangyi"
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
echo "🧪 测试平台登录功能"
echo "========================================="
echo "平台ID: $PLATFORM_ID"
echo "Token: ${TOKEN:0:20}..."
echo ""

# 调用浏览器登录API
echo "📱 正在打开浏览器登录页面..."
echo ""

RESPONSE=$(curl -s -X POST http://localhost:3000/api/platform-accounts/browser-login \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"platform\": \"$PLATFORM_ID\"}")

echo "API响应:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# 检查是否成功
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "✅ 登录成功！"
  echo ""
  echo "账号信息:"
  echo "$RESPONSE" | jq '.account' 2>/dev/null
  echo ""
  
  # 提取账号ID和用户名
  ACCOUNT_ID=$(echo "$RESPONSE" | jq -r '.account.id' 2>/dev/null)
  REAL_USERNAME=$(echo "$RESPONSE" | jq -r '.account.real_username' 2>/dev/null)
  
  if [ "$REAL_USERNAME" != "null" ] && [ -n "$REAL_USERNAME" ]; then
    echo "✅ 成功提取用户名: $REAL_USERNAME"
  else
    echo "⚠️  未能提取用户名，但账号已保存"
  fi
  
  echo ""
  echo "📋 查看所有账号:"
  curl -s http://localhost:3000/api/platform-accounts \
    -H "Authorization: Bearer $TOKEN" | jq '.accounts[] | {id, platform_id, account_name, real_username, status}'
else
  echo "❌ 登录失败"
  echo "$RESPONSE" | jq -r '.message' 2>/dev/null || echo "未知错误"
fi

echo ""
echo "========================================="
