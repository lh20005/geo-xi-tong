#!/bin/bash

# 测试抖音自动发布功能

echo "🎬 测试抖音自动发布功能"
echo "================================"
echo ""

# 检查服务是否运行
if ! curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
  echo "❌ 服务未运行，请先启动服务"
  echo "💡 运行: npm run dev"
  exit 1
fi

echo "✅ 服务正在运行"
echo ""

# 获取 token
echo "📝 获取认证 token..."
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}' | jq -r '.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ 登录失败"
  exit 1
fi

echo "✅ 登录成功"
echo ""

# 测试文章数据
ARTICLE_TITLE="抖音测试文章 - $(date +%Y%m%d%H%M%S)"
ARTICLE_CONTENT="这是一个测试文章内容，用于测试抖音自动发布功能。

装修是一件大事，需要认真对待。选择合适的装修公司，可以让你的家更加温馨舒适。

![测试图片](/uploads/test-image.jpg)

装修风格有很多种，比如现代简约、北欧风格、中式风格等。每种风格都有其独特的魅力。

选择装修公司时，要注意以下几点：
1. 查看公司资质
2. 了解设计师经验
3. 参观施工现场
4. 对比报价方案

希望这些建议对你有帮助！"

echo "📝 创建测试文章..."
ARTICLE_ID=$(curl -s -X POST http://localhost:3000/api/articles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"title\": \"$ARTICLE_TITLE\",
    \"content\": \"$ARTICLE_CONTENT\",
    \"keyword\": \"装修公司\"
  }" | jq -r '.id')

if [ "$ARTICLE_ID" = "null" ] || [ -z "$ARTICLE_ID" ]; then
  echo "❌ 创建文章失败"
  exit 1
fi

echo "✅ 文章创建成功 (ID: $ARTICLE_ID)"
echo ""

# 检查是否有抖音账号
echo "📝 检查抖音账号..."
ACCOUNT_COUNT=$(curl -s -X GET "http://localhost:3000/api/platform-accounts?platform=douyin" \
  -H "Authorization: Bearer $TOKEN" | jq '. | length')

if [ "$ACCOUNT_COUNT" = "0" ]; then
  echo "⚠️  未找到抖音账号"
  echo "💡 请先添加抖音账号："
  echo "   1. 访问 http://localhost:3000"
  echo "   2. 登录系统"
  echo "   3. 进入「平台账号管理」"
  echo "   4. 添加抖音账号"
  echo ""
  exit 1
fi

echo "✅ 找到 $ACCOUNT_COUNT 个抖音账号"
echo ""

# 获取第一个抖音账号ID
ACCOUNT_ID=$(curl -s -X GET "http://localhost:3000/api/platform-accounts?platform=douyin" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')

echo "📝 使用账号 ID: $ACCOUNT_ID"
echo ""

# 创建发布任务
echo "📝 创建发布任务..."
TASK_ID=$(curl -s -X POST http://localhost:3000/api/publishing-tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"articleId\": $ARTICLE_ID,
    \"accountId\": $ACCOUNT_ID,
    \"scheduledAt\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"
  }" | jq -r '.id')

if [ "$TASK_ID" = "null" ] || [ -z "$TASK_ID" ]; then
  echo "❌ 创建发布任务失败"
  exit 1
fi

echo "✅ 发布任务创建成功 (ID: $TASK_ID)"
echo ""

# 等待发布完成
echo "⏳ 等待发布完成（最多等待 60 秒）..."
echo ""

for i in {1..60}; do
  STATUS=$(curl -s -X GET "http://localhost:3000/api/publishing-tasks/$TASK_ID" \
    -H "Authorization: Bearer $TOKEN" | jq -r '.status')
  
  echo "[$i/60] 当前状态: $STATUS"
  
  if [ "$STATUS" = "completed" ]; then
    echo ""
    echo "✅ 发布成功！"
    echo ""
    echo "📊 任务详情："
    curl -s -X GET "http://localhost:3000/api/publishing-tasks/$TASK_ID" \
      -H "Authorization: Bearer $TOKEN" | jq '.'
    exit 0
  elif [ "$STATUS" = "failed" ]; then
    echo ""
    echo "❌ 发布失败"
    echo ""
    echo "📊 任务详情："
    curl -s -X GET "http://localhost:3000/api/publishing-tasks/$TASK_ID" \
      -H "Authorization: Bearer $TOKEN" | jq '.'
    exit 1
  fi
  
  sleep 1
done

echo ""
echo "⏰ 超时：发布任务未在 60 秒内完成"
echo ""
echo "📊 当前任务状态："
curl -s -X GET "http://localhost:3000/api/publishing-tasks/$TASK_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

exit 1
