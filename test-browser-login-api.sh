#!/bin/bash

echo "======================================"
echo "测试浏览器登录API"
echo "======================================"
echo ""

API_URL="http://localhost:3001/api/publishing"

echo "1. 测试获取平台列表"
echo "GET $API_URL/platforms"
curl -s "$API_URL/platforms" | jq '.'
echo ""
echo "---"
echo ""

echo "2. 测试获取账号列表"
echo "GET $API_URL/accounts"
curl -s "$API_URL/accounts" | jq '.'
echo ""
echo "---"
echo ""

echo "3. 测试浏览器登录API（知乎）"
echo "POST $API_URL/browser-login"
echo "注意：这将打开浏览器窗口，请在浏览器中完成登录"
echo ""
read -p "按回车键继续测试浏览器登录，或按Ctrl+C取消..."
echo ""

curl -X POST "$API_URL/browser-login" \
  -H "Content-Type: application/json" \
  -d '{"platform_id":"zhihu"}' \
  | jq '.'

echo ""
echo "---"
echo ""

echo "4. 再次获取账号列表，查看是否新增账号"
echo "GET $API_URL/accounts"
curl -s "$API_URL/accounts" | jq '.'
echo ""

echo "======================================"
echo "测试完成"
echo "======================================"
