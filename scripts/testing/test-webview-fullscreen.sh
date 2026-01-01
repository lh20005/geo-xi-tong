#!/bin/bash

# WebView 全屏测试脚本

echo "========================================="
echo "  WebView 全屏显示测试"
echo "========================================="
echo ""

cd windows-login-manager

echo "🔨 重新编译代码..."
npm run build:electron
if [ $? -ne 0 ]; then
    echo "❌ 编译失败"
    exit 1
fi
echo "✅ 编译成功"
echo ""

echo "========================================="
echo "  测试清单"
echo "========================================="
echo ""
echo "1. WebView 窗口是否占满整个区域（除顶部工具栏）"
echo "2. 网页内容是否全屏显示（不是只在左上角）"
echo "3. 页面是否可以正常滚动"
echo "4. 页面跳转后是否仍然全屏"
echo "5. 控制台是否有全屏注入日志"
echo ""
echo "🔍 调试技巧:"
echo "  - 按 F12 打开开发者工具"
echo "  - 查找 [WebView] 开头的日志"
echo "  - 查找 [WebView FULLSCREEN] 日志"
echo ""

read -p "按 Enter 键启动应用..."

echo ""
echo "🚀 启动应用..."
npm run electron:dev
