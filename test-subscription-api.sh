#!/bin/bash

# 商品订阅系统 API 测试脚本

echo "========================================="
echo "商品订阅系统 API 测试"
echo "========================================="
echo ""

# 配置
API_URL="http://localhost:3000/api"
TOKEN=""

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 登录获取 token
echo "1. 登录获取 token..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ 登录失败${NC}"
  echo $LOGIN_RESPONSE
  exit 1
fi

echo -e "${GREEN}✅ 登录成功${NC}"
echo "Token: ${TOKEN:0:20}..."
echo ""

# 2. 获取所有套餐
echo "2. 获取所有套餐..."
PLANS_RESPONSE=$(curl -s -X GET "$API_URL/subscription/plans" \
  -H "Authorization: Bearer $TOKEN")

echo $PLANS_RESPONSE | jq '.'
echo ""

# 3. 获取用户当前订阅
echo "3. 获取用户当前订阅..."
SUBSCRIPTION_RESPONSE=$(curl -s -X GET "$API_URL/subscription/current" \
  -H "Authorization: Bearer $TOKEN")

echo $SUBSCRIPTION_RESPONSE | jq '.'
echo ""

# 4. 创建订单（选择专业版，plan_id=2）
echo "4. 创建订单（专业版）..."
ORDER_RESPONSE=$(curl -s -X POST "$API_URL/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "plan_id": 2
  }')

echo $ORDER_RESPONSE | jq '.'

ORDER_NO=$(echo $ORDER_RESPONSE | grep -o '"order_no":"[^"]*' | cut -d'"' -f4)

if [ -z "$ORDER_NO" ]; then
  echo -e "${YELLOW}⚠️  创建订单失败（可能是微信支付未配置）${NC}"
else
  echo -e "${GREEN}✅ 订单创建成功${NC}"
  echo "订单号: $ORDER_NO"
fi
echo ""

# 5. 查询订单状态
if [ ! -z "$ORDER_NO" ]; then
  echo "5. 查询订单状态..."
  STATUS_RESPONSE=$(curl -s -X GET "$API_URL/orders/$ORDER_NO/status" \
    -H "Authorization: Bearer $TOKEN")

  echo $STATUS_RESPONSE | jq '.'
  echo ""
fi

# 6. 获取用户订单列表
echo "6. 获取用户订单列表..."
ORDERS_RESPONSE=$(curl -s -X GET "$API_URL/orders?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN")

echo $ORDERS_RESPONSE | jq '.'
echo ""

# 7. 获取使用统计
echo "7. 获取使用统计..."
USAGE_RESPONSE=$(curl -s -X GET "$API_URL/subscription/usage-stats" \
  -H "Authorization: Bearer $TOKEN")

echo $USAGE_RESPONSE | jq '.'
echo ""

echo "========================================="
echo "测试完成"
echo "========================================="
