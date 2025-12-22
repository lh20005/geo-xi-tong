#!/bin/bash

# Windows Platform Login Manager - 系统测试脚本
# 用于自动化测试所有未完成的任务

echo "========================================="
echo "Windows Platform Login Manager"
echo "系统测试脚本"
echo "========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试结果统计
PASSED=0
FAILED=0
SKIPPED=0

# 测试函数
test_pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((PASSED++))
}

test_fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    ((FAILED++))
}

test_skip() {
    echo -e "${YELLOW}⊘ SKIP${NC}: $1"
    ((SKIPPED++))
}

echo "========================================="
echo "Task 3: Checkpoint - Main Process核心模块测试"
echo "========================================="
echo ""

# 测试1.1: 项目结构完整性
echo "测试 1.1: 项目结构完整性"
if [ -d "windows-login-manager/electron" ] && \
   [ -d "windows-login-manager/src" ] && \
   [ -f "windows-login-manager/package.json" ] && \
   [ -f "windows-login-manager/tsconfig.json" ]; then
    test_pass "项目结构完整"
else
    test_fail "项目结构不完整"
fi

# 测试1.2: 依赖安装
echo "测试 1.2: Electron应用依赖安装"
if [ -d "windows-login-manager/node_modules" ]; then
    test_pass "Electron应用依赖已安装"
else
    test_fail "Electron应用依赖未安装"
fi

# 测试1.3: 配置文件
echo "测试 1.3: 配置文件存在"
if [ -f "windows-login-manager/vite.config.ts" ] && \
   [ -f "windows-login-manager/electron/main.ts" ] && \
   [ -f "windows-login-manager/electron/preload.ts" ]; then
    test_pass "所有配置文件存在"
else
    test_fail "配置文件缺失"
fi

echo ""
echo "========================================="
echo "Task 6: Checkpoint - 后端功能完整性测试"
echo "========================================="
echo ""

# 测试6.1: 后端项目结构
echo "测试 6.1: 后端项目结构"
if [ -d "server/src" ] && \
   [ -f "server/package.json" ]; then
    test_pass "后端项目结构完整"
else
    test_fail "后端项目结构不完整"
fi

# 测试6.2: 后端依赖
echo "测试 6.2: 后端关键依赖"
if [ -d "server/node_modules/jsonwebtoken" ] && \
   [ -d "server/node_modules/ws" ]; then
    test_pass "后端关键依赖已安装（jsonwebtoken, ws）"
else
    test_fail "后端关键依赖未安装"
fi

# 测试6.3: 后端API文件
echo "测试 6.3: 后端API文件存在"
if [ -f "server/src/routes/auth.ts" ] && \
   [ -f "server/src/services/WebSocketService.ts" ]; then
    test_pass "后端API文件存在"
else
    test_fail "后端API文件缺失"
fi

echo ""
echo "========================================="
echo "Task 10: Checkpoint - 前后端集成测试"
echo "========================================="
echo ""

# 测试10.1: Web前端项目结构
echo "测试 10.1: Web前端项目结构"
if [ -d "client/src" ] && \
   [ -f "client/package.json" ]; then
    test_pass "Web前端项目结构完整"
else
    test_fail "Web前端项目结构不完整"
fi

# 测试10.2: WebSocket客户端文件
echo "测试 10.2: WebSocket客户端文件"
if [ -f "client/src/services/websocket.ts" ] && \
   [ -f "windows-login-manager/electron/websocket/client.ts" ]; then
    test_pass "WebSocket客户端文件存在"
else
    test_fail "WebSocket客户端文件缺失"
fi

# 测试10.3: Platform Management页面
echo "测试 10.3: Platform Management页面集成"
if [ -f "client/src/pages/PlatformManagementPage.tsx" ]; then
    if grep -q "initializeWebSocket" "client/src/pages/PlatformManagementPage.tsx"; then
        test_pass "Platform Management页面已集成WebSocket"
    else
        test_fail "Platform Management页面未集成WebSocket"
    fi
else
    test_fail "Platform Management页面文件不存在"
fi

echo ""
echo "========================================="
echo "Task 11.3: 平台支持验证测试"
echo "========================================="
echo ""

# 测试11.1: 平台配置文件
echo "测试 11.1: 平台配置文件"
if [ -f "server/src/services/AccountService.ts" ]; then
    test_pass "平台配置服务文件存在"
else
    test_fail "平台配置服务文件不存在"
fi

# 测试11.2: Login Manager文件
echo "测试 11.2: Login Manager文件"
if [ -d "windows-login-manager/electron/login" ]; then
    test_pass "Login Manager目录存在"
else
    test_fail "Login Manager目录不存在"
fi

echo ""
echo "========================================="
echo "文档完整性测试"
echo "========================================="
echo ""

# 测试文档
echo "测试: 文档文件存在"
DOCS_COMPLETE=true
for doc in "README.md" "QUICK_START.md" "BUILD_INSTRUCTIONS.md" "COMPREHENSIVE_TEST_PLAN.md"; do
    if [ -f "windows-login-manager/$doc" ]; then
        echo "  ✓ $doc"
    else
        echo "  ✗ $doc 缺失"
        DOCS_COMPLETE=false
    fi
done

if [ "$DOCS_COMPLETE" = true ]; then
    test_pass "所有文档文件存在"
else
    test_fail "部分文档文件缺失"
fi

echo ""
echo "========================================="
echo "测试结果汇总"
echo "========================================="
echo ""
echo -e "${GREEN}通过: $PASSED${NC}"
echo -e "${RED}失败: $FAILED${NC}"
echo -e "${YELLOW}跳过: $SKIPPED${NC}"
echo "总计: $((PASSED + FAILED + SKIPPED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}========================================="
    echo "所有测试通过！✓"
    echo "=========================================${NC}"
    exit 0
else
    echo -e "${RED}========================================="
    echo "有 $FAILED 个测试失败！✗"
    echo "=========================================${NC}"
    exit 1
fi
