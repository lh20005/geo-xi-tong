#!/bin/bash

# GEO优化系统 - 后台启动脚本
# 适用于日常使用，所有服务在后台运行，可以关闭终端窗口

cd "$(dirname "$0")"
echo -ne "\033]0;GEO系统后台启动\007"

clear
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌟 GEO优化系统 - 后台启动"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. 系统检查
echo "🔍 [1/6] 系统环境检查..."
if ! command -v node &> /dev/null; then
    echo "❌ 未找到 Node.js"
    read -p "按回车键退出..." && exit 1
fi

if ! command -v brew &> /dev/null; then
    echo "❌ 未找到 Homebrew"
    read -p "按回车键退出..." && exit 1
fi

echo "   ✅ 系统环境正常"
echo ""

# 2. 启动数据库
echo "🗄️  [2/6] 启动数据库服务..."
brew services start postgresql@14 > /dev/null 2>&1
brew services start redis > /dev/null 2>&1
sleep 3
echo "   ✅ 数据库服务已启动"
echo ""

# 3. 数据库迁移
echo "🔄 [3/6] 数据库迁移..."
cd server && npm run db:migrate > /dev/null 2>&1 && cd ..
echo "   ✅ 数据库迁移完成"
echo ""

# 4. 创建日志目录
echo "📁 [4/6] 准备日志目录..."
mkdir -p logs
rm -f logs/*.pid 2>/dev/null
echo "   ✅ 日志目录就绪"
echo ""

# 5. 停止旧服务
echo "🧹 [5/6] 清理旧服务..."
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
pkill -f "tsx watch" 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
sleep 2
echo "   ✅ 旧服务已清理"
echo ""

# 6. 启动后台服务
echo "🚀 [6/6] 启动后台服务..."

# 后端服务
cd server
nohup npm run dev > ../logs/backend.log 2>&1 &
echo $! > ../logs/backend.pid
cd ..
echo "   ✅ 后端服务已启动 (PID: $(cat logs/backend.pid))"

# 前端服务
cd client
nohup npm run dev > ../logs/frontend.log 2>&1 &
echo $! > ../logs/frontend.pid
cd ..
echo "   ✅ 前端服务已启动 (PID: $(cat logs/frontend.pid))"

# 营销网站
cd landing
nohup npm run dev > ../logs/landing.log 2>&1 &
echo $! > ../logs/landing.pid
cd ..
echo "   ✅ 营销网站已启动 (PID: $(cat logs/landing.pid))"

# Windows管理器
cd windows-login-manager
nohup npm run electron:dev > ../logs/windows.log 2>&1 &
echo $! > ../logs/windows.pid
cd ..
echo "   ✅ Windows管理器已启动 (PID: $(cat logs/windows.pid))"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 所有服务已在后台启动！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 等待服务启动
echo "⏳ 等待服务启动完成（约15秒）..."
sleep 15
echo ""

# 检查服务状态
echo "🔍 检查服务状态..."
BACKEND_OK=false
FRONTEND_OK=false
LANDING_OK=false

if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "   ✅ 后端服务: http://localhost:3000"
    BACKEND_OK=true
else
    echo "   ⚠️  后端服务: 启动中... (查看日志: tail -f logs/backend.log)"
fi

if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "   ✅ 前端服务: http://localhost:5173"
    FRONTEND_OK=true
else
    echo "   ⚠️  前端服务: 启动中... (查看日志: tail -f logs/frontend.log)"
fi

if curl -s http://localhost:8080 > /dev/null 2>&1; then
    echo "   ✅ 营销网站: http://localhost:8080"
    LANDING_OK=true
else
    echo "   ⚠️  营销网站: 启动中... (查看日志: tail -f logs/landing.log)"
fi

echo "   ✅ Windows管理器: Electron应用"
echo ""

# 显示日志位置
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 日志文件:"
echo "   • 后端:   logs/backend.log"
echo "   • 前端:   logs/frontend.log"
echo "   • 营销:   logs/landing.log"
echo "   • Windows: logs/windows.log"
echo ""
echo "🛑 停止服务:"
echo "   双击运行: 停止GEO系统.command"
echo ""
echo "💡 提示:"
echo "   • 现在可以安全关闭此窗口"
echo "   • 服务将继续在后台运行"
echo "   • 查看日志: tail -f logs/backend.log"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$BACKEND_OK" = true ] && [ "$FRONTEND_OK" = true ]; then
    echo "🎉 GEO系统启动成功！"
else
    echo "⚠️  部分服务仍在启动中，请稍候片刻"
fi

echo ""
read -p "按回车键关闭此窗口..."
