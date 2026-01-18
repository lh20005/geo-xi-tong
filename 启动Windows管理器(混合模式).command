#!/bin/bash

# Windows登录管理器 - 混合模式启动脚本
# 本地 Windows 端 + 生产服务器（推荐用于开发测试）
#
# 架构说明：
# - 本地执行：Windows 端、本地 PostgreSQL (geo_windows)、浏览器自动化
# - 服务器执行：用户认证、配额验证、AI生成、订阅管理（连接 jzgeo.cc）
# - 优势：使用真实数据测试，本地修改后同步到服务器

cd "$(dirname "$0")"
echo -ne "\033]0;GEO系统 - 混合模式\007"

clear
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 GEO 系统 - 混合模式启动"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 模式说明："
echo "   • 本地：Windows 端 + PostgreSQL 数据库"
echo "   • 服务器：用户认证 + AI 生成 + 配额管理"
echo "   • 连接到：https://jzgeo.cc"
echo ""

# 清理函数
cleanup() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🛑 正在停止服务..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "✅ 服务已停止"
    echo ""
    read -p "按回车键退出..."
    exit 0
}

# 捕获退出信号
trap cleanup SIGINT SIGTERM EXIT

# 1. 系统检查
echo "🔍 [1/4] 系统环境检查..."
if ! command -v node &> /dev/null; then
    echo "❌ 未找到 Node.js，请先安装: https://nodejs.org/"
    read -p "按回车键退出..." && exit 1
fi

if ! command -v psql &> /dev/null; then
    echo "❌ 未找到 PostgreSQL"
    echo "   请安装 PostgreSQL: https://www.postgresql.org/download/"
    echo "   或使用 Homebrew: brew install postgresql@14"
    read -p "按回车键退出..." && exit 1
fi

echo "   ✅ Node.js: $(node -v)"
echo "   ✅ npm: $(npm -v)"
echo "   ✅ PostgreSQL: $(psql --version | head -n 1)"
echo ""

# 2. 启动 PostgreSQL
echo "🗄️  [2/4] 启动 PostgreSQL 数据库..."

# 检查 PostgreSQL 是否已运行
if pg_isready -h localhost &> /dev/null; then
    echo "   ✅ PostgreSQL 已在运行"
else
    echo "   🔄 启动 PostgreSQL 服务..."
    
    # macOS Homebrew 安装的 PostgreSQL
    if [ -f "/opt/homebrew/bin/brew" ] || [ -f "/usr/local/bin/brew" ]; then
        brew services start postgresql@14 &> /dev/null || brew services start postgresql &> /dev/null
        sleep 2
        
        if pg_isready -h localhost &> /dev/null; then
            echo "   ✅ PostgreSQL 启动成功"
        else
            echo "   ❌ PostgreSQL 启动失败"
            echo "   💡 请手动启动: brew services start postgresql@14"
            read -p "按回车键退出..." && exit 1
        fi
    else
        echo "   ❌ 无法自动启动 PostgreSQL"
        echo "   💡 请手动启动 PostgreSQL 服务"
        read -p "按回车键退出..." && exit 1
    fi
fi
echo ""

# 3. 检查并创建数据库
echo "🗄️  [3/4] 检查 PostgreSQL 数据库..."

# 检查 geo_windows 数据库
if psql -lqt | cut -d \| -f 1 | grep -qw geo_windows; then
    echo "   ✅ 数据库 geo_windows 已存在"
    TABLE_COUNT=$(psql -d geo_windows -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
    echo "   📊 数据库表数量: $TABLE_COUNT"
else
    echo "   🔄 创建数据库 geo_windows..."
    createdb geo_windows
    if [ $? -eq 0 ]; then
        echo "   ✅ 数据库创建成功"
        echo "   💡 首次启动后需要初始化数据库表"
    else
        echo "   ❌ 数据库创建失败"
        read -p "按回车键退出..." && exit 1
    fi
fi
echo ""

# 4. 配置并启动 Windows 管理器
echo "🖥️  [4/4] 启动 Windows 管理器..."

cd windows-login-manager

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "   🔄 安装依赖..."
    npm install
fi

# 配置环境变量（混合模式：本地 Windows 端 + 生产服务器）
cat > .env << 'EOF'
# PostgreSQL 数据库配置（本地）
DB_HOST=localhost
DB_PORT=5432
DB_NAME=geo_windows
DB_USER=lzc
DB_PASSWORD=

# 后端API基础地址（不包含 /api）- 连接到生产服务器
VITE_API_BASE_URL=https://jzgeo.cc

# WebSocket基础地址（包含 /ws 路径）
VITE_WS_BASE_URL=wss://jzgeo.cc/ws

# Landing页面地址
VITE_LANDING_URL=https://jzgeo.cc

# 应用环境
NODE_ENV=development

# 日志级别
LOG_LEVEL=debug
EOF

echo "   ✅ 已配置连接到生产服务器"
echo ""

# 启动信息
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 混合模式配置完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 服务信息:"
echo "   • 本地数据库:  localhost:5432 (geo_windows)"
echo "   • 生产API:     https://jzgeo.cc/api"
echo "   • WebSocket:   wss://jzgeo.cc/ws"
echo "   • Windows端:   http://localhost:5174"
echo ""
echo "📦 本地执行:"
echo "   • 发布任务:   本地 Playwright 执行"
echo "   • 数据存储:   本地 PostgreSQL 数据库"
echo "   • 浏览器:     本地 Chrome/Chromium"
echo ""
echo "☁️  服务器功能:"
echo "   • 用户认证、配额验证、AI生成"
echo "   • 订阅管理、数据同步"
echo ""
echo "🔑 登录账号:"
echo "   • 管理员: admin / admin123"
echo "   • 普通用户: testuser / test123"
echo ""
echo "⚠️  操作提示:"
echo "   • 保持此窗口打开以查看日志"
echo "   • 按 Ctrl+C 停止服务"
echo "   • 使用生产服务器的真实用户数据"
echo "   • 本地修改后可同步到服务器测试"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 启动 Windows 管理器（前台运行）
echo "🚀 正在启动 Windows 管理器..."
echo ""
npm run electron:dev

# 如果 Windows 管理器退出，清理
cleanup
