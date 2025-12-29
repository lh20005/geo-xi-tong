#!/bin/bash

# 启动两个 ngrok 隧道
# 1. 后端 API (端口 3000)
# 2. Landing 页面 (端口 8080)

echo "🚀 启动 ngrok 隧道..."
echo ""

# 检查 ngrok 是否已安装
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok 未安装，请先运行: brew install ngrok"
    exit 1
fi

# 检查是否已有 ngrok 进程
if pgrep -f "ngrok" > /dev/null; then
    echo "⚠️  检测到 ngrok 正在运行"
    echo "是否停止现有的 ngrok 进程？(y/n)"
    read -p "> " answer
    if [ "$answer" = "y" ]; then
        pkill -f ngrok
        sleep 2
        echo "✅ 已停止现有 ngrok 进程"
    else
        echo "❌ 取消操作"
        exit 1
    fi
fi

# 创建 ngrok 配置文件
cat > ngrok-config.yml << EOF
version: "2"
authtoken: $(ngrok config check | grep authtoken | awk '{print $2}')
tunnels:
  backend:
    proto: http
    addr: 3000
  landing:
    proto: http
    addr: 8080
EOF

echo "📝 ngrok 配置文件已创建"
echo ""

# 启动 ngrok（后台运行）
echo "🔄 启动 ngrok 隧道..."
nohup ngrok start --all --config=ngrok-config.yml > ngrok.log 2>&1 &

# 等待 ngrok 启动
sleep 3

# 获取隧道地址
echo ""
echo "✅ ngrok 隧道已启动！"
echo ""
echo "📋 隧道地址："
echo ""

# 从 ngrok API 获取地址
curl -s http://localhost:4040/api/tunnels | python3 -c "
import sys, json
data = json.load(sys.stdin)
for tunnel in data['tunnels']:
    name = tunnel['name']
    url = tunnel['public_url']
    print(f'  • {name}: {url}')
" 2>/dev/null || echo "  请访问 http://localhost:4040 查看隧道地址"

echo ""
echo "💡 使用说明："
echo "  1. 使用 landing 隧道地址访问营销页面"
echo "  2. 前端会自动使用 backend 隧道地址访问 API"
echo "  3. 更新 .env 中的 WECHAT_PAY_NOTIFY_URL 为 backend 地址"
echo ""
echo "🛑 停止隧道: pkill -f ngrok"
echo "📊 查看状态: http://localhost:4040"
echo ""
