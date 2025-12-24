#!/bin/bash

# 测试用户管理 API
# 用于调试注册时间显示问题

echo "=========================================="
echo "  测试用户管理 API"
echo "=========================================="
echo ""

# 检查是否提供了 token
if [ -z "$1" ]; then
    echo "❌ 错误：请提供管理员 token"
    echo ""
    echo "使用方法："
    echo "  ./test-user-api.sh YOUR_ADMIN_TOKEN"
    echo ""
    echo "如何获取 token："
    echo "  1. 在浏览器中登录管理员账号"
    echo "  2. 打开开发者工具（F12）"
    echo "  3. 在 Console 中输入：localStorage.getItem('auth_token')"
    echo "  4. 复制显示的 token"
    exit 1
fi

TOKEN=$1

echo "📡 正在请求用户列表..."
echo ""

# 发送请求
RESPONSE=$(curl -s -X GET "http://localhost:3000/api/admin/users?page=1&pageSize=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "📋 API 响应："
echo "$RESPONSE" | jq '.'

echo ""
echo "=========================================="
echo "  字段检查"
echo "=========================================="
echo ""

# 检查第一个用户的字段
FIRST_USER=$(echo "$RESPONSE" | jq '.data.users[0]')

if [ "$FIRST_USER" != "null" ]; then
    echo "✅ 第一个用户数据："
    echo "$FIRST_USER" | jq '.'
    echo ""
    
    # 检查关键字段
    echo "🔍 字段检查："
    echo "  - id: $(echo "$FIRST_USER" | jq -r '.id')"
    echo "  - username: $(echo "$FIRST_USER" | jq -r '.username')"
    echo "  - invitationCode: $(echo "$FIRST_USER" | jq -r '.invitationCode')"
    echo "  - createdAt: $(echo "$FIRST_USER" | jq -r '.createdAt')"
    echo "  - updatedAt: $(echo "$FIRST_USER" | jq -r '.updatedAt')"
    echo "  - lastLoginAt: $(echo "$FIRST_USER" | jq -r '.lastLoginAt')"
    echo ""
    
    # 检查是否使用了蛇形命名
    CREATED_AT_SNAKE=$(echo "$FIRST_USER" | jq -r '.created_at')
    if [ "$CREATED_AT_SNAKE" != "null" ]; then
        echo "⚠️  警告：发现蛇形命名字段 'created_at'"
        echo "   后端可能没有正确转换字段名"
    fi
    
    # 检查是否使用了驼峰命名
    CREATED_AT_CAMEL=$(echo "$FIRST_USER" | jq -r '.createdAt')
    if [ "$CREATED_AT_CAMEL" != "null" ]; then
        echo "✅ 正确：使用驼峰命名 'createdAt'"
    else
        echo "❌ 错误：缺少驼峰命名字段 'createdAt'"
    fi
else
    echo "❌ 错误：没有找到用户数据"
fi

echo ""
echo "=========================================="
echo "  调试建议"
echo "=========================================="
echo ""
echo "如果 createdAt 为 null："
echo "  1. 检查后端是否已重启"
echo "  2. 检查 server/src/routes/admin.ts 中的 convertUserFields 函数"
echo "  3. 查看后端控制台的日志输出"
echo ""
echo "如果看到 created_at 而不是 createdAt："
echo "  1. 后端字段转换函数可能没有生效"
echo "  2. 需要重启后端服务"
echo ""
