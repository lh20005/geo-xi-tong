#!/bin/bash

echo "🚀 启动Windows平台登录管理器开发环境..."
echo ""

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
  echo "📦 首次运行，正在安装依赖..."
  npm install
  echo ""
fi

# 启动开发服务器
echo "🔧 启动开发服务器..."
npm run electron:dev
