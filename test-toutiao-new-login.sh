#!/bin/bash

# 测试新的头条登录器
# 这个脚本用于验证重写后的头条登录管理器

echo "=========================================="
echo "测试新的头条登录器"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 检查服务状态
echo "1. 检查服务状态..."
echo ""

# 检查后端服务
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} 后端服务运行正常 (http://localhost:3000)"
else
    echo -e "${RED}✗${NC} 后端服务未运行"
    echo "   请先启动后端服务: cd server && npm run dev"
    exit 1
fi

# 检查网页前端
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} 网页前端运行正常 (http://localhost:5173)"
else
    echo -e "${YELLOW}!${NC} 网页前端未运行 (可选)"
fi

echo ""

# 2. 检查数据库配置
echo "2. 检查数据库配置..."
echo ""

# 检查头条平台配置
PLATFORM_CONFIG=$(curl -s http://localhost:3000/api/platforms | jq -r '.[] | select(.platform_id == "toutiao")')

if [ -z "$PLATFORM_CONFIG" ]; then
    echo -e "${RED}✗${NC} 头条平台配置不存在"
    echo "   请运行数据库迁移"
    exit 1
fi

echo -e "${GREEN}✓${NC} 头条平台配置存在"

# 检查 selectors 配置
HAS_SELECTORS=$(echo "$PLATFORM_CONFIG" | jq -r '.selectors')
if [ "$HAS_SELECTORS" != "null" ]; then
    echo -e "${GREEN}✓${NC} selectors 配置存在"
    
    # 检查 successUrls
    HAS_SUCCESS_URLS=$(echo "$PLATFORM_CONFIG" | jq -r '.selectors.successUrls')
    if [ "$HAS_SUCCESS_URLS" != "null" ]; then
        echo -e "${GREEN}✓${NC} successUrls 配置存在"
        echo "   URL 模式: $(echo "$PLATFORM_CONFIG" | jq -r '.selectors.successUrls | join(", ")')"
    else
        echo -e "${YELLOW}!${NC} successUrls 配置缺失（新登录器不依赖此配置）"
    fi
else
    echo -e "${YELLOW}!${NC} selectors 配置缺失（新登录器使用内置配置）"
fi

echo ""

# 3. 编译 TypeScript
echo "3. 编译 TypeScript..."
echo ""

cd windows-login-manager

# 检查是否需要编译
if [ ! -f "dist-electron/login/toutiao-login-manager.js" ] || [ "electron/login/toutiao-login-manager.ts" -nt "dist-electron/login/toutiao-login-manager.js" ]; then
    echo "正在编译..."
    npm run build:electron > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} TypeScript 编译成功"
    else
        echo -e "${RED}✗${NC} TypeScript 编译失败"
        echo "   请检查编译错误"
        exit 1
    fi
else
    echo -e "${GREEN}✓${NC} TypeScript 已是最新"
fi

cd ..

echo ""

# 4. 测试说明
echo "=========================================="
echo "准备测试"
echo "=========================================="
echo ""

echo "新的头条登录器特点："
echo ""
echo "1. ${GREEN}独立实现${NC} - 不依赖通用登录管理器"
echo "2. ${GREEN}简单可靠${NC} - 使用 BrowserWindow 而非 BrowserView"
echo "3. ${GREEN}URL 检测${NC} - 检测 URL 变化到成功页面"
echo "4. ${GREEN}完整日志${NC} - 详细记录每个步骤"
echo "5. ${GREEN}错误处理${NC} - 完善的错误处理和资源清理"
echo ""

echo "测试步骤："
echo ""
echo "1. 启动 Windows 登录管理器"
echo "   ${YELLOW}cd windows-login-manager && npm run electron:dev${NC}"
echo ""
echo "2. 在应用中点击 '平台管理' -> '头条号' -> '登录'"
echo ""
echo "3. 在弹出的登录窗口中完成登录"
echo ""
echo "4. 观察日志输出，应该看到："
echo "   ${GREEN}[Toutiao] 开始登录流程${NC}"
echo "   ${GREEN}[Toutiao] 创建登录窗口${NC}"
echo "   ${GREEN}[Toutiao] 登录页面加载完成${NC}"
echo "   ${GREEN}[Toutiao] 等待登录成功...${NC}"
echo "   ${GREEN}[Toutiao] 登录成功检测到 URL: ...${NC}"
echo "   ${GREEN}[Toutiao] 用户信息提取成功: ...${NC}"
echo "   ${GREEN}[Toutiao] 捕获登录凭证...${NC}"
echo "   ${GREEN}[Toutiao] 保存账号到本地...${NC}"
echo "   ${GREEN}[Toutiao] 同步账号到后端...${NC}"
echo "   ${GREEN}[Toutiao] 登录成功完成${NC}"
echo ""
echo "5. 验证结果："
echo "   - 应用显示 '登录成功'"
echo "   - 账号出现在账号列表中"
echo "   - 网页端自动更新（如果运行）"
echo ""

echo "=========================================="
echo "开始测试"
echo "=========================================="
echo ""

# 询问是否启动 Windows 客户端
read -p "是否现在启动 Windows 登录管理器？(y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "启动 Windows 登录管理器..."
    cd windows-login-manager
    npm run electron:dev
else
    echo ""
    echo "请手动启动 Windows 登录管理器："
    echo "${YELLOW}cd windows-login-manager && npm run electron:dev${NC}"
fi

echo ""
echo "测试完成后，请报告结果！"
