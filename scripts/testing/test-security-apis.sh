#!/bin/bash

# 测试安全管理API
# 使用方法: ./test-security-apis.sh <auth_token>

if [ -z "$1" ]; then
  echo "请提供认证令牌"
  echo "使用方法: ./test-security-apis.sh <auth_token>"
  exit 1
fi

TOKEN=$1
API_URL="http://localhost:3000"

echo "========================================="
echo "测试安全管理API"
echo "========================================="
echo ""

# 测试审计日志API
echo "1. 测试审计日志 API: GET /api/security/audit-logs"
echo "-----------------------------------------"
curl -s -X GET "${API_URL}/api/security/audit-logs?page=1&pageSize=10" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo ""

# 测试安全配置API
echo "2. 测试安全配置 API: GET /api/security/config"
echo "-----------------------------------------"
curl -s -X GET "${API_URL}/api/security/config" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo ""

# 测试权限列表API
echo "3. 测试权限列表 API: GET /api/security/permissions"
echo "-----------------------------------------"
curl -s -X GET "${API_URL}/api/security/permissions" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo ""

# 测试安全指标API
echo "4. 测试安全指标 API: GET /api/security/metrics"
echo "-----------------------------------------"
curl -s -X GET "${API_URL}/api/security/metrics" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo ""

echo "========================================="
echo "测试完成"
echo "========================================="
