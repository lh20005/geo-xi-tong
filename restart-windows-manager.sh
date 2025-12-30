#!/bin/bash

echo "=== 重启 Windows 登录管理器 ==="

# 1. 停止正在运行的进程
echo "1. 停止现有进程..."
pkill -f "windows-login-manager" || echo "   没有运行中的进程"

# 2. 清理缓存
echo "2. 清理缓存..."
cd windows-login-manager
rm -rf dist/
rm -rf .vite/
rm -rf node_modules/.vite/

# 3. 重新编译
echo "3. 重新编译..."
npm run build 2>&1 | tail -20

# 4. 启动应用
echo "4. 启动应用..."
echo "   请手动运行: cd windows-login-manager && npm run dev"
echo ""
echo "=== 完成 ==="
echo ""
echo "📝 测试步骤:"
echo "1. 打开 Windows 登录管理器"
echo "2. 按 Cmd+Option+I 打开开发者工具"
echo "3. 切换到 Console 标签"
echo "4. 尝试上传文件"
echo "5. 查看控制台的错误信息"
