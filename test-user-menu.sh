#!/bin/bash

# 用户菜单测试脚本
# 用于快速启动系统并测试新的用户菜单功能

echo "=========================================="
echo "  用户菜单卡片式设计 - 测试脚本"
echo "=========================================="
echo ""

# 检查是否在项目根目录
if [ ! -d "landing" ] || [ ! -d "server" ]; then
    echo "❌ 错误：请在项目根目录运行此脚本"
    exit 1
fi

echo "📋 测试准备清单："
echo ""
echo "1. 确保已安装依赖："
echo "   cd landing && npm install"
echo "   cd server && npm install"
echo ""
echo "2. 确保数据库已启动"
echo ""
echo "3. 确保有测试账号："
echo "   - 普通用户：testuser / Test123456"
echo "   - 管理员：admin / Admin123456"
echo ""

read -p "是否继续启动测试？(y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 已取消"
    exit 0
fi

echo ""
echo "🚀 启动服务..."
echo ""

# 检查端口是否被占用
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️  警告：端口 $port 已被占用"
        return 1
    fi
    return 0
}

# 检查后端端口
if ! check_port 3000; then
    echo "   后端服务可能已在运行"
fi

# 检查前端端口
if ! check_port 5174; then
    echo "   网页端服务可能已在运行"
fi

echo ""
echo "📝 测试步骤："
echo ""
echo "1. 访问 http://localhost:5174"
echo "2. 点击右上角"立即登录"按钮"
echo "3. 使用测试账号登录"
echo "4. 登录成功后，点击右上角用户头像"
echo "5. 查看卡片式菜单是否正常显示"
echo ""
echo "🔍 测试要点："
echo ""
echo "桌面端测试（宽度 >= 768px）："
echo "  ✓ 点击头像弹出卡片式菜单"
echo "  ✓ 菜单显示用户信息（头像、用户名、角色）"
echo "  ✓ 菜单包含：进入系统、个人中心、退出登录"
echo "  ✓ 管理员额外显示：用户管理"
echo "  ✓ 点击菜单外部自动关闭"
echo "  ✓ 悬停在菜单项上有背景色变化"
echo "  ✓ 点击退出登录弹出确认对话框"
echo ""
echo "移动端测试（宽度 < 768px）："
echo "  ✓ 点击头像弹出全屏菜单"
echo "  ✓ 菜单从顶部滑下"
echo "  ✓ 背景有半透明遮罩"
echo "  ✓ 按钮更大，便于触摸"
echo "  ✓ 点击遮罩或关闭按钮关闭菜单"
echo ""
echo "功能测试："
echo "  ✓ 进入系统：跳转到前端系统"
echo "  ✓ 个人中心：跳转到 /profile"
echo "  ✓ 用户管理：跳转到 /admin/users（管理员）"
echo "  ✓ 退出登录：弹出确认对话框，确认后退出"
echo ""
echo "视觉效果测试："
echo "  ✓ 菜单打开有滑动动画"
echo "  ✓ 对话框打开有淡入和缩放动画"
echo "  ✓ 箭头在菜单打开时旋转180度"
echo "  ✓ 所有悬停效果正常"
echo ""

read -p "按 Enter 键打开浏览器..." 

# 打开浏览器
if command -v open &> /dev/null; then
    # macOS
    open http://localhost:5174
elif command -v xdg-open &> /dev/null; then
    # Linux
    xdg-open http://localhost:5174
elif command -v start &> /dev/null; then
    # Windows
    start http://localhost:5174
else
    echo "请手动打开浏览器访问 http://localhost:5174"
fi

echo ""
echo "✅ 测试准备完成！"
echo ""
echo "📚 相关文档："
echo "  - USER_MENU_DESIGN.md          # 设计文档"
echo "  - USER_MENU_TEST_GUIDE.md      # 测试指南"
echo "  - USER_MENU_VISUAL_GUIDE.md    # 视觉设计指南"
echo ""
echo "如有问题，请查看文档或反馈。"
echo ""
