#!/bin/bash

echo "======================================"
echo "平台登录功能测试脚本"
echo "======================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# API基础URL
API_URL="http://localhost:3001/api/publishing"

echo -e "${BLUE}1. 测试获取平台列表${NC}"
echo "GET $API_URL/platforms"
curl -s "$API_URL/platforms" | jq '.'
echo ""
echo "---"
echo ""

echo -e "${BLUE}2. 测试获取账号列表${NC}"
echo "GET $API_URL/accounts"
curl -s "$API_URL/accounts" | jq '.'
echo ""
echo "---"
echo ""

echo -e "${YELLOW}提示：浏览器登录功能需要在前端页面测试${NC}"
echo ""
echo "测试步骤："
echo "1. 打开浏览器访问: http://localhost:3000"
echo "2. 点击左侧菜单的【平台登录】"
echo "3. 点击任意平台卡片（如：知乎、简书等）"
echo "4. 系统会自动打开浏览器窗口"
echo "5. 在浏览器中输入账号密码登录"
echo "6. 登录成功后，浏览器会自动关闭"
echo "7. 返回页面查看下方表格，应该显示新增的账号"
echo ""
echo "---"
echo ""

echo -e "${BLUE}3. 查看数据库中的账号信息${NC}"
echo "如果使用PostgreSQL，可以执行："
echo "psql -d your_database -c 'SELECT id, platform_id, account_name, status, is_default, created_at FROM platform_accounts;'"
echo ""

echo -e "${GREEN}测试完成！${NC}"
echo ""
echo "注意事项："
echo "- 确保后端服务已启动 (npm run dev 在 server 目录)"
echo "- 确保前端服务已启动 (npm start 在 client 目录)"
echo "- 确保已安装 Puppeteer 依赖"
echo "- 浏览器登录超时时间为5分钟"
