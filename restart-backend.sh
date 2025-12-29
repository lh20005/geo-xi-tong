#!/bin/bash

echo "🔄 重启后端服务..."

# 停止现有的后端进程
echo "停止现有进程..."
pkill -f "tsx watch src/index.ts"
pkill -f "node.*server/src/index"
sleep 2

# 启动后端
echo "启动后端服务..."
cd server
npm run dev &
BACKEND_PID=$!

echo "后端进程 PID: $BACKEND_PID"
echo ""
echo "等待服务启动..."
sleep 5

# 检查服务状态
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ 后端服务启动成功"
    echo ""
    echo "📋 服务地址:"
    echo "  • 后端 API: http://localhost:3000"
    echo "  • ngrok: https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev"
else
    echo "❌ 后端服务启动失败"
    echo "请检查终端输出的错误信息"
fi
