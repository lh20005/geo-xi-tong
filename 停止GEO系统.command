#!/bin/bash

# GEO优化系统 - 停止脚本
# 停止所有后台运行的服务

cd "$(dirname "$0")"
echo -ne "\033]0;停止GEO系统\007"

clear
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🛑 停止GEO优化系统"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. 通过PID文件停止服务
echo "🔍 [1/3] 停止已记录的服务进程..."
STOPPED=0

if [ -f "logs/backend.pid" ]; then
    PID=$(cat logs/backend.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID 2>/dev/null && echo "   ✅ 后端服务已停止 (PID: $PID)" && STOPPED=$((STOPPED+1))
    fi
    rm -f logs/backend.pid
fi

if [ -f "logs/frontend.pid" ]; then
    PID=$(cat logs/frontend.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID 2>/dev/null && echo "   ✅ 前端服务已停止 (PID: $PID)" && STOPPED=$((STOPPED+1))
    fi
    rm -f logs/frontend.pid
fi

if [ -f "logs/landing.pid" ]; then
    PID=$(cat logs/landing.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID 2>/dev/null && echo "   ✅ 营销网站已停止 (PID: $PID)" && STOPPED=$((STOPPED+1))
    fi
    rm -f logs/landing.pid
fi

if [ -f "logs/windows.pid" ]; then
    PID=$(cat logs/windows.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID 2>/dev/null && echo "   ✅ Windows管理器已停止 (PID: $PID)" && STOPPED=$((STOPPED+1))
    fi
    rm -f logs/windows.pid
fi

if [ $STOPPED -eq 0 ]; then
    echo "   ℹ️  未找到运行中的服务进程"
fi
echo ""

# 2. 停止相关进程
echo "🧹 [2/3] 清理相关进程..."
pkill -f "npm run dev" 2>/dev/null && echo "   ✅ npm 进程已清理"
pkill -f "vite" 2>/dev/null && echo "   ✅ vite 进程已清理"
pkill -f "tsx watch" 2>/dev/null && echo "   ✅ tsx 进程已清理"
pkill -f "electron" 2>/dev/null && echo "   ✅ electron 进程已清理"
echo ""

# 3. 释放端口
echo "🔌 [3/3] 释放端口..."
PORTS_FREED=0

if lsof -ti:3000 > /dev/null 2>&1; then
    lsof -ti:3000 | xargs kill -9 2>/dev/null && echo "   ✅ 端口 3000 已释放" && PORTS_FREED=$((PORTS_FREED+1))
fi

if lsof -ti:5173 > /dev/null 2>&1; then
    lsof -ti:5173 | xargs kill -9 2>/dev/null && echo "   ✅ 端口 5173 已释放" && PORTS_FREED=$((PORTS_FREED+1))
fi

if lsof -ti:5174 > /dev/null 2>&1; then
    lsof -ti:5174 | xargs kill -9 2>/dev/null && echo "   ✅ 端口 5174 已释放" && PORTS_FREED=$((PORTS_FREED+1))
fi

if lsof -ti:8080 > /dev/null 2>&1; then
    lsof -ti:8080 | xargs kill -9 2>/dev/null && echo "   ✅ 端口 8080 已释放" && PORTS_FREED=$((PORTS_FREED+1))
fi

if [ $PORTS_FREED -eq 0 ]; then
    echo "   ℹ️  所有端口已空闲"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ GEO系统所有服务已停止"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 提示:"
echo "   • 数据库服务 (PostgreSQL/Redis) 仍在运行"
echo "   • 如需停止数据库，请运行:"
echo "     brew services stop postgresql@14"
echo "     brew services stop redis"
echo ""
echo "🔄 重新启动:"
echo "   双击运行: 启动GEO系统.command"
echo "   或后台运行: 后台启动GEO系统.command"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

sleep 2
echo "窗口将在3秒后自动关闭..."
sleep 3
