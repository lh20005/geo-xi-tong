#!/bin/bash

# 测试账号 API 隔离

echo ""
echo "========================================"
echo "🧪 测试账号 API 隔离"
echo "========================================"
echo ""

API_URL="http://localhost:3000/api/publishing/accounts"

echo "请提供测试所需的信息："
echo ""

# 获取 lzc2005 的 token
read -p "1. 请粘贴 lzc2005 的 JWT token: " LZC_TOKEN
echo ""

# 获取 testuser 的 token
read -p "2. 请粘贴 testuser 的 JWT token: " TEST_TOKEN
echo ""

echo "========================================"
echo "测试 lzc2005 的账号列表"
echo "========================================"
echo ""

curl -s -H "Authorization: Bearer $LZC_TOKEN" \
  -H "Content-Type: application/json" \
  "$API_URL" | jq '.'

echo ""
echo "========================================"
echo "测试 testuser 的账号列表"
echo "========================================"
echo ""

curl -s -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  "$API_URL" | jq '.'

echo ""
echo "========================================"
echo "分析结果"
echo "========================================"
echo ""

# 解码 token
echo "lzc2005 token 信息:"
echo "$LZC_TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq '.'

echo ""
echo "testuser token 信息:"
echo "$TEST_TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq '.'

echo ""
