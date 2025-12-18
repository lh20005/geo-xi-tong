#!/bin/bash

echo "======================================"
echo "验证浏览器配置统一修复"
echo "======================================"
echo ""

# 检查配置文件是否存在
echo "1. 检查配置文件..."
if [ -f "server/dist/config/browserConfig.js" ]; then
    echo "✅ browserConfig.js 已编译"
else
    echo "❌ browserConfig.js 未找到"
    echo "   请运行: cd server && npm run build"
    exit 1
fi

# 检查是否使用统一配置
echo ""
echo "2. 检查 BrowserAutomationService..."
if grep -q "getStandardBrowserConfig" server/dist/services/BrowserAutomationService.js; then
    echo "✅ BrowserAutomationService 使用统一配置"
else
    echo "❌ BrowserAutomationService 未使用统一配置"
    exit 1
fi

echo ""
echo "3. 检查 AccountService..."
if grep -q "getStandardBrowserConfig" server/dist/services/AccountService.js; then
    echo "✅ AccountService 使用统一配置"
else
    echo "❌ AccountService 未使用统一配置"
    exit 1
fi

# 检查关键配置参数
echo ""
echo "4. 检查关键配置参数..."

if grep -q "start-maximized" server/dist/config/browserConfig.js; then
    echo "✅ 包含 --start-maximized（窗口最大化）"
else
    echo "❌ 缺少 --start-maximized"
fi

if grep -q "defaultViewport.*null" server/dist/config/browserConfig.js; then
    echo "✅ 包含 defaultViewport: null（不限制窗口大小）"
else
    echo "❌ 缺少 defaultViewport: null"
fi

if grep -q "disable-blink-features=AutomationControlled" server/dist/config/browserConfig.js; then
    echo "✅ 包含 --disable-blink-features=AutomationControlled（隐藏自动化）"
else
    echo "❌ 缺少自动化隐藏配置"
fi

echo ""
echo "======================================"
echo "修复内容摘要"
echo "======================================"
echo ""
echo "已修复的服务："
echo "  1. BrowserAutomationService - 发布任务浏览器"
echo "  2. AccountService - 平台登录浏览器"
echo "  3. test-browser-launch - 测试浏览器"
echo ""
echo "关键配置："
echo "  • defaultViewport: null - 不限制窗口大小"
echo "  • --start-maximized - 启动时最大化"
echo "  • --disable-blink-features - 隐藏自动化特征"
echo ""
echo "影响的平台："
echo "  • 所有平台的浏览器登录（17个平台）"
echo "  • 所有平台的自动发布"
echo ""
echo "======================================"
echo "下一步操作"
echo "======================================"
echo ""
echo "1. 重启服务器："
echo "   cd server && npm start"
echo ""
echo "2. 测试浏览器登录："
echo "   • 打开前端：http://localhost:5173"
echo "   • 进入「平台登录」页面"
echo "   • 点击任意平台（抖音、小红书、B站等）"
echo "   • 观察：浏览器应该最大化打开"
echo ""
echo "3. 测试自动发布："
echo "   • 创建发布任务"
echo "   • 执行发布"
echo "   • 观察：浏览器应该最大化打开"
echo ""
echo "预期效果："
echo "  ✅ 浏览器窗口最大化"
echo "  ✅ 页面内容完整显示"
echo "  ✅ 所有按钮和元素可见"
echo "  ✅ 操作更流畅"
echo ""
