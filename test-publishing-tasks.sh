#!/bin/bash

echo "=========================================="
echo "发布任务模块测试脚本"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# API基础URL
API_URL="http://localhost:3000/api"

echo -e "${BLUE}1. 检查草稿文章${NC}"
echo "GET $API_URL/articles?publishStatus=unpublished"
DRAFT_RESPONSE=$(curl -s "$API_URL/articles?publishStatus=unpublished")
DRAFT_COUNT=$(echo $DRAFT_RESPONSE | grep -o '"total":[0-9]*' | grep -o '[0-9]*')
echo -e "${GREEN}草稿文章数量: $DRAFT_COUNT${NC}"
echo ""

echo -e "${BLUE}2. 检查已登录平台${NC}"
echo "GET $API_URL/publishing/accounts"
ACCOUNTS_RESPONSE=$(curl -s "$API_URL/publishing/accounts")
echo $ACCOUNTS_RESPONSE | python3 -m json.tool 2>/dev/null || echo $ACCOUNTS_RESPONSE
echo ""

echo -e "${BLUE}3. 检查平台列表${NC}"
echo "GET $API_URL/publishing/platforms"
PLATFORMS_RESPONSE=$(curl -s "$API_URL/publishing/platforms")
echo $PLATFORMS_RESPONSE | python3 -m json.tool 2>/dev/null || echo $PLATFORMS_RESPONSE
echo ""

echo -e "${BLUE}4. 创建测试发布任务${NC}"
echo "提示: 请手动在页面上操作，或使用以下命令创建任务"
echo ""
echo "示例命令:"
echo "curl -X POST $API_URL/publishing/tasks \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{"
echo "    \"article_id\": 1,"
echo "    \"platform_id\": \"toutiao\","
echo "    \"account_id\": 1,"
echo "    \"scheduled_time\": null"
echo "  }'"
echo ""

echo -e "${BLUE}5. 查看发布任务列表${NC}"
echo "GET $API_URL/publishing/tasks"
TASKS_RESPONSE=$(curl -s "$API_URL/publishing/tasks")
echo $TASKS_RESPONSE | python3 -m json.tool 2>/dev/null || echo $TASKS_RESPONSE
echo ""

echo -e "${BLUE}6. 统计信息${NC}"
TASK_COUNT=$(echo $TASKS_RESPONSE | grep -o '"total":[0-9]*' | grep -o '[0-9]*')
echo -e "${GREEN}总任务数: $TASK_COUNT${NC}"
echo ""

echo "=========================================="
echo -e "${GREEN}测试完成！${NC}"
echo "=========================================="
echo ""
echo "访问页面: http://localhost:5173/publishing-tasks"
echo ""
echo -e "${YELLOW}使用提示:${NC}"
echo "1. 确保有草稿文章（在文章管理页面生成）"
echo "2. 确保有已登录平台（在平台登录页面登录）"
echo "3. 在发布任务页面选择文章和平台"
echo "4. 点击创建发布任务按钮"
echo "5. 在任务列表中查看执行状态"
echo ""
