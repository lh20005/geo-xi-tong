#!/bin/bash

echo "=========================================="
echo "测试创建发布任务API"
echo "=========================================="
echo ""

API_URL="http://localhost:3001/api"

# 1. 检查服务器是否运行
echo "1. 检查服务器状态..."
HEALTH=$(curl -s "$API_URL/health")

if [ $? -ne 0 ]; then
  echo "❌ 服务器未运行！"
  echo "请先启动服务器: npm run dev"
  exit 1
fi

echo "✅ 服务器运行正常"
echo "$HEALTH" | jq '.'
echo ""

# 2. 获取平台配置
echo "=========================================="
echo "2. 获取平台配置"
echo "=========================================="
echo ""

PLATFORMS=$(curl -s "$API_URL/publishing/platforms")
echo "$PLATFORMS" | jq '.'
echo ""

PLATFORM_COUNT=$(echo "$PLATFORMS" | jq '.data | length')
echo "平台数量: $PLATFORM_COUNT"
echo ""

if [ "$PLATFORM_COUNT" -eq 0 ]; then
  echo "❌ 没有平台配置！请运行数据库迁移"
  exit 1
fi

# 3. 获取账号列表
echo "=========================================="
echo "3. 获取账号列表"
echo "=========================================="
echo ""

ACCOUNTS=$(curl -s "$API_URL/publishing/accounts")
echo "$ACCOUNTS" | jq '.'
echo ""

ACCOUNT_COUNT=$(echo "$ACCOUNTS" | jq '.data | length')
echo "账号数量: $ACCOUNT_COUNT"
echo ""

if [ "$ACCOUNT_COUNT" -eq 0 ]; then
  echo "⚠️  没有绑定账号！"
  echo "请先在'平台登录'页面绑定账号"
  echo ""
  echo "跳过创建任务测试..."
  exit 0
fi

# 获取第一个账号
FIRST_ACCOUNT=$(echo "$ACCOUNTS" | jq '.data[0]')
ACCOUNT_ID=$(echo "$FIRST_ACCOUNT" | jq -r '.id')
PLATFORM_ID=$(echo "$FIRST_ACCOUNT" | jq -r '.platform_id')

echo "将使用账号:"
echo "  ID: $ACCOUNT_ID"
echo "  平台: $PLATFORM_ID"
echo ""

# 4. 获取文章列表
echo "=========================================="
echo "4. 获取文章列表"
echo "=========================================="
echo ""

ARTICLES=$(curl -s "$API_URL/articles?limit=1")
ARTICLE_COUNT=$(echo "$ARTICLES" | jq '.articles | length')

if [ "$ARTICLE_COUNT" -eq 0 ]; then
  echo "❌ 没有文章！"
  echo "请先创建至少一篇文章"
  exit 1
fi

ARTICLE=$(echo "$ARTICLES" | jq '.articles[0]')
ARTICLE_ID=$(echo "$ARTICLE" | jq -r '.id')
ARTICLE_TITLE=$(echo "$ARTICLE" | jq -r '.title')

echo "将使用文章:"
echo "  ID: $ARTICLE_ID"
echo "  标题: $ARTICLE_TITLE"
echo ""

# 5. 创建发布任务
echo "=========================================="
echo "5. 创建发布任务"
echo "=========================================="
echo ""

TASK_DATA=$(cat <<EOF
{
  "article_id": $ARTICLE_ID,
  "account_id": $ACCOUNT_ID,
  "platform_id": "$PLATFORM_ID",
  "config": {
    "title": "$ARTICLE_TITLE",
    "category": "测试",
    "tags": ["测试", "自动发布"]
  }
}
EOF
)

echo "请求数据:"
echo "$TASK_DATA" | jq '.'
echo ""

echo "发送请求..."
RESPONSE=$(curl -s -X POST "$API_URL/publishing/tasks" \
  -H "Content-Type: application/json" \
  -d "$TASK_DATA")

echo ""
echo "响应:"
echo "$RESPONSE" | jq '.'
echo ""

# 检查响应
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')

if [ "$SUCCESS" == "true" ]; then
  TASK_ID=$(echo "$RESPONSE" | jq -r '.data.id')
  echo "=========================================="
  echo "✅ 任务创建成功！"
  echo "=========================================="
  echo ""
  echo "任务ID: $TASK_ID"
  echo ""
  
  # 等待2秒
  echo "等待2秒后查询任务状态..."
  sleep 2
  
  # 查询任务状态
  echo ""
  echo "=========================================="
  echo "6. 查询任务状态"
  echo "=========================================="
  echo ""
  
  TASK_STATUS=$(curl -s "$API_URL/publishing/tasks/$TASK_ID")
  echo "$TASK_STATUS" | jq '.'
  echo ""
  
  STATUS=$(echo "$TASK_STATUS" | jq -r '.data.status')
  echo "当前状态: $STATUS"
  echo ""
  
  # 查询任务列表
  echo "=========================================="
  echo "7. 查询任务列表"
  echo "=========================================="
  echo ""
  
  TASKS=$(curl -s "$API_URL/publishing/tasks")
  echo "$TASKS" | jq '.'
  echo ""
  
else
  ERROR_MSG=$(echo "$RESPONSE" | jq -r '.message')
  echo "=========================================="
  echo "❌ 任务创建失败！"
  echo "=========================================="
  echo ""
  echo "错误信息: $ERROR_MSG"
  echo ""
  
  # 检查是否是数据库错误
  if [[ "$ERROR_MSG" == *"relation"* ]] || [[ "$ERROR_MSG" == *"table"* ]]; then
    echo "可能是数据库表不存在，请运行迁移:"
    echo "  ./run-publishing-migration.sh"
    echo ""
  fi
fi
