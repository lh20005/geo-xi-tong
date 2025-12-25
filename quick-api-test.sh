#!/bin/bash

# 快速API测试脚本
# 测试订单和套餐管理API

API_URL="http://localhost:3000"

echo "========================================="
echo "快速API测试"
echo "========================================="
echo ""

# 首先登录获取token
echo "1. 登录获取令牌..."
echo "-----------------------------------------"
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }')

echo "$LOGIN_RESPONSE" | jq '.'

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token // .token // empty')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ 登录失败，无法获取令牌"
  echo "请检查管理员账号是否存在"
  echo ""
  echo "创建管理员账号："
  echo "psql postgresql://lzc@localhost:5432/geo_system -c \"INSERT INTO users (username, password, role) VALUES ('admin', '\$2b\$10\$YourHashedPasswordHere', 'admin');\""
  exit 1
fi

echo ""
echo "✅ 登录成功，令牌: ${TOKEN:0:20}..."
echo ""

# 测试订单列表
echo "2. 测试订单列表 API"
echo "-----------------------------------------"
curl -s -X GET "${API_URL}/api/admin/orders?page=1&limit=10" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo ""

# 测试订单统计
echo "3. 测试订单统计 API"
echo "-----------------------------------------"
curl -s -X GET "${API_URL}/api/admin/orders/stats/summary" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo ""

# 测试套餐列表
echo "4. 测试套餐列表 API"
echo "-----------------------------------------"
curl -s -X GET "${API_URL}/api/admin/products" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo ""

echo "========================================="
echo "测试完成"
echo "========================================="
echo ""
echo "如果所有API都返回success: true，说明后端正常"
echo "如果前端仍然报错，请检查："
echo "1. 浏览器控制台的Network标签页"
echo "2. localStorage中的auth_token是否有效"
echo "3. 前端是否正确发送Authorization header"
