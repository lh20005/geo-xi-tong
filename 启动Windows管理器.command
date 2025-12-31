#!/bin/bash

# Windows 登录管理器 - 独立启动脚本
# 仅启动 Windows 登录管理器，不启动其他服务

cd "$(dirname "$0")"
echo -ne "\033]0;Windows登录管理器\007"

clear
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🪟 Windows 登录管理器"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. 检查环境
echo "🔍 [1/4] 检查环境..."
if ! command -v node &> /dev/null; then
    echo "❌ 未找到 Node.js，请先安装: https://nodejs.org/"
    read -p "按回车键退出..." && exit 1
fi

echo "   ✅ Node.js: $(node -v)"
echo "   ✅ npm: $(npm -v)"
echo ""

# 2. 检查依赖
echo "📦 [2/4] 检查依赖..."
cd windows-login-manager

if [ ! -d "node_modules" ]; then
    echo "   🔄 安装依赖包..."
    npm install
    echo "   ✅ 依赖安装完成"
else
    echo "   ✅ 依赖已安装"
fi
echo ""

# 3. 编译 TypeScript
echo "🔨 [3/4] 编译代码..."

# 检查是否需要编译
NEED_BUILD=false
if [ ! -d "dist-electron" ]; then
    NEED_BUILD=true
    echo "   ℹ️  首次运行，需要编译"
elif [ "electron/main.ts" -nt "dist-electron/main.js" ]; then
    NEED_BUILD=true
    echo "   ℹ️  代码已更新，需要重新编译"
fi

if [ "$NEED_BUILD" = true ]; then
    echo "   🔄 编译主进程..."
    npm run build:electron
    if [ $? -ne 0 ]; then
        echo "   ❌ 编译失败"
        cd ..
        read -p "按回车键退出..." && exit 1
    fi
    echo "   ✅ 编译完成"
else
    echo "   ✅ 代码已是最新"
fi
echo ""

# 4. 启动应用
echo "🚀 [4/4] 启动应用..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 应用信息:"
echo "   • 名称: 平台登录管理器"
echo "   • 版本: 1.0.0"
echo "   • 架构: WebView + Preload"
echo ""
echo "⚠️  操作提示:"
echo "   • 应用将在新窗口中打开"
echo "   • 保持此窗口打开以查看日志"
echo "   • 按 Ctrl+C 停止应用"
echo "   • 关闭应用窗口也会停止服务"
echo ""
echo "🔍 功能说明:"
echo "   • 平台账号管理"
echo "   • 一键登录各大平台"
echo "   • Cookie 和 Storage 管理"
echo "   • 账号状态监控"
echo ""
echo "🆕 WebView 新特性:"
echo "   • 事件驱动的登录检测"
echo "   • 更快的响应速度 (< 10ms)"
echo "   • 更低的 CPU 占用"
echo "   • 更可靠的状态检测"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 启动应用
npm run electron:dev

# 应用关闭后
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🛑 应用已关闭"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "按回车键退出..."
