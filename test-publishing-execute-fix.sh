#!/bin/bash

# 测试发布任务执行按钮修复
# 此脚本帮助验证浏览器是否会弹出

echo "=========================================="
echo "发布任务执行按钮修复验证"
echo "=========================================="
echo ""

# 检查服务器是否运行
echo "1. 检查服务器状态..."
if lsof -ti:3000 > /dev/null 2>&1; then
    echo "   ✅ 后端服务器正在运行 (端口 3000)"
else
    echo "   ❌ 后端服务器未运行"
    echo ""
    echo "请先启动服务器："
    echo "   cd server && npm run dev"
    echo ""
    exit 1
fi

# 检查前端（可能在5173或其他端口）
if lsof -ti:5173 > /dev/null 2>&1; then
    echo "   ✅ 前端服务器正在运行 (端口 5173)"
elif ps aux | grep -E "react-scripts|vite" | grep -v grep > /dev/null 2>&1; then
    echo "   ✅ 前端服务器正在运行"
else
    echo "   ⚠️  前端服务器未运行"
    echo ""
    echo "请启动前端："
    echo "   cd client && npm start"
    echo ""
fi

echo ""
echo "2. 检查修复内容..."
if grep -q "headless: false" server/src/services/PublishingExecutor.ts; then
    echo "   ✅ 浏览器已配置为可见模式 (headless: false)"
else
    echo "   ❌ 浏览器仍为无头模式"
    echo "   请检查 server/src/services/PublishingExecutor.ts 第 62 行"
    exit 1
fi

echo ""
echo "3. 测试步骤："
echo "   ① 访问: http://localhost:5173/publishing-tasks"
echo "   ② 选择文章和平台，创建发布任务"
echo "   ③ 点击任务列表中的'执行'按钮"
echo "   ④ 确认对话框中点击'确定'"
echo ""
echo "4. 预期结果："
echo "   ✅ 浏览器窗口应该弹出"
echo "   ✅ 可以看到自动登录和发布过程"
echo "   ✅ 任务状态变为'执行中'然后'成功'"
echo ""
echo "=========================================="
echo "修复已完成！请按照上述步骤测试"
echo "=========================================="
