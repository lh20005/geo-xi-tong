#!/bin/bash

# 创建测试用户脚本
# 用于快速创建普通用户账号进行权限测试

echo "🚀 创建测试用户..."
echo ""

# 检查是否安装了 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误：未找到 Node.js"
    echo "请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

# 检查是否安装了依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
    echo ""
fi

# 运行创建用户脚本
node create-test-user.js
