#!/bin/bash

echo "🔍 测试 BrowserView 全屏显示"
echo "================================"
echo ""
echo "步骤："
echo "1. 启动 Windows 登录管理器"
echo "2. 点击任意平台的'登录'按钮"
echo "3. 查看开发者工具中的日志"
echo ""
echo "预期日志："
echo "  Content size: 1920 x 1042 (或你的屏幕分辨率)"
echo "  Setting BrowserView bounds: {x:0, y:50, width:1920, height:992}"
echo "  BrowserView resized and auto-resize enabled"
echo ""
echo "预期结果："
echo "  ✅ BrowserView 占满整个窗口（除了顶部 50px 工具栏）"
echo "  ✅ 没有白色空白区域"
echo ""
echo "================================"
echo ""
echo "正在启动应用..."
echo ""

cd windows-login-manager
npm run dev
