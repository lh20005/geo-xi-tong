#!/bin/bash

echo "=========================================="
echo "文章发布状态管理功能测试"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3001/api"

echo -e "${BLUE}1. 测试获取发布记录列表${NC}"
echo "GET $BASE_URL/publishing/records"
curl -s "$BASE_URL/publishing/records?page=1&pageSize=10" | jq '.'
echo ""
echo "---"
echo ""

echo -e "${BLUE}2. 测试获取发布统计数据${NC}"
echo "GET $BASE_URL/publishing/stats"
curl -s "$BASE_URL/publishing/stats" | jq '.'
echo ""
echo "---"
echo ""

echo -e "${BLUE}3. 测试按平台筛选发布记录${NC}"
echo "GET $BASE_URL/publishing/records?platform_id=toutiao"
curl -s "$BASE_URL/publishing/records?platform_id=toutiao&page=1&pageSize=10" | jq '.'
echo ""
echo "---"
echo ""

echo -e "${BLUE}4. 测试获取文章列表（只显示未发布）${NC}"
echo "GET $BASE_URL/articles?publishStatus=unpublished"
curl -s "$BASE_URL/articles?publishStatus=unpublished&page=1&pageSize=10" | jq '.articles | length'
echo ""
echo "---"
echo ""

echo -e "${BLUE}5. 测试获取文章列表（只显示已发布）${NC}"
echo "GET $BASE_URL/articles?publishStatus=published"
curl -s "$BASE_URL/articles?publishStatus=published&page=1&pageSize=10" | jq '.articles | length'
echo ""
echo "---"
echo ""

echo -e "${GREEN}=========================================="
echo "测试完成！"
echo "==========================================${NC}"
echo ""
echo -e "${YELLOW}提示：${NC}"
echo "1. 确保服务器正在运行（npm run dev）"
echo "2. 确保已执行数据库迁移"
echo "3. 确保有测试数据"
echo ""
echo -e "${YELLOW}前端测试步骤：${NC}"
echo "1. 访问 http://localhost:5173/publishing-tasks"
echo "   - 验证只显示未发布的文章"
echo "2. 创建并执行一个发布任务"
echo "3. 发布成功后，访问 http://localhost:5173/publishing-records"
echo "   - 验证显示新的发布记录"
echo "4. 访问 http://localhost:5173/articles"
echo "   - 验证文章状态变为"已发布""
