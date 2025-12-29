#!/bin/bash

echo "🧪 微信支付测试 - 快速检查"
echo "================================"
echo ""

# 1. 检查 ngrok 状态
echo "1️⃣ 检查 ngrok 状态..."
if pgrep -f "ngrok http 3000" > /dev/null; then
    echo "   ✅ ngrok 正在运行"
    
    # 获取 ngrok 地址
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "import sys, json; data = json.load(sys.stdin); print(data['tunnels'][0]['public_url'])" 2>/dev/null)
    
    if [ -n "$NGROK_URL" ]; then
        echo "   📍 ngrok 地址: $NGROK_URL"
    else
        echo "   ⚠️  无法获取 ngrok 地址"
        NGROK_URL="https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev"
        echo "   📍 使用已知地址: $NGROK_URL"
    fi
else
    echo "   ❌ ngrok 未运行"
    echo "   💡 请运行: ngrok http 3000"
    exit 1
fi

echo ""

# 2. 检查后端服务
echo "2️⃣ 检查后端服务..."
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "   ✅ 后端服务正常"
else
    echo "   ❌ 后端服务未运行"
    echo "   💡 请运行: cd server && npm run dev"
    exit 1
fi

echo ""

# 3. 检查 landing 页面
echo "3️⃣ 检查 landing 页面..."
if [ -d "landing/dist" ]; then
    echo "   ✅ landing 已构建"
else
    echo "   ❌ landing 未构建"
    echo "   💡 请运行: cd landing && npm run build"
    exit 1
fi

echo ""

# 4. 测试 ngrok 访问
echo "4️⃣ 测试 ngrok 访问..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$NGROK_URL/")
if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ ngrok 可以访问 landing 页面"
else
    echo "   ⚠️  ngrok 访问返回: $HTTP_CODE"
fi

echo ""

# 5. 检查微信支付配置
echo "5️⃣ 检查微信支付配置..."
if grep -q "WECHAT_PAY_NOTIFY_URL=.*ngrok" server/.env; then
    echo "   ✅ 回调地址已配置为 ngrok"
else
    echo "   ⚠️  回调地址未配置为 ngrok"
    echo "   💡 请更新 server/.env 中的 WECHAT_PAY_NOTIFY_URL"
    echo "   💡 改为: $NGROK_URL/api/payment/wechat/notify"
fi

echo ""
echo "================================"
echo "✅ 测试准备完成！"
echo ""
echo "📱 开始测试："
echo "   1. 在手机浏览器中访问: $NGROK_URL"
echo "   2. 或者在电脑上访问: $NGROK_URL"
echo "   3. 登录账号（如果需要）"
echo "   4. 选择套餐并点击购买"
echo "   5. 使用微信扫码支付"
echo "   6. 支付完成后，页面应该自动跳转"
echo ""
echo "🔍 调试工具："
echo "   • ngrok 控制台: http://localhost:4040"
echo "   • 后端日志: 查看运行 server 的终端"
echo "   • 浏览器控制台: F12 查看前端日志"
echo ""
