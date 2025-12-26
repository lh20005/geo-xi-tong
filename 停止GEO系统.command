#!/bin/bash

# 获取脚本所在目录
cd "$(dirname "$0")"

# 设置终端标题
echo -ne "\033]0;停止GEO系统\007"

clear
echo "🛑 停止GEO优化系统"
echo "================================"
echo ""

echo "📱 停止应用服务..."
# 停止Node.js相关进程
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "npm run electron:dev" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
pkill -f "tsx watch" 2>/dev/null || true

echo "🔌 停止端口服务..."
# 停止特定端口的进程
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
lsof -ti:5174 | xargs kill -9 2>/dev/null || true
lsof -ti:8080 | xargs kill -9 2>/dev/null || true

echo ""
echo "✅ 所有GEO系统服务已停止"
echo ""
echo "💡 提示: 数据库服务(PostgreSQL/Redis)仍在运行"
echo "   如需停止数据库服务，请运行:"
echo "   brew services stop postgresql@14"
echo "   brew services stop redis"
echo ""

sleep 2
echo "窗口将在3秒后自动关闭..."
sleep 3