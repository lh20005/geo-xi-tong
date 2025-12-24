#!/bin/bash

echo "=========================================="
echo "  测试用户管理 API 响应"
echo "=========================================="
echo ""

# 测试 API 端点
echo "📡 测试 API: http://localhost:3000/api/admin/users"
echo ""

# 不需要 token 的测试（会返回 401，但能看到服务是否运行）
echo "1. 测试服务是否运行..."
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:3000/api/admin/users)
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)

if [ "$HTTP_CODE" = "401" ]; then
    echo "✅ 服务正在运行（返回 401 需要认证）"
elif [ "$HTTP_CODE" = "200" ]; then
    echo "✅ 服务正在运行（返回 200）"
else
    echo "❌ 服务可能未运行或有问题（HTTP $HTTP_CODE）"
    exit 1
fi

echo ""
echo "=========================================="
echo "  获取 Token 的方法"
echo "=========================================="
echo ""
echo "请在浏览器中："
echo "1. 登录管理员账号"
echo "2. 按 F12 打开开发者工具"
echo "3. 切换到 Console 标签"
echo "4. 输入：localStorage.getItem('auth_token')"
echo "5. 复制显示的 token"
echo ""
echo "然后运行："
echo "  curl -H \"Authorization: Bearer YOUR_TOKEN\" http://localhost:3000/api/admin/users | jq '.data.users[0]'"
echo ""
