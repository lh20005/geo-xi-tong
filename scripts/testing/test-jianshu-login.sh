#!/bin/bash

# 简书登录测试脚本
# 用于测试重做后的简书登录器

echo "=========================================="
echo "简书登录器测试"
echo "=========================================="
echo ""

# 检查服务是否运行
echo "1. 检查服务状态..."
if ! curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "❌ 后端服务未运行，请先启动服务"
    echo "   运行: npm run dev"
    exit 1
fi
echo "✅ 后端服务正常运行"
echo ""

# 获取测试用户token
echo "2. 获取测试用户token..."
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test123"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ 无法获取token，请检查测试用户是否存在"
    exit 1
fi
echo "✅ Token获取成功"
echo ""

# 测试简书登录
echo "3. 开始测试简书登录..."
echo "   提示：请在浏览器窗口中完成登录操作"
echo "   - 扫码或输入账号密码登录"
echo "   - 登录成功后会自动保存Cookie和用户信息"
echo ""

# 调用登录测试API
curl -X POST http://localhost:3001/api/accounts/test-login \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "platformId": "jianshu",
    "accountName": "简书测试账号"
  }'

echo ""
echo ""
echo "=========================================="
echo "测试完成"
echo "=========================================="
echo ""
echo "如果登录成功，你应该看到："
echo "  ✅ 账号信息已保存"
echo "  ✅ 用户名已提取"
echo ""
echo "如果登录失败，请检查："
echo "  1. 是否在浏览器中完成了登录操作"
echo "  2. 登录后是否跳转到了简书首页"
echo "  3. 查看后端日志中的详细错误信息"
echo ""
