#!/bin/bash

# ngrok 配置脚本

echo "=== ngrok 配置向导 ==="
echo ""

# 检查 ngrok 是否已安装
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok 未安装"
    echo "正在安装 ngrok..."
    brew install ngrok
    echo "✅ ngrok 安装完成"
else
    echo "✅ ngrok 已安装"
fi

echo ""
echo "请输入你的 ngrok authtoken："
echo "（从 https://dashboard.ngrok.com/get-started/your-authtoken 获取）"
read -p "authtoken: " NGROK_TOKEN

if [ -z "$NGROK_TOKEN" ]; then
    echo "❌ authtoken 不能为空"
    exit 1
fi

# 配置 ngrok
echo ""
echo "正在配置 ngrok..."
ngrok config add-authtoken "$NGROK_TOKEN"

if [ $? -eq 0 ]; then
    echo "✅ ngrok 配置成功"
else
    echo "❌ ngrok 配置失败"
    exit 1
fi

echo ""
echo "=== 配置完成 ==="
echo ""
echo "下一步："
echo "1. 启动 ngrok: ngrok http 3000"
echo "2. 复制显示的 HTTPS 地址（如 https://abc123.ngrok.io）"
echo "3. 更新 .env 文件中的 WECHAT_PAY_NOTIFY_URL"
echo "4. 重启服务器"
echo ""
