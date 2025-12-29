#!/bin/bash

# 测试保存头条号账号

SERVER="http://localhost:3000"

echo "=========================================="
echo "测试保存头条号账号"
echo "=========================================="
echo ""

# 1. 登录获取 token
echo "步骤 1: 登录获取 token..."
LOGIN_RESPONSE=$(curl -s -X POST "$SERVER/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"lzc2005","password":"lzc2005"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ 登录失败"
  echo "响应: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ 登录成功"
echo "Token: ${TOKEN:0:50}..."
echo ""

# 2. 创建测试账号（模拟浏览器登录后的数据）
echo "步骤 2: 创建测试账号..."

# 创建一个简单的测试数据
TEST_DATA='{
  "platform_id": "toutiao",
  "account_name": "测试账号",
  "real_username": "测试用户",
  "credentials": {
    "username": "browser_login",
    "password": "cookie_auth",
    "cookies": [
      {
        "name": "test_cookie",
        "value": "test_value",
        "domain": "mp.toutiao.com",
        "path": "/",
        "expires": 1767611177,
        "httpOnly": true,
        "secure": false
      }
    ],
    "loginTime": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'"
  }
}'

echo "发送请求..."
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$SERVER/api/publishing/accounts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$TEST_DATA")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "HTTP 状态码: $HTTP_STATUS"
echo "响应内容:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ 账号保存成功"
else
  echo "❌ 账号保存失败"
  echo ""
  echo "请检查后端日志获取详细错误信息"
fi

echo ""
echo "=========================================="
echo "测试完成"
echo "=========================================="
