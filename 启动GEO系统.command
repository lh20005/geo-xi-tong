#!/bin/bash

# GEO优化系统 - 前台启动脚本
# 适用于开发调试，所有服务在前台运行，可以看到实时日志

cd "$(dirname "$0")"
echo -ne "\033]0;GEO优化系统\007"

clear
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌟 GEO优化系统 - 前台启动"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. 系统检查
echo "🔍 [1/5] 系统环境检查..."
if ! command -v node &> /dev/null; then
    echo "❌ 未找到 Node.js，请先安装: https://nodejs.org/"
    read -p "按回车键退出..." && exit 1
fi

if ! command -v brew &> /dev/null; then
    echo "❌ 未找到 Homebrew，请先安装: https://brew.sh/"
    read -p "按回车键退出..." && exit 1
fi

echo "   ✅ Node.js: $(node -v)"
echo "   ✅ npm: $(npm -v)"
echo "   ✅ Homebrew: 已安装"
echo ""

# 2. 启动数据库
echo "🗄️  [2/5] 启动数据库服务..."
if ! brew services list | grep postgresql@14 | grep started > /dev/null; then
    echo "   🔄 启动 PostgreSQL..."
    brew services start postgresql@14
    sleep 3
else
    echo "   ✅ PostgreSQL 已运行"
fi

if ! brew services list | grep redis | grep started > /dev/null; then
    echo "   🔄 启动 Redis..."
    brew services start redis
    sleep 2
else
    echo "   ✅ Redis 已运行"
fi
echo ""

# 3. 数据库迁移
echo "🔄 [3/5] 数据库迁移..."
cd server
if npm run db:migrate > /dev/null 2>&1; then
    echo "   ✅ 数据库迁移完成"
else
    echo "   ⚠️  数据库迁移失败（可能已是最新）"
fi
cd ..
echo ""

# 4. 检查依赖
echo "📦 [4/5] 检查依赖包..."
NEED_INSTALL=false
for dir in server client landing windows-login-manager; do
    if [ ! -d "$dir/node_modules" ]; then
        echo "   ⚠️  $dir 缺少依赖"
        NEED_INSTALL=true
    fi
done

if [ "$NEED_INSTALL" = true ]; then
    echo "   🔄 安装依赖包..."
    npm run install:all
fi

# 检查并安装Playwright浏览器
echo "   🔍 检查 Playwright 浏览器..."
cd server
if ! npx playwright install --dry-run chromium > /dev/null 2>&1; then
    echo "   🔄 安装 Playwright 浏览器（首次运行需要）..."
    npx playwright install chromium
    echo "   ✅ Playwright 浏览器安装完成"
else
    echo "   ✅ Playwright 浏览器已安装"
fi
cd ..

echo "   ✅ 依赖检查完成"
echo ""

# 5. 启动服务
echo "🚀 [5/5] 启动应用服务..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 服务地址:"
echo "   • 网页前端:      http://localhost:5173"
echo "   • 后端API:       http://localhost:3000"
echo "   • 营销网站:      http://localhost:8080"
echo "   • Windows管理器: Electron应用"
echo ""
echo "⚠️  操作提示:"
echo "   • 保持此窗口打开以查看日志"
echo "   • 按 Ctrl+C 停止所有服务"
echo "   • 关闭窗口将停止所有服务"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 启动所有服务
npm run dev:all

# 服务停止后的清理
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🛑 所有服务已停止"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "按回车键退出..."
