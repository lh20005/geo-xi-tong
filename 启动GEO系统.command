#!/bin/bash

# 获取脚本所在目录
cd "$(dirname "$0")"

# 设置终端标题
echo -ne "\033]0;GEO优化系统启动器\007"

clear
echo "🌟 GEO优化系统启动器"
echo "================================"
echo ""

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js"
    echo "请先安装 Node.js: https://nodejs.org/"
    echo ""
    read -p "按回车键退出..."
    exit 1
fi

# 检查Homebrew
if ! command -v brew &> /dev/null; then
    echo "❌ 错误: 未找到 Homebrew"
    echo "请先安装 Homebrew: https://brew.sh/"
    echo ""
    read -p "按回车键退出..."
    exit 1
fi

echo "✅ 系统检查通过"
echo ""

# 启动数据库服务
echo "📊 启动数据库服务..."
if ! brew services list | grep postgresql@14 | grep started > /dev/null; then
    echo "🔄 启动 PostgreSQL..."
    brew services start postgresql@14
    sleep 3
else
    echo "✅ PostgreSQL 已运行"
fi

if ! brew services list | grep redis | grep started > /dev/null; then
    echo "🔄 启动 Redis..."
    brew services start redis
    sleep 2
else
    echo "✅ Redis 已运行"
fi

echo "✅ 数据库服务就绪"
echo ""

# 运行数据库迁移
echo "🔄 运行数据库迁移..."
cd server
if npm run db:migrate; then
    echo "✅ 数据库迁移完成"
else
    echo "❌ 数据库迁移失败"
    echo ""
    read -p "按回车键退出..."
    exit 1
fi
cd ..

echo ""
echo "🚀 启动所有应用服务..."
echo ""
echo "📋 服务地址:"
echo "  • 前端应用: http://localhost:5173"
echo "  • 后端API:  http://localhost:3000"
echo "  • 营销网站: http://localhost:8080"
echo "  • Windows管理器: Electron应用"
echo ""
echo "⚠️  重要提示:"
echo "  • 请保持此终端窗口打开"
echo "  • 按 Ctrl+C 可停止所有服务"
echo "  • 关闭此窗口将停止所有服务"
echo ""
echo "================================"
echo ""

# 启动所有服务
npm run dev:all

echo ""
echo "🛑 所有服务已停止"
echo ""
read -p "按回车键退出..."