#!/bin/bash

# 账号API统一测试脚本
# 测试Windows端和网页端是否使用相同的API端点

echo "=========================================="
echo "账号API统一测试"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 重新编译Windows端
echo "步骤1: 重新编译Windows端..."
cd windows-login-manager
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Windows端编译成功${NC}"
else
    echo -e "${RED}✗ Windows端编译失败${NC}"
    exit 1
fi
cd ..
echo ""

# 2. 检查编译后的文件是否使用正确的API端点
echo "步骤2: 验证编译后的API端点..."
if grep -q "/api/publishing/accounts" windows-login-manager/dist-electron/api/client.js; then
    echo -e "${GREEN}✓ 编译后的文件使用正确的API端点 (/api/publishing/accounts)${NC}"
else
    echo -e "${RED}✗ 编译后的文件仍在使用旧的API端点${NC}"
    echo "请检查编译配置"
    exit 1
fi
echo ""

# 3. 检查是否还有旧的API调用
echo "步骤3: 检查是否还有旧的API调用..."
OLD_API_COUNT=$(grep -r "/api/accounts" windows-login-manager/dist-electron/ 2>/dev/null | grep -v "/api/publishing/accounts" | wc -l)
if [ "$OLD_API_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✓ 没有发现旧的API调用${NC}"
else
    echo -e "${YELLOW}⚠ 发现 $OLD_API_COUNT 处旧的API调用${NC}"
    echo "详细信息:"
    grep -r "/api/accounts" windows-login-manager/dist-electron/ | grep -v "/api/publishing/accounts"
fi
echo ""

# 4. 验证源代码
echo "步骤4: 验证源代码..."
if grep -q "/api/publishing/accounts" windows-login-manager/electron/api/client.ts; then
    echo -e "${GREEN}✓ 源代码使用正确的API端点${NC}"
else
    echo -e "${RED}✗ 源代码仍在使用旧的API端点${NC}"
    exit 1
fi
echo ""

# 5. 检查网页端API
echo "步骤5: 检查网页端API配置..."
if grep -q "/publishing/accounts" client/src/api/publishing.ts; then
    echo -e "${GREEN}✓ 网页端使用正确的API端点${NC}"
else
    echo -e "${RED}✗ 网页端API配置有问题${NC}"
    exit 1
fi
echo ""

echo "=========================================="
echo -e "${GREEN}所有检查通过！${NC}"
echo "=========================================="
echo ""
echo "下一步测试建议："
echo "1. 启动服务器: npm start"
echo "2. 启动Windows登录管理器"
echo "3. 打开网页端平台管理页面"
echo "4. 使用Windows端登录一个账号"
echo "5. 观察网页端是否自动更新（无需刷新）"
echo ""
echo "WebSocket事件监听："
echo "在浏览器控制台执行以下代码来监听WebSocket事件："
echo ""
echo "const ws = new WebSocket('ws://localhost:3000/ws');"
echo "ws.onmessage = (event) => {"
echo "  const data = JSON.parse(event.data);"
echo "  if (data.type.startsWith('account.')) {"
echo "    console.log('账号事件:', data);"
echo "  }"
echo "};"
echo ""
