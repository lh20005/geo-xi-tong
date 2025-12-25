#!/bin/bash

# 测试管理员API端点
# 使用方法: ./test-admin-apis.sh <auth_token>

if [ -z "$1" ]; then
  echo "请提供认证令牌"
  echo "使用方法: ./test-admin-apis.sh <auth_token>"
  exit 1
fi

TOKEN=$1
API_URL="http://localhost:3000"

echo "========================================="
echo "测试管理员API端点"
echo "========================================="
echo ""

# 测试订单列表API
echo "1. 测试订单列表 API: GET /api/admin/orders"
echo "-----------------------------------------"
curl -s -X GET "${API_URL}/api/admin/orders?page=1&limit=10" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo ""

# 测试订单统计API
echo "2. 测试订单统计 API: GET /api/admin/orders/stats/summary"
echo "-----------------------------------------"
curl -s -X GET "${API_URL}/api/admin/orders/stats/summary" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo ""

# 测试套餐列表API
echo "3. 测试套餐列表 API: GET /api/admin/products"
echo "-----------------------------------------"
curl -s -X GET "${API_URL}/api/admin/products" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo ""

# 测试用户列表API（确认管理员路由工作）
echo "4. 测试用户列表 API: GET /api/admin/users"
echo "-----------------------------------------"
curl -s -X GET "${API_URL}/api/admin/users?page=1&pageSize=10" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo ""

echo "========================================="
echo "测试完成"
echo "========================================="
