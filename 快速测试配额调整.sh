#!/bin/bash

# 快速测试存储空间配额调整和同步功能

echo "================================"
echo "测试存储空间配额调整和同步"
echo "================================"
echo ""

# 检查是否在项目根目录
if [ ! -d "server" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    exit 1
fi

# 进入 server 目录
cd server

echo "📋 步骤 1: 编译 TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ 编译失败"
    exit 1
fi

echo ""
echo "🧪 步骤 2: 运行测试脚本..."
echo ""

node dist/scripts/test-storage-quota-adjustment.js

echo ""
echo "================================"
echo "测试完成"
echo "================================"
echo ""
echo "📝 手动测试步骤："
echo ""
echo "1. 启动服务："
echo "   cd client && npm run dev"
echo ""
echo "2. 测试配额调整界面："
echo "   - 登录管理员账号"
echo "   - 进入 '用户管理'"
echo "   - 点击任意用户的 '订阅详情'"
echo "   - 点击 '调整配额'"
echo "   - 选择 '存储空间'"
echo "   - 验证显示 'MB' 单位"
echo ""
echo "3. 测试实时同步："
echo "   - 打开两个浏览器窗口"
echo "   - 窗口A: 管理员账号 -> 用户管理"
echo "   - 窗口B: 普通用户 -> 个人中心 -> 存储空间"
echo "   - 在窗口A调整配额"
echo "   - 验证窗口B自动更新（无需刷新）"
echo ""
