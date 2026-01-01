#!/bin/bash

echo "=========================================="
echo "  快速测试抖音关闭按钮"
echo "=========================================="
echo ""
echo "修复内容："
echo "1. ✅ 创建全局关闭函数 window.__closeWebView"
echo "2. ✅ 修改 cancel-login handler 支持自动检测"
echo "3. ✅ 检查所有登录管理器状态"
echo ""
echo "测试步骤："
echo "1. 启动 Windows 登录管理器"
echo "2. 进入'平台管理'页面"
echo "3. 点击'抖音'平台卡片"
echo "4. 等待登录页面加载"
echo "5. 点击右上角'✕ 关闭浏览器'按钮"
echo "6. 验证浏览器窗口立即关闭"
echo ""
echo "预期日志（按 F12 查看）："
echo "  [WebView] Close button clicked"
echo "  [WebView] Global close function called"
echo "  IPC: cancel-login - all"
echo "  IPC: 取消抖音号登录"
echo "  [Douyin] 取消登录"
echo "  [WebView] WebView destroyed"
echo ""
echo "=========================================="
echo ""

read -p "按回车键启动 Windows 登录管理器..." 

# 启动 Windows 登录管理器
./启动Windows管理器.command
