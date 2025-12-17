#!/bin/bash

# 自动登录发布功能测试脚本

echo "=========================================="
echo "自动登录发布功能测试"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# API基础URL
API_URL="http://localhost:3001/api"

echo "📋 测试步骤："
echo "1. 检查已绑定的平台账号"
echo "2. 获取测试文章"
echo "3. 创建发布任务"
echo "4. 查看任务状态"
echo ""

# 1. 检查已绑定的平台账号
echo "=========================================="
echo "1️⃣  检查已绑定的平台账号"
echo "=========================================="

ACCOUNTS=$(curl -s "$API_URL/platform-accounts")
echo "$ACCOUNTS" | jq '.'

ACCOUNT_COUNT=$(echo "$ACCOUNTS" | jq 'length')
echo ""
echo -e "${GREEN}✅ 找到 $ACCOUNT_COUNT 个已绑定账号${NC}"
echo ""

if [ "$ACCOUNT_COUNT" -eq 0 ]; then
  echo -e "${RED}❌ 没有找到已绑定的账号${NC}"
  echo "请先在'平台登录'页面绑定至少一个平台账号"
  exit 1
fi

# 获取第一个账号信息
FIRST_ACCOUNT=$(echo "$ACCOUNTS" | jq '.[0]')
ACCOUNT_ID=$(echo "$FIRST_ACCOUNT" | jq -r '.id')
PLATFORM_ID=$(echo "$FIRST_ACCOUNT" | jq -r '.platform_id')
ACCOUNT_NAME=$(echo "$FIRST_ACCOUNT" | jq -r '.account_name')

echo "将使用账号进行测试："
echo "  - 账号ID: $ACCOUNT_ID"
echo "  - 平台: $PLATFORM_ID"
echo "  - 账号名: $ACCOUNT_NAME"
echo ""

# 2. 获取测试文章
echo "=========================================="
echo "2️⃣  获取测试文章"
echo "=========================================="

ARTICLES=$(curl -s "$API_URL/articles?limit=1")
echo "$ARTICLES" | jq '.'

ARTICLE_COUNT=$(echo "$ARTICLES" | jq '.articles | length')

if [ "$ARTICLE_COUNT" -eq 0 ]; then
  echo -e "${RED}❌ 没有找到文章${NC}"
  echo "请先创建至少一篇文章"
  exit 1
fi

ARTICLE=$(echo "$ARTICLES" | jq '.articles[0]')
ARTICLE_ID=$(echo "$ARTICLE" | jq -r '.id')
ARTICLE_TITLE=$(echo "$ARTICLE" | jq -r '.title')

echo ""
echo -e "${GREEN}✅ 找到测试文章${NC}"
echo "  - 文章ID: $ARTICLE_ID"
echo "  - 标题: $ARTICLE_TITLE"
echo ""

# 3. 创建发布任务
echo "=========================================="
echo "3️⃣  创建发布任务"
echo "=========================================="

echo "正在创建发布任务..."
echo "  - 文章: $ARTICLE_TITLE"
echo "  - 平台: $PLATFORM_ID"
echo "  - 账号: $ACCOUNT_NAME"
echo ""

TASK_DATA=$(cat <<EOF
{
  "article_id": $ARTICLE_ID,
  "account_id": $ACCOUNT_ID,
  "platform_id": "$PLATFORM_ID",
  "config": {
    "title": "$ARTICLE_TITLE",
    "category": "科技",
    "tags": ["测试", "自动发布"]
  }
}
EOF
)

TASK_RESPONSE=$(curl -s -X POST "$API_URL/publishing/tasks" \
  -H "Content-Type: application/json" \
  -d "$TASK_DATA")

echo "$TASK_RESPONSE" | jq '.'

TASK_ID=$(echo "$TASK_RESPONSE" | jq -r '.id')

if [ "$TASK_ID" == "null" ] || [ -z "$TASK_ID" ]; then
  echo -e "${RED}❌ 创建发布任务失败${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}✅ 发布任务创建成功${NC}"
echo "  - 任务ID: $TASK_ID"
echo ""

# 4. 查看任务状态
echo "=========================================="
echo "4️⃣  监控任务执行状态"
echo "=========================================="
echo ""

echo "系统正在后台执行发布任务..."
echo "执行流程："
echo "  1. 启动浏览器"
echo "  2. 使用Cookie自动登录 $PLATFORM_ID"
echo "  3. 导航到发布页面"
echo "  4. 填充文章内容"
echo "  5. 自动发布"
echo ""

# 轮询任务状态
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT + 1))
  
  TASK_STATUS=$(curl -s "$API_URL/publishing/tasks/$TASK_ID")
  STATUS=$(echo "$TASK_STATUS" | jq -r '.status')
  
  echo -n "[$ATTEMPT/$MAX_ATTEMPTS] 任务状态: "
  
  case $STATUS in
    "pending")
      echo -e "${YELLOW}等待执行...${NC}"
      ;;
    "running")
      echo -e "${YELLOW}正在执行...${NC}"
      ;;
    "success")
      echo -e "${GREEN}✅ 发布成功！${NC}"
      echo ""
      echo "任务详情："
      echo "$TASK_STATUS" | jq '.'
      echo ""
      echo "=========================================="
      echo -e "${GREEN}🎉 测试完成！自动登录发布功能正常工作${NC}"
      echo "=========================================="
      exit 0
      ;;
    "failed")
      echo -e "${RED}❌ 发布失败${NC}"
      echo ""
      echo "任务详情："
      echo "$TASK_STATUS" | jq '.'
      echo ""
      ERROR_MSG=$(echo "$TASK_STATUS" | jq -r '.error_message')
      echo -e "${RED}错误信息: $ERROR_MSG${NC}"
      echo ""
      
      # 获取任务日志
      echo "任务日志："
      LOGS=$(curl -s "$API_URL/publishing/tasks/$TASK_ID/logs")
      echo "$LOGS" | jq '.'
      
      exit 1
      ;;
    *)
      echo -e "${RED}未知状态: $STATUS${NC}"
      ;;
  esac
  
  sleep 2
done

echo ""
echo -e "${YELLOW}⚠️  任务执行超时（60秒）${NC}"
echo "请检查服务器日志获取更多信息"
echo ""

# 显示最终状态
FINAL_STATUS=$(curl -s "$API_URL/publishing/tasks/$TASK_ID")
echo "最终任务状态："
echo "$FINAL_STATUS" | jq '.'

exit 1
