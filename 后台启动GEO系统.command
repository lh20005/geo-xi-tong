#!/bin/bash

# 获取脚本所在目录
cd "$(dirname "$0")"

clear
echo "🌟 GEO系统后台启动器"
echo "================================"
echo ""

# 检查系统依赖
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js"
    read -p "按回车键退出..."
    exit 1
fi

if ! command -v brew &> /dev/null; then
    echo "❌ 错误: 未找到 Homebrew"
    read -p "按回车键退出..."
    exit 1
fi

echo "✅ 系统检查通过"

# 启动数据库服务
echo "📊 启动数据库服务..."
brew services start postgresql@14 > /dev/null 2>&1
brew services start redis > /dev/null 2>&1
sleep 3

# 运行数据库迁移
echo "🔄 运行数据库迁移..."
cd server && npm run db:migrate > /dev/null 2>&1 && cd ..

# 创建日志目录
mkdir -p logs

echo "🚀 启动后台服务..."

# 后台启动后端服务
cd server
nohup npm run dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# 后台启动前端服务
cd client
nohup npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# 后台启动营销网站
cd landing
nohup npm run dev > ../logs/landing.log 2>&1 &
LANDING_PID=$!
cd ..

# 后台启动Windows登录管理器
cd windows-login-manager
nohup npm run electron:dev > ../logs/windows.log 2>&1 &
WINDOWS_PID=$!
cd ..

# 保存进程ID
echo "$BACKEND_PID" > logs/backend.pid
echo "$FRONTEND_PID" > logs/frontend.pid
echo "$LANDING_PID" > logs/landing.pid
echo "$WINDOWS_PID" > logs/windows.pid

echo ""
echo "✅ 所有服务已在后台启动！"
echo ""
echo "📋 服务地址:"
echo "  • 前端应用: http://localhost:5173"
echo "  • 后端API:  http://localhost:3000"
echo "  • 营销网站: http://localhost:8080"
echo "  • Windows管理器: Electron应用"
echo ""
echo "📝 日志文件位置:"
echo "  • 后端日志: logs/backend.log"
echo "  • 前端日志: logs/frontend.log"
echo "  • 营销网站日志: logs/landing.log"
echo "  • Windows管理器日志: logs/windows.log"
echo ""
echo "🛑 停止服务:"
echo "  • 双击运行 '停止GEO系统.command'"
echo "  • 或者手动运行: ./停止GEO系统.command"
echo ""
echo "💡 提示: 现在可以安全关闭此窗口，服务将继续在后台运行"
echo ""

# 等待服务启动
echo "⏳ 等待服务启动完成..."
sleep 10

# 检查服务状态
echo "🔍 检查服务状态..."
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ 后端服务: 运行正常"
else
    echo "⚠️  后端服务: 启动中..."
fi

if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "✅ 前端服务: 运行正常"
else
    echo "⚠️  前端服务: 启动中..."
fi

if curl -s http://localhost:8080 > /dev/null 2>&1; then
    echo "✅ 营销网站: 运行正常"
else
    echo "⚠️  营销网站: 启动中..."
fi

echo ""
echo "🎉 GEO系统后台启动完成！"
echo ""
read -p "按回车键关闭此窗口..."