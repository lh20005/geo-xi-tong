#!/bin/bash

echo "=========================================="
echo "文章发布状态管理系统 - 完整验证"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3000/api"
FRONTEND_URL="http://localhost:5173"

echo -e "${BLUE}=== 1. 数据库验证 ===${NC}"
echo ""

echo "检查 publishing_records 表..."
psql -U lzc -d geo_system -c "\d publishing_records" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ publishing_records 表存在${NC}"
else
    echo -e "${RED}✗ publishing_records 表不存在${NC}"
    exit 1
fi

echo "检查 articles 表字段..."
result=$(psql -U lzc -d geo_system -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'articles' AND column_name IN ('is_published', 'published_at');")
if [ "$result" -eq 2 ]; then
    echo -e "${GREEN}✓ articles 表字段完整 (is_published, published_at)${NC}"
else
    echo -e "${RED}✗ articles 表字段缺失${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}=== 2. 后端API验证 ===${NC}"
echo ""

echo "测试发布记录列表 API..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/publishing/records")
if [ "$response" = "200" ]; then
    echo -e "${GREEN}✓ GET /api/publishing/records - 200 OK${NC}"
    data=$(curl -s "$BASE_URL/publishing/records")
    echo "   响应: $data"
else
    echo -e "${RED}✗ GET /api/publishing/records - $response${NC}"
fi

echo ""
echo "测试发布统计 API..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/publishing/stats")
if [ "$response" = "200" ]; then
    echo -e "${GREEN}✓ GET /api/publishing/stats - 200 OK${NC}"
    data=$(curl -s "$BASE_URL/publishing/stats")
    echo "   响应: $data"
else
    echo -e "${RED}✗ GET /api/publishing/stats - $response${NC}"
fi

echo ""
echo "测试文章列表 API (未发布)..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/articles?publishStatus=unpublished&page=1&pageSize=5")
if [ "$response" = "200" ]; then
    echo -e "${GREEN}✓ GET /api/articles?publishStatus=unpublished - 200 OK${NC}"
    count=$(curl -s "$BASE_URL/articles?publishStatus=unpublished&page=1&pageSize=5" | jq -r '.total')
    echo "   未发布文章数: $count"
else
    echo -e "${RED}✗ GET /api/articles?publishStatus=unpublished - $response${NC}"
fi

echo ""
echo "测试文章列表 API (已发布)..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/articles?publishStatus=published&page=1&pageSize=5")
if [ "$response" = "200" ]; then
    echo -e "${GREEN}✓ GET /api/articles?publishStatus=published - 200 OK${NC}"
    count=$(curl -s "$BASE_URL/articles?publishStatus=published&page=1&pageSize=5" | jq -r '.total')
    echo "   已发布文章数: $count"
else
    echo -e "${RED}✗ GET /api/articles?publishStatus=published - $response${NC}"
fi

echo ""
echo -e "${BLUE}=== 3. 前端页面验证 ===${NC}"
echo ""

echo "检查前端服务..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")
if [ "$response" = "200" ]; then
    echo -e "${GREEN}✓ 前端服务运行正常${NC}"
else
    echo -e "${YELLOW}⚠ 前端服务响应码: $response${NC}"
fi

echo ""
echo -e "${BLUE}=== 4. 数据统计 ===${NC}"
echo ""

# 获取统计数据
total_articles=$(psql -U lzc -d geo_system -t -c "SELECT COUNT(*) FROM articles;")
published_articles=$(psql -U lzc -d geo_system -t -c "SELECT COUNT(*) FROM articles WHERE is_published = true;")
unpublished_articles=$(psql -U lzc -d geo_system -t -c "SELECT COUNT(*) FROM articles WHERE is_published = false;")
total_records=$(psql -U lzc -d geo_system -t -c "SELECT COUNT(*) FROM publishing_records;")
total_tasks=$(psql -U lzc -d geo_system -t -c "SELECT COUNT(*) FROM publishing_tasks;")

echo "文章统计:"
echo "  - 总文章数: $total_articles"
echo "  - 已发布: $published_articles"
echo "  - 未发布: $unpublished_articles"
echo ""
echo "发布统计:"
echo "  - 发布记录数: $total_records"
echo "  - 发布任务数: $total_tasks"

echo ""
echo -e "${GREEN}=========================================="
echo "验证完成！"
echo "==========================================${NC}"
echo ""
echo -e "${YELLOW}访问以下页面测试功能：${NC}"
echo ""
echo "1. 发布任务页面:"
echo "   ${FRONTEND_URL}/publishing-tasks"
echo "   - 应该只显示未发布的文章"
echo ""
echo "2. 发布记录页面:"
echo "   ${FRONTEND_URL}/publishing-records"
echo "   - 显示统计数据和发布记录"
echo ""
echo "3. 文章管理页面:"
echo "   ${FRONTEND_URL}/articles"
echo "   - 显示文章发布状态"
echo ""
echo -e "${YELLOW}测试流程：${NC}"
echo "1. 在发布任务页面选择文章和平台"
echo "2. 创建并执行发布任务"
echo "3. 发布成功后，检查："
echo "   - 文章从发布任务页面消失"
echo "   - 发布记录页面显示新记录"
echo "   - 文章管理页面状态变为'已发布'"
echo ""
