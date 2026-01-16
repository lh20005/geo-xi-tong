#!/bin/bash

# Windows登录管理器 - 连接远程服务器版
# 用于本地调试，连接到生产服务器 jzgeo.cc
#
# 架构说明（PostgreSQL 迁移后）：
# - 本地执行：发布任务、浏览器自动化、文章/知识库/图库/账号存储（PostgreSQL）
# - 服务器执行：用户认证、配额验证、AI生成、订阅管理、数据同步
# - 数据库：Windows 端使用本地 PostgreSQL (geo_windows)，服务器使用 PostgreSQL (geo_system)

cd "$(dirname "$0")"
echo -ne "\033]0;Windows管理器(服务器)\007"

clear
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🖥️  Windows登录管理器 - 连接服务器模式"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. 系统检查
echo "🔍 [1/4] 系统环境检查..."
if ! command -v node &> /dev/null; then
    echo "❌ 未找到 Node.js，请先安装: https://nodejs.org/"
    read -p "按回车键退出..." && exit 1
fi

if ! command -v psql &> /dev/null; then
    echo "⚠️  未找到 PostgreSQL 客户端"
    echo "   请安装 PostgreSQL: https://www.postgresql.org/download/"
    echo "   或使用 Homebrew: brew install postgresql"
    read -p "按回车键继续（如果已安装但未在 PATH 中）..." 
fi

echo "   ✅ Node.js: $(node -v)"
echo "   ✅ npm: $(npm -v)"
if command -v psql &> /dev/null; then
    echo "   ✅ PostgreSQL: $(psql --version | head -n 1)"
fi
echo ""

# 2. 检查 PostgreSQL 数据库
echo "🗄️  [2/4] 检查 PostgreSQL 数据库..."
if command -v psql &> /dev/null; then
    if psql -d geo_windows -c "SELECT 1;" &> /dev/null; then
        echo "   ✅ 数据库 geo_windows 连接成功"
        TABLE_COUNT=$(psql -d geo_windows -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
        echo "   📊 数据库表数量: $TABLE_COUNT"
    else
        echo "   ⚠️  数据库 geo_windows 不存在或无法连接"
        echo "   💡 提示: 运行 'createdb geo_windows' 创建数据库"
        echo "   💡 或运行初始化脚本: cd windows-login-manager && npm run db:init"
        read -p "   按回车键继续..." 
    fi
else
    echo "   ⚠️  跳过数据库检查（PostgreSQL 未安装）"
fi
echo ""
# 3. 检查依赖
echo "📦 [3/4] 检查依赖包..."
cd windows-login-manager
if [ ! -d "node_modules" ]; then
    echo "   🔄 安装依赖包..."
    npm install
fi
echo "   ✅ 依赖检查完成"
echo ""

# 4. 配置环境变量（连接服务器）
echo "⚙️  [4/4] 配置服务器连接..."

# 备份原有 .env（如果存在且不是服务器配置）
if [ -f ".env" ] && ! grep -q "jzgeo.cc" .env; then
    cp .env .env.local.backup
    echo "   📋 已备份本地配置到 .env.local.backup"
fi

# 写入服务器配置（包含 PostgreSQL 配置）
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

echo "   ✅ 已配置连接到: https://jzgeo.cc"
echo "   ✅ 已配置本地数据库: geo_windows"
echo ""

# 5. 启动应用
echo "🚀 启动 Windows 登录管理器..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 连接信息:"
echo "   • 后端API:    https://jzgeo.cc/api"
echo "   • WebSocket:  wss://jzgeo.cc/ws"
echo "   • 本地端口:   http://localhost:5174"
echo ""
echo "🗄️  数据库配置:"
echo "   • 类型:       PostgreSQL"
echo "   • 数据库名:   geo_windows"
echo "   • 用户:       lzc"
echo "   • 主机:       localhost:5432"
echo ""
echo "📦 本地执行（PostgreSQL 迁移后）:"
echo "   • 发布任务:   本地 Playwright 执行"
echo "   • 数据存储:   本地 PostgreSQL 数据库"
echo "   • 浏览器:     本地 Chrome/Chromium"
echo ""
echo "☁️  服务器功能:"
echo "   • 用户认证、配额验证、AI生成"
echo "   • 订阅管理、数据同步"
echo ""
echo "⚠️  操作提示:"
echo "   • 保持此窗口打开以查看日志"
echo "   • 按 Ctrl+C 停止服务"
echo "   • 关闭窗口将停止服务"
echo "   • 首次启动需要初始化数据库"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 启动 Electron 开发模式（通过环境变量传递服务器地址）
API_BASE_URL=https://jzgeo.cc npm run electron:dev

# 服务停止后的清理
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🛑 Windows 登录管理器已停止"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "按回车键退出..."
