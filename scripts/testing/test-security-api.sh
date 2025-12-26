#!/bin/bash

# 测试安全管理API

echo "=== 测试登录获取token ==="
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

echo "$LOGIN_RESPONSE"

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ 登录失败，无法获取token"
  exit 1
fi

echo "✅ Token获取成功: ${TOKEN:0:20}..."
echo ""

echo "=== 测试审计日志API ==="
curl -s -X GET "http://localhost:3000/api/security/audit-logs" \
  -H "Authorization: Bearer $TOKEN" | jq '.' || echo "审计日志API失败"
echo ""

echo "=== 测试权限列表API ==="
curl -s -X GET "http://localhost:3000/api/security/permissions" \
  -H "Authorization: Bearer $TOKEN" | jq '.' || echo "权限列表API失败"
echo ""

echo "=== 测试用户权限API ==="
curl -s -X GET "http://localhost:3000/api/security/user-permissions" \
  -H "Authorization: Bearer $TOKEN" | jq '.' || echo "用户权限API失败"
echo ""

echo "=== 测试安全配置API ==="
curl -s -X GET "http://localhost:3000/api/security/config" \
  -H "Authorization: Bearer $TOKEN" | jq '.' || echo "安全配置API失败"
echo ""

echo "=== 测试完成 ==="
