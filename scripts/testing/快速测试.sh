#!/bin/bash

echo "🧪 微信支付完整测试 - 快速检查"
echo "================================"
echo ""

# 1. 检查后端服务
echo "1️⃣ 检查后端服务..."
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "   ✅ 后端服务正常"
else
    echo "   ❌ 后端服务未运行"
    echo "   💡 请运行: cd server && npm run dev"
    exit 1
fi

echo ""

# 2. 检查 ngrok
echo "2️⃣ 检查 ngrok 隧道..."
if pgrep -f "ngrok" > /dev/null; then
    echo "   ✅ ngrok 正在运行"
    
    # 获取 ngrok 地址
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "import sys, json; data = json.load(sys.stdin); print(data['tunnels'][0]['public_url'] if data.get('tunnels') else '')" 2>/dev/null)
    
    if [ -n "$NGROK_URL" ]; then
        echo "   📍 ngrok 地址: $NGROK_URL"
    else
        NGROK_URL="https://granolithic-pseudoprosperous-rebeca.ngrok-free.dev"
        echo "   📍 使用已知地址: $NGROK_URL"
    fi
else
    echo "   ❌ ngrok 未运行"
    echo "   💡 请运行: ngrok http 3000"
    exit 1
fi

echo ""

# 3. 检查 Landing 构建
echo "3️⃣ 检查 Landing 页面..."
if [ -d "landing/dist" ] && [ -f "landing/dist/index.html" ]; then
    echo "   ✅ Landing 已构建"
else
    echo "   ❌ Landing 未构建"
    echo "   💡 请运行: cd landing && npm run build"
    exit 1
fi

echo ""

# 4. 测试 ngrok 访问
echo "4️⃣ 测试 ngrok 访问..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$NGROK_URL/" 2>/dev/null)
if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ ngrok 可以访问 Landing 页面"
else
    echo "   ⚠️  ngrok 访问返回: $HTTP_CODE"
fi

echo ""

# 5. 检查环境变量
echo "5️⃣ 检查环境变量配置..."
if grep -q "granolithic-pseudoprosperous-rebeca.ngrok-free.dev" server/.env; then
    echo "   ✅ CORS 配置包含 ngrok 域名"
else
    echo "   ⚠️  CORS 配置可能需要更新"
fi

if grep -q "WECHAT_PAY_NOTIFY_URL.*ngrok" server/.env; then
    echo "   ✅ 支付回调地址已配置为 ngrok"
else
    echo "   ⚠️  支付回调地址可能需要更新"
fi

echo ""

# 6. 测试登录
echo "6️⃣ 测试登录功能..."
LOGIN_RESULT=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: $NGROK_URL" \
  -d '{"username":"lzc2005","password":"Woshixiaogou2005"}' 2>/dev/null)

if echo "$LOGIN_RESULT" | grep -q '"success":true'; then
    echo "   ✅ 登录功能正常"
else
    echo "   ❌ 登录失败"
    echo "   响应: $LOGIN_RESULT"
fi

echo ""
echo "================================"
echo "✅ 所有检查完成！"
echo ""
echo "📱 开始测试："
echo "   1. 在浏览器中访问: $NGROK_URL"
echo "   2. 登录账号（用户名: lzc2005，密码: Woshixiaogou2005）"
echo "   3. 选择套餐并点击购买"
echo "   4. 使用微信扫码支付"
echo "   5. 验证支付成功后页面自动跳转"
echo ""
echo "🔍 调试工具："
echo "   • ngrok 控制台: http://localhost:4040"
echo "   • 后端健康检查: curl http://localhost:3000/api/health"
echo "   • 查看订单: psql -U lzc -d geo_system -c \"SELECT * FROM orders ORDER BY created_at DESC LIMIT 5;\""
echo ""
