#!/bin/bash

echo "=== 检查用户数据 ==="
echo ""

# 登录
echo "1. 登录..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user1","password":"User123456"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ 登录失败"
  exit 1
fi

echo "✅ 登录成功"
echo ""

# 检查蒸馏历史
echo "2. 检查蒸馏历史..."
DISTILLATIONS=$(curl -s -X GET "http://localhost:3000/api/distillation/history" \
  -H "Authorization: Bearer $TOKEN")
echo "$DISTILLATIONS" | head -5
echo ""

# 检查相册
echo "3. 检查相册..."
ALBUMS=$(curl -s -X GET "http://localhost:3000/api/gallery/albums" \
  -H "Authorization: Bearer $TOKEN")
echo "$ALBUMS"
echo ""

# 检查知识库
echo "4. 检查知识库..."
KB=$(curl -s -X GET "http://localhost:3000/api/knowledge-bases" \
  -H "Authorization: Bearer $TOKEN")
echo "$KB"
echo ""

# 检查文章设置
echo "5. 检查文章设置..."
SETTINGS=$(curl -s -X GET "http://localhost:3000/api/article-settings" \
  -H "Authorization: Bearer $TOKEN")
echo "$SETTINGS"
echo ""

echo "=== 检查完成 ==="
echo ""
echo "💡 提示："
echo "- 如果以上数据都是空的，说明当前用户没有任何数据"
echo "- 需要先在网页端创建蒸馏历史、相册、知识库、文章设置"
echo "- 然后才能生成文章"
