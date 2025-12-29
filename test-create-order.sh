#!/bin/bash

echo "=== 测试创建订单 API ==="
echo ""

# 1. 先登录获取 token
echo "1. 登录获取 token..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "lzc2005",
    "password": "Woshixiaogou2005"
  }')

echo "登录响应: $LOGIN_RESPONSE"
echo ""

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ 登录失败，无法获取 token"
  exit 1
fi

echo "✅ 获取到 token: ${TOKEN:0:20}..."
echo ""

# 2. 创建订单
echo "2. 创建订单..."
ORDER_RESPONSE=$(curl -s -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "plan_id": 2,
    "order_type": "purchase"
  }')

echo "订单响应: $ORDER_RESPONSE"
echo ""

# 3. 检查响应
if echo "$ORDER_RESPONSE" | grep -q '"success":true'; then
  echo "✅ 订单创建成功"
else
  echo "❌ 订单创建失败"
fi
