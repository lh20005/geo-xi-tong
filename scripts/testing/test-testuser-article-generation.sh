#!/bin/bash

echo "=== 测试testuser账号的文章生成 ==="
echo ""

# 1. 登录
echo "1. 登录testuser..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"123456"}')

echo "登录响应: $LOGIN_RESPONSE"
echo ""

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ 登录失败"
  exit 1
fi

echo "✅ 登录成功，token: ${TOKEN:0:30}..."
echo ""

# 2. 检查数据
echo "2. 检查蒸馏历史..."
DISTILLATIONS=$(curl -s -X GET "http://localhost:3000/api/distillation/history?page=1&pageSize=10" \
  -H "Authorization: Bearer $TOKEN")
echo "$DISTILLATIONS" | python3 -m json.tool 2>/dev/null || echo "$DISTILLATIONS"
echo ""

echo "3. 检查相册..."
ALBUMS=$(curl -s -X GET "http://localhost:3000/api/gallery/albums" \
  -H "Authorization: Bearer $TOKEN")
echo "$ALBUMS" | python3 -m json.tool 2>/dev/null || echo "$ALBUMS"
echo ""

echo "4. 检查知识库..."
KB=$(curl -s -X GET "http://localhost:3000/api/knowledge-bases" \
  -H "Authorization: Bearer $TOKEN")
echo "$KB" | python3 -m json.tool 2>/dev/null || echo "$KB"
echo ""

echo "5. 检查文章设置..."
SETTINGS=$(curl -s -X GET "http://localhost:3000/api/article-settings" \
  -H "Authorization: Bearer $TOKEN")
echo "$SETTINGS" | python3 -m json.tool 2>/dev/null || echo "$SETTINGS"
echo ""

# 3. 尝试创建文章生成任务（使用实际的ID）
echo "6. 尝试创建文章生成任务..."
echo "请手动输入正确的ID值："
echo "- distillationId: (从上面的蒸馏历史中选择一个ID)"
echo "- albumId: (从上面的相册中选择一个ID)"
echo "- knowledgeBaseId: (从上面的知识库中选择一个ID)"
echo "- articleSettingId: (从上面的文章设置中选择一个ID)"
echo ""

# 使用第一个可用的ID进行测试
DIST_ID=$(echo "$DISTILLATIONS" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
ALBUM_ID=$(echo "$ALBUMS" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
KB_ID=$(echo "$KB" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
SETTING_ID=$(echo "$SETTINGS" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -n "$DIST_ID" ] && [ -n "$ALBUM_ID" ] && [ -n "$KB_ID" ] && [ -n "$SETTING_ID" ]; then
  echo "使用以下ID进行测试:"
  echo "- distillationId: $DIST_ID"
  echo "- albumId: $ALBUM_ID"
  echo "- knowledgeBaseId: $KB_ID"
  echo "- articleSettingId: $SETTING_ID"
  echo ""
  
  RESPONSE=$(curl -s -X POST http://localhost:3000/api/article-generation/tasks \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"distillationId\": $DIST_ID,
      \"albumId\": $ALBUM_ID,
      \"knowledgeBaseId\": $KB_ID,
      \"articleSettingId\": $SETTING_ID,
      \"articleCount\": 1
    }")
  
  echo "响应:"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
  echo ""
  
  if echo "$RESPONSE" | grep -q '"taskId"'; then
    echo "✅ 任务创建成功！"
  else
    echo "❌ 任务创建失败"
    echo ""
    echo "详细错误信息:"
    echo "$RESPONSE"
  fi
else
  echo "❌ 缺少必要的数据，无法创建任务"
  echo "请先在网页端创建："
  [ -z "$DIST_ID" ] && echo "  - 蒸馏历史"
  [ -z "$ALBUM_ID" ] && echo "  - 相册"
  [ -z "$KB_ID" ] && echo "  - 知识库"
  [ -z "$SETTING_ID" ] && echo "  - 文章设置"
fi
