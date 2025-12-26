#!/bin/bash

# 验证修复脚本

echo "🔧 验证 Windows 端登录修复"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. 检查修改是否已应用
echo "1️⃣  检查代码修改..."

if grep -q "initializeAPIClient" windows-login-manager/electron/ipc/handler.ts; then
    echo -e "${GREEN}✅ initializeAPIClient 方法已添加${NC}"
else
    echo -e "${RED}❌ initializeAPIClient 方法未找到${NC}"
    exit 1
fi

if grep -q "await ipcHandler.registerHandlers()" windows-login-manager/electron/main.ts; then
    echo -e "${GREEN}✅ main.ts 已更新为异步调用${NC}"
else
    echo -e "${RED}❌ main.ts 未更新${NC}"
    exit 1
fi

echo ""

# 2. 检查后端服务
echo "2️⃣  检查后端服务..."
if curl -s http://localhost:3000/api/auth/login > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 后端服务正在运行${NC}"
else
    echo -e "${RED}❌ 后端服务未运行${NC}"
    echo "   请先启动: cd server && npm run dev"
    exit 1
fi

echo ""

# 3. 测试 API 登录
echo "3️⃣  测试 testuser API 登录..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test123"}')

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ testuser API 登录成功${NC}"
else
    echo -e "${RED}❌ testuser API 登录失败${NC}"
    echo "$RESPONSE"
    exit 1
fi

echo ""

# 4. 检查 TypeScript 编译
echo "4️⃣  检查 TypeScript 编译..."
cd windows-login-manager

if [ -f "dist-electron/ipc/handler.js" ]; then
    echo -e "${YELLOW}⚠️  发现旧的编译文件，建议清理${NC}"
    echo "   运行: rm -rf dist-electron"
fi

echo ""

# 总结
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 验证结果"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✅ 代码修复已应用${NC}"
echo -e "${GREEN}✅ 后端服务正常${NC}"
echo -e "${GREEN}✅ API 登录正常${NC}"
echo ""
echo "🚀 下一步操作："
echo ""
echo "1. 清理旧的编译文件（推荐）："
echo "   cd windows-login-manager"
echo "   rm -rf dist-electron"
echo ""
echo "2. 重新启动 Windows 登录管理器："
echo "   npm run dev"
echo ""
echo "3. 测试登录："
echo "   用户名: testuser"
echo "   密码: test123"
echo ""
echo "4. 查看开发者工具 Console，应该看到："
echo "   - API client initialized with baseURL: http://localhost:3000"
echo "   - IPC: login - testuser"
echo "   - Login successful"
echo ""
echo "详细说明: WIN_LOGIN_FIX_APPLIED.md"
echo ""
