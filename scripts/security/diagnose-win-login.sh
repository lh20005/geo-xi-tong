#!/bin/bash

# Windows端登录问题诊断脚本

echo "🔍 Windows端登录问题诊断"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 检查后端服务
echo "1️⃣  检查后端服务..."
if curl -s http://localhost:3000/api/auth/login > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 后端服务正在运行${NC}"
else
    echo -e "${RED}❌ 后端服务未运行${NC}"
    echo "   请先启动后端服务: cd server && npm run dev"
    exit 1
fi
echo ""

# 2. 测试 testuser 登录
echo "2️⃣  测试 testuser 登录..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test123"}')

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ testuser 登录成功${NC}"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
else
    echo -e "${RED}❌ testuser 登录失败${NC}"
    echo "$RESPONSE"
    echo ""
    echo "   可能的原因："
    echo "   1. 用户不存在"
    echo "   2. 密码错误"
    echo "   3. 数据库连接问题"
fi
echo ""

# 3. 检查数据库中的用户
echo "3️⃣  检查数据库中的用户..."
DB_RESULT=$(psql postgresql://lzc@localhost:5432/geo_system -t -c "SELECT id, username, email, role FROM users WHERE username = 'testuser';" 2>&1)

if echo "$DB_RESULT" | grep -q "testuser"; then
    echo -e "${GREEN}✅ testuser 存在于数据库${NC}"
    echo "$DB_RESULT"
else
    echo -e "${RED}❌ testuser 不存在于数据库${NC}"
    echo ""
    echo "   解决方案："
    echo "   运行: psql postgresql://lzc@localhost:5432/geo_system -f create-test-user.sql"
fi
echo ""

# 4. 检查 Windows 端配置文件
echo "4️⃣  检查 Windows 端配置..."
if [ -f "windows-login-manager/.env" ]; then
    echo -e "${GREEN}✅ .env 文件存在${NC}"
    cat windows-login-manager/.env
else
    echo -e "${YELLOW}⚠️  .env 文件不存在${NC}"
    echo "   创建配置文件..."
    cp windows-login-manager/.env.example windows-login-manager/.env
    echo -e "${GREEN}✅ 已创建 .env 文件${NC}"
fi
echo ""

# 5. 测试管理员登录
echo "5️⃣  测试管理员登录（对比）..."
ADMIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

if echo "$ADMIN_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ admin 登录成功${NC}"
else
    echo -e "${RED}❌ admin 登录失败${NC}"
    echo "$ADMIN_RESPONSE"
fi
echo ""

# 总结
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 诊断总结"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ testuser 账号可以正常登录${NC}"
    echo ""
    echo "如果 Windows 端仍然无法登录，请："
    echo "1. 打开 Windows 登录管理器"
    echo "2. 按 Cmd+Option+I (Mac) 或 Ctrl+Shift+I (Windows) 打开开发者工具"
    echo "3. 查看 Console 标签中的错误信息"
    echo "4. 检查设置中的服务器URL是否为: http://localhost:3000"
    echo ""
    echo "详细排查指南: WIN_LOGIN_TROUBLESHOOTING.md"
else
    echo -e "${RED}❌ testuser 账号无法登录${NC}"
    echo ""
    echo "建议操作："
    echo "1. 重新创建用户:"
    echo "   psql postgresql://lzc@localhost:5432/geo_system -f create-test-user.sql"
    echo ""
    echo "2. 查看详细排查指南:"
    echo "   cat WIN_LOGIN_TROUBLESHOOTING.md"
fi
echo ""
