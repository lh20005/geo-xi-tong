#!/bin/bash

# 重启前端开发服务器
# 用于在修改 .env 文件后重新加载环境变量

cd "$(dirname "$0")"

echo "🔍 查找前端进程..."
PIDS=$(lsof -ti:5173)

if [ -z "$PIDS" ]; then
    echo "❌ 未找到运行在端口 5173 的进程"
else
    echo "🛑 停止前端进程: $PIDS"
    kill -9 $PIDS
    sleep 2
fi

echo "🚀 启动前端开发服务器..."
cd client
npm run dev

echo "✅ 前端服务器已启动在 http://localhost:5173"
