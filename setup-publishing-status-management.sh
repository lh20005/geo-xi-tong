#!/bin/bash

echo "=========================================="
echo "文章发布状态管理功能 - 安装脚本"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查是否在项目根目录
if [ ! -d "server" ] || [ ! -d "client" ]; then
    echo -e "${RED}错误：请在项目根目录执行此脚本${NC}"
    exit 1
fi

echo -e "${BLUE}步骤 1/3: 执行数据库迁移${NC}"
echo "---"
cd server
npx ts-node src/db/migrate-publishing-records.ts

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 数据库迁移成功${NC}"
else
    echo -e "${RED}✗ 数据库迁移失败${NC}"
    exit 1
fi
echo ""

cd ..

echo -e "${BLUE}步骤 2/3: 验证数据库表${NC}"
echo "---"
echo "检查 publishing_records 表..."
psql -U postgres -d geo_optimization -c "\d publishing_records" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ publishing_records 表存在${NC}"
else
    echo -e "${YELLOW}⚠ 无法验证表（可能需要手动检查）${NC}"
fi
echo ""

echo -e "${BLUE}步骤 3/3: 测试 API 接口${NC}"
echo "---"
echo "请确保服务器正在运行..."
sleep 2

# 测试发布记录 API
echo "测试 GET /api/publishing/records..."
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/publishing/records)

if [ "$response" = "200" ]; then
    echo -e "${GREEN}✓ 发布记录 API 正常${NC}"
else
    echo -e "${YELLOW}⚠ API 响应码: $response（服务器可能未启动）${NC}"
fi

echo "测试 GET /api/publishing/stats..."
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/publishing/stats)

if [ "$response" = "200" ]; then
    echo -e "${GREEN}✓ 发布统计 API 正常${NC}"
else
    echo -e "${YELLOW}⚠ API 响应码: $response（服务器可能未启动）${NC}"
fi
echo ""

echo -e "${GREEN}=========================================="
echo "安装完成！"
echo "==========================================${NC}"
echo ""
echo -e "${YELLOW}下一步操作：${NC}"
echo ""
echo "1. 如果服务器未运行，请启动："
echo "   cd server && npm run dev"
echo ""
echo "2. 启动前端（新终端）："
echo "   cd client && npm run dev"
echo ""
echo "3. 访问以下页面测试功能："
echo "   - 发布任务: http://localhost:5173/publishing-tasks"
echo "   - 发布记录: http://localhost:5173/publishing-records"
echo "   - 文章管理: http://localhost:5173/articles"
echo ""
echo "4. 运行完整测试："
echo "   ./test-publishing-status-management.sh"
echo ""
echo -e "${YELLOW}详细使用说明请查看：${NC}"
echo "   文章发布状态管理-使用指南.md"
echo ""
