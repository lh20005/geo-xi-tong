#!/bin/bash

# 重启 Windows 登录管理器脚本

echo "🔄 重启 Windows 登录管理器"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. 清理旧的编译文件
echo "1️⃣  清理旧的编译文件..."
cd windows-login-manager
rm -rf dist-electron
echo -e "${GREEN}✅ 清理完成${NC}"
echo ""

# 2. 提示用户
echo "2️⃣  准备启动应用..."
echo ""
echo -e "${YELLOW}⚠️  请注意：${NC}"
echo "   - 应用将在开发模式下启动"
echo "   - 会自动打开开发者工具"
echo "   - 请查看 Console 标签中的日志"
echo ""
echo "3️⃣  启动应用..."
echo ""
echo -e "${GREEN}运行命令: npm run dev${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 测试步骤："
echo ""
echo "1. 等待应用窗口打开"
echo "2. 输入测试账号："
echo "   用户名: testuser"
echo "   密码: test123"
echo ""
echo "3. 点击登录"
echo ""
echo "4. 查看 Console 日志，应该看到："
echo "   ✅ API client initialized with baseURL: http://localhost:3000"
echo "   ✅ IPC: login - testuser"
echo "   ✅ Login successful"
echo ""
echo "5. 验证权限："
echo "   ✅ 左侧菜单不显示'设置'选项"
echo "   ✅ 访问 /settings 会被重定向"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 启动应用
npm run dev
