#!/bin/bash

# GEO优化系统 - 服务状态检查脚本

cd "$(dirname "$0")"
echo -ne "\033]0;GEO系统状态\007"

clear
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 GEO优化系统 - 服务状态检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 检查数据库服务
echo "🗄️  数据库服务:"
if brew services list | grep postgresql@14 | grep started > /dev/null; then
    echo "   ✅ PostgreSQL: 运行中"
else
    echo "   ❌ PostgreSQL: 未运行"
fi

if brew services list | grep redis | grep started > /dev/null; then
    echo "   ✅ Redis: 运行中"
else
    echo "   ❌ Redis: 未运行"
fi
echo ""

# 检查应用服务
echo "🚀 应用服务:"

# 后端服务
if [ -f "logs/backend.pid" ]; then
    PID=$(cat logs/backend.pid)
    if kill -0 $PID 2>/dev/null; then
        if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
            echo "   ✅ 后端服务: 运行中 (PID: $PID, http://localhost:3000)"
        else
            echo "   ⚠️  后端服务: 进程存在但未响应 (PID: $PID)"
        fi
    else
        echo "   ❌ 后端服务: 未运行 (PID文件存在但进程不存在)"
    fi
elif lsof -ti:3000 > /dev/null 2>&1; then
    echo "   ⚠️  后端服务: 端口3000被占用但无PID记录"
else
    echo "   ❌ 后端服务: 未运行"
fi

# 前端服务
if [ -f "logs/frontend.pid" ]; then
    PID=$(cat logs/frontend.pid)
    if kill -0 $PID 2>/dev/null; then
        if curl -s http://localhost:5173 > /dev/null 2>&1; then
            echo "   ✅ 前端服务: 运行中 (PID: $PID, http://localhost:5173)"
        else
            echo "   ⚠️  前端服务: 进程存在但未响应 (PID: $PID)"
        fi
    else
        echo "   ❌ 前端服务: 未运行 (PID文件存在但进程不存在)"
    fi
elif lsof -ti:5173 > /dev/null 2>&1; then
    echo "   ⚠️  前端服务: 端口5173被占用但无PID记录"
else
    echo "   ❌ 前端服务: 未运行"
fi

# 营销网站
if [ -f "logs/landing.pid" ]; then
    PID=$(cat logs/landing.pid)
    if kill -0 $PID 2>/dev/null; then
        if curl -s http://localhost:8080 > /dev/null 2>&1; then
            echo "   ✅ 营销网站: 运行中 (PID: $PID, http://localhost:8080)"
        else
            echo "   ⚠️  营销网站: 进程存在但未响应 (PID: $PID)"
        fi
    else
        echo "   ❌ 营销网站: 未运行 (PID文件存在但进程不存在)"
    fi
elif lsof -ti:8080 > /dev/null 2>&1; then
    echo "   ⚠️  营销网站: 端口8080被占用但无PID记录"
else
    echo "   ❌ 营销网站: 未运行"
fi

# Windows管理器
if [ -f "logs/windows.pid" ]; then
    PID=$(cat logs/windows.pid)
    if kill -0 $PID 2>/dev/null; then
        echo "   ✅ Windows管理器: 运行中 (PID: $PID)"
    else
        echo "   ❌ Windows管理器: 未运行 (PID文件存在但进程不存在)"
    fi
else
    if pgrep -f "electron" > /dev/null 2>&1; then
        echo "   ⚠️  Windows管理器: Electron进程存在但无PID记录"
    else
        echo "   ❌ Windows管理器: 未运行"
    fi
fi
echo ""

# 端口占用情况
echo "🔌 端口占用:"
for port in 3000 5173 8080; do
    if lsof -ti:$port > /dev/null 2>&1; then
        PID=$(lsof -ti:$port)
        PROCESS=$(ps -p $PID -o comm= 2>/dev/null || echo "未知")
        echo "   • 端口 $port: 被占用 (PID: $PID, 进程: $PROCESS)"
    else
        echo "   • 端口 $port: 空闲"
    fi
done
echo ""

# 日志文件
echo "📝 日志文件:"
if [ -d "logs" ]; then
    for log in backend frontend landing windows; do
        if [ -f "logs/$log.log" ]; then
            SIZE=$(du -h "logs/$log.log" | cut -f1)
            LINES=$(wc -l < "logs/$log.log")
            echo "   • $log.log: $SIZE ($LINES 行)"
        fi
    done
else
    echo "   ℹ️  日志目录不存在"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 操作提示:"
echo "   • 启动服务: 双击 '启动GEO系统.command'"
echo "   • 后台启动: 双击 '后台启动GEO系统.command'"
echo "   • 停止服务: 双击 '停止GEO系统.command'"
echo "   • 查看日志: tail -f logs/backend.log"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

read -p "按回车键退出..."
