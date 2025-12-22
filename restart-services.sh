#!/bin/bash

echo "=========================================="
echo "🔄 重启所有服务"
echo "=========================================="
echo ""

# 查找并停止后端服务
echo "📝 步骤 1: 停止后端服务..."
SERVER_PID=$(lsof -ti:3000)
if [ -n "$SERVER_PID" ]; then
  echo "找到后端进程 PID: $SERVER_PID"
  kill -9 $SERVER_PID 2>/dev/null
  echo "✅ 后端服务已停止"
else
  echo "⚠️  后端服务未运行"
fi

# 查找并停止 Windows 登录管理器
echo ""
echo "📝 步骤 2: 停止 Windows 登录管理器..."
ELECTRON_PID=$(ps aux | grep "windows-login-manager" | grep -v grep | awk '{print $2}')
if [ -n "$ELECTRON_PID" ]; then
  echo "找到 Electron 进程 PID: $ELECTRON_PID"
  kill -9 $ELECTRON_PID 2>/dev/null
  echo "✅ Windows 登录管理器已停止"
else
  echo "⚠️  Windows 登录管理器未运行"
fi

echo ""
echo "⏳ 等待 2 秒确保端口释放..."
sleep 2

echo ""
echo "=========================================="
echo "🚀 启动服务"
echo "=========================================="
echo ""

echo "📝 步骤 3: 启动后端服务..."
echo "命令: cd server && npm run dev"
echo ""
echo "📝 步骤 4: 启动 Windows 登录管理器..."
echo "命令: cd windows-login-manager && npm run dev"
echo ""

echo "=========================================="
echo "⚠️  请手动执行以下命令："
echo "=========================================="
echo ""
echo "# 终端 1 - 启动后端"
echo "cd server && npm run dev"
echo ""
echo "# 终端 2 - 启动 Windows 登录管理器"
echo "cd windows-login-manager && npm run dev"
echo ""
echo "=========================================="
echo "💡 提示："
echo "=========================================="
echo ""
echo "1. 打开两个终端窗口"
echo "2. 在第一个终端运行后端服务"
echo "3. 在第二个终端运行 Windows 登录管理器"
echo "4. 等待服务完全启动后再测试"
echo ""
echo "=========================================="
