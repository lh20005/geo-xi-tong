#!/bin/bash

# 快速更新 ngrok URL 脚本

echo "🔍 正在获取当前 ngrok URL..."

# 从 ngrok API 获取当前 URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*' | grep -o 'https://[^"]*' | head -1)

if [ -z "$NGROK_URL" ]; then
    echo "❌ 错误：无法获取 ngrok URL"
    echo "   请确保 ngrok 正在运行"
    echo "   运行命令：ngrok http 3000"
    exit 1
fi

echo "✅ 当前 ngrok URL: $NGROK_URL"
echo ""

# 更新 server/.env
ENV_FILE="server/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ 错误：找不到 $ENV_FILE"
    exit 1
fi

echo "📝 正在更新 $ENV_FILE..."

# 备份原文件
cp "$ENV_FILE" "$ENV_FILE.backup"

# 更新 ALLOWED_ORIGINS
sed -i '' "s|ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=http://localhost,http://localhost:5173,http://localhost:5174,http://localhost:8080,$NGROK_URL|g" "$ENV_FILE"

# 更新 WECHAT_PAY_NOTIFY_URL
sed -i '' "s|WECHAT_PAY_NOTIFY_URL=.*|WECHAT_PAY_NOTIFY_URL=$NGROK_URL/api/payment/wechat/notify|g" "$ENV_FILE"

echo "✅ 配置已更新！"
echo ""
echo "📋 更新内容："
echo "   ALLOWED_ORIGINS: ..., $NGROK_URL"
echo "   WECHAT_PAY_NOTIFY_URL: $NGROK_URL/api/payment/wechat/notify"
echo ""
echo "⚠️  请重启后端服务使配置生效："
echo "   npm run server:dev"
echo ""
echo "💾 原配置已备份到: $ENV_FILE.backup"
