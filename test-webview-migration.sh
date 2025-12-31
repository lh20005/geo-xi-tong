#!/bin/bash

# WebView 迁移测试脚本
# 用于快速测试 WebView 迁移后的功能

echo "========================================="
echo "  WebView 迁移测试脚本"
echo "========================================="
echo ""

# 检查是否在正确的目录
if [ ! -d "windows-login-manager" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    exit 1
fi

echo "✅ 目录检查通过"
echo ""

# 进入 windows-login-manager 目录
cd windows-login-manager

echo "📦 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "⚠️  未找到 node_modules，正在安装依赖..."
    npm install
else
    echo "✅ 依赖已安装"
fi
echo ""

echo "🔨 编译 TypeScript..."
echo "  - 编译主进程代码..."
npx tsc -p electron/tsconfig.json
if [ $? -ne 0 ]; then
    echo "❌ 主进程编译失败"
    exit 1
fi
echo "  ✅ 主进程编译成功"

echo "  - 编译 Preload 脚本..."
npx tsc -p electron/preload/tsconfig.json
if [ $? -ne 0 ]; then
    echo "❌ Preload 脚本编译失败"
    exit 1
fi
echo "  ✅ Preload 脚本编译成功"
echo ""

echo "✅ 所有编译完成！"
echo ""

echo "========================================="
echo "  准备启动应用"
echo "========================================="
echo ""
echo "📋 测试清单:"
echo "  1. WebView 窗口是否正常显示"
echo "  2. 顶部工具栏是否显示"
echo "  3. 登录检测是否自动工作"
echo "  4. 账号信息是否正确保存"
echo "  5. Cookie 和 Storage 是否正确捕获"
echo ""
echo "🔍 调试技巧:"
echo "  - 打开开发者工具查看 Console"
echo "  - 查找 [Preload] 开头的日志"
echo "  - 查找 [LoginManager] 开头的日志"
echo ""
echo "⚠️  如果遇到问题:"
echo "  1. 查看 WEBVIEW_QUICK_TEST.md"
echo "  2. 查看 WEBVIEW_MIGRATION_SUMMARY.md"
echo "  3. 使用回滚方案"
echo ""

read -p "按 Enter 键启动应用..."

echo ""
echo "🚀 启动应用..."
echo ""

npm run electron:dev
