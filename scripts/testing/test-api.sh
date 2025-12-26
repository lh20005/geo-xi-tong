#!/bin/bash

# API测试脚本
# 测试后端API端点

echo "========================================="
echo "后端API测试"
echo "========================================="
echo ""

# 检查后端服务器是否运行
echo "检查后端服务器状态..."
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✓ 后端服务器正在运行"
else
    echo "✗ 后端服务器未运行"
    echo ""
    echo "请先启动后端服务器："
    echo "  cd server && npm run dev"
    echo ""
    exit 1
fi

echo ""
echo "========================================="
echo "测试 Auth API"
echo "========================================="
echo ""

# 测试登录
echo "测试: POST /api/auth/login"
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

if echo "$LOGIN_RESPONSE" | grep -q "token"; then
    echo "✓ 登录成功"
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    echo "  Token: ${TOKEN:0:20}..."
else
    echo "✗ 登录失败"
    echo "  Response: $LOGIN_RESPONSE"
    exit 1
fi

echo ""
echo "========================================="
echo "测试 Account API"
echo "========================================="
echo ""

# 测试获取账号列表
echo "测试: GET /api/platform-accounts"
ACCOUNTS_RESPONSE=$(curl -s -X GET http://localhost:3000/api/platform-accounts \
  -H "Authorization: Bearer $TOKEN")

if echo "$ACCOUNTS_RESPONSE" | grep -q "\["; then
    echo "✓ 获取账号列表成功"
    ACCOUNT_COUNT=$(echo "$ACCOUNTS_RESPONSE" | grep -o "platform_id" | wc -l)
    echo "  账号数量: $ACCOUNT_COUNT"
else
    echo "✗ 获取账号列表失败"
    echo "  Response: $ACCOUNTS_RESPONSE"
fi

echo ""
echo "========================================="
echo "测试 WebSocket"
echo "========================================="
echo ""

# 检查WebSocket端点
echo "测试: WebSocket端点可用性"
if curl -s -I http://localhost:3000/ws | grep -q "101\|426"; then
    echo "✓ WebSocket端点可用"
else
    echo "⊘ WebSocket端点测试跳过（需要WebSocket客户端）"
fi

echo ""
echo "========================================="
echo "API测试完成"
echo "========================================="
