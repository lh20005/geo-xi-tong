#!/bin/bash

echo "========================================="
echo "测试登录流程修复"
echo "========================================="
echo ""

# 测试登录API
echo "1. 测试登录API..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

echo "响应："
echo "$RESPONSE" | jq .

# 检查是否包含 refreshToken
HAS_REFRESH_TOKEN=$(echo "$RESPONSE" | jq -r '.data.refreshToken // "undefined"')

if [ "$HAS_REFRESH_TOKEN" != "undefined" ] && [ "$HAS_REFRESH_TOKEN" != "null" ]; then
  echo "✅ refreshToken 存在"
else
  echo "❌ refreshToken 缺失"
  exit 1
fi

# 提取tokens
TOKEN=$(echo "$RESPONSE" | jq -r '.data.token')
REFRESH_TOKEN=$(echo "$RESPONSE" | jq -r '.data.refreshToken')
USER_INFO=$(echo "$RESPONSE" | jq -c '.data.user')

echo ""
echo "2. 提取的数据："
echo "   Token: ${TOKEN:0:50}..."
echo "   Refresh Token: ${REFRESH_TOKEN:0:50}..."
echo "   User Info: $USER_INFO"

echo ""
echo "3. 构建客户端URL参数："
URL_PARAMS="token=$TOKEN&refresh_token=$REFRESH_TOKEN&user_info=$(echo $USER_INFO | jq -R -r @uri)"
echo "   参数长度: ${#URL_PARAMS} 字符"
echo "   完整URL: http://localhost:5173/?${URL_PARAMS:0:100}..."

echo ""
echo "4. 验证 access token..."
VERIFY_RESPONSE=$(curl -s http://localhost:3000/api/auth/verify \
  -H "Authorization: Bearer $TOKEN")

echo "$VERIFY_RESPONSE" | jq .

if echo "$VERIFY_RESPONSE" | jq -e '.success == true' > /dev/null; then
  echo "✅ Access token 有效"
else
  echo "❌ Access token 无效"
  exit 1
fi

echo ""
echo "========================================="
echo "✅ 登录流程测试通过！"
echo "========================================="
echo ""
echo "现在可以："
echo "1. 访问 http://localhost:8080"
echo "2. 点击'立即登录'"
echo "3. 输入用户名: admin, 密码: admin123"
echo "4. 登录成功后点击'进入系统'"
echo "5. 应该成功跳转到 http://localhost:5173 并自动登录"
