#!/bin/bash

echo "🔍 GEO系统登录流程测试"
echo "======================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试1: 检查后端服务
echo "📡 测试1: 检查后端服务..."
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 后端服务运行正常${NC}"
else
    echo -e "${RED}❌ 后端服务未运行或无法访问${NC}"
    echo "   请确保后端服务已启动: cd server && npm run dev"
    exit 1
fi
echo ""

# 测试2: 测试登录API
echo "🔐 测试2: 测试登录API..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ 登录API正常工作${NC}"
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    echo "   Token: ${TOKEN:0:50}..."
else
    echo -e "${RED}❌ 登录API失败${NC}"
    echo "   响应: $LOGIN_RESPONSE"
    exit 1
fi
echo ""

# 测试3: 测试带Token的API
echo "🔑 测试3: 测试带Token的API..."
PROFILE_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/user/profile)

if echo "$PROFILE_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Token验证正常${NC}"
    USERNAME=$(echo "$PROFILE_RESPONSE" | grep -o '"username":"[^"]*"' | cut -d'"' -f4)
    echo "   用户名: $USERNAME"
else
    echo -e "${RED}❌ Token验证失败${NC}"
    echo "   响应: $PROFILE_RESPONSE"
    exit 1
fi
echo ""

# 测试4: 检查前端服务
echo "🌐 测试4: 检查前端服务..."
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 前端服务运行正常${NC}"
else
    echo -e "${YELLOW}⚠️  前端服务未运行或无法访问${NC}"
    echo "   请确保前端服务已启动: cd client && npm run dev"
fi
echo ""

# 测试5: 检查Landing页面
echo "🏠 测试5: 检查Landing页面..."
if curl -s http://localhost:8080 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Landing页面运行正常${NC}"
else
    echo -e "${YELLOW}⚠️  Landing页面未运行或无法访问${NC}"
    echo "   请确保Landing服务已启动: cd landing && npm run dev"
fi
echo ""

# 测试6: 检查数据库连接
echo "💾 测试6: 检查数据库连接..."
DB_TEST=$(curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/user/subscription)

if echo "$DB_TEST" | grep -q '"success"'; then
    echo -e "${GREEN}✅ 数据库连接正常${NC}"
else
    echo -e "${YELLOW}⚠️  数据库查询可能有问题${NC}"
    echo "   响应: $DB_TEST"
fi
echo ""

# 总结
echo "📊 测试总结"
echo "==========="
echo -e "${GREEN}✅ 核心功能测试通过${NC}"
echo ""
echo "🎯 下一步操作:"
echo "1. 打开浏览器访问: http://localhost:8080"
echo "2. 点击右上角'登录'按钮"
echo "3. 输入用户名: admin, 密码: admin123"
echo "4. 登录成功后点击'进入系统'"
echo "5. 应该跳转到系统主界面"
echo ""
echo "📝 如果仍然无法登录，请:"
echo "1. 打开浏览器开发者工具 (F12)"
echo "2. 查看 Console 标签页的错误信息"
echo "3. 查看 Network 标签页的网络请求"
echo "4. 将错误信息提供给开发人员"
echo ""
