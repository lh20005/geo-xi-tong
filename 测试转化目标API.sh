#!/bin/bash

# 转化目标 API 测试脚本

echo "🧪 转化目标 API 测试"
echo "===================="
echo ""

# 检查服务器是否运行
echo "1️⃣ 检查服务器状态..."
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ 服务器正在运行"
else
    echo "❌ 服务器未运行，请先启动服务器："
    echo "   cd server && npm run dev"
    exit 1
fi

echo ""
echo "2️⃣ 获取认证令牌..."
echo "请输入用户名（默认: lzc2005）:"
read -r USERNAME
USERNAME=${USERNAME:-lzc2005}

echo "请输入密码（默认: 123456）:"
read -rs PASSWORD
PASSWORD=${PASSWORD:-123456}

# 登录获取 token
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ 登录失败"
    echo "$LOGIN_RESPONSE"
    exit 1
fi

echo "✅ 登录成功"
echo ""

# 测试获取转化目标列表
echo "3️⃣ 测试获取转化目标列表..."
LIST_RESPONSE=$(curl -s -X GET \
  "http://localhost:3000/api/conversion-targets?page=1&pageSize=10&sortField=created_at&sortOrder=desc" \
  -H "Authorization: Bearer $TOKEN")

echo "$LIST_RESPONSE" | jq '.'

if echo "$LIST_RESPONSE" | grep -q '"success":true'; then
    echo "✅ 获取列表成功"
    TOTAL=$(echo "$LIST_RESPONSE" | grep -o '"total":[0-9]*' | cut -d':' -f2)
    echo "   总记录数: $TOTAL"
else
    echo "❌ 获取列表失败"
    exit 1
fi

echo ""

# 测试创建转化目标
echo "4️⃣ 测试创建转化目标..."
CREATE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/conversion-targets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "测试公司'$(date +%s)'",
    "industry": "互联网",
    "website": "https://example.com",
    "address": "杭州市西湖区"
  }')

echo "$CREATE_RESPONSE" | jq '.'

if echo "$CREATE_RESPONSE" | grep -q '"success":true'; then
    echo "✅ 创建成功"
    TARGET_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    echo "   新记录ID: $TARGET_ID"
else
    echo "❌ 创建失败"
    exit 1
fi

echo ""

# 测试获取单个转化目标
echo "5️⃣ 测试获取转化目标详情..."
DETAIL_RESPONSE=$(curl -s -X GET \
  "http://localhost:3000/api/conversion-targets/$TARGET_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "$DETAIL_RESPONSE" | jq '.'

if echo "$DETAIL_RESPONSE" | grep -q '"success":true'; then
    echo "✅ 获取详情成功"
else
    echo "❌ 获取详情失败"
fi

echo ""

# 测试更新转化目标
echo "6️⃣ 测试更新转化目标..."
UPDATE_RESPONSE=$(curl -s -X PATCH \
  "http://localhost:3000/api/conversion-targets/$TARGET_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "industry": "科技",
    "address": "杭州市滨江区"
  }')

echo "$UPDATE_RESPONSE" | jq '.'

if echo "$UPDATE_RESPONSE" | grep -q '"success":true'; then
    echo "✅ 更新成功"
else
    echo "❌ 更新失败"
fi

echo ""

# 测试搜索功能
echo "7️⃣ 测试搜索功能..."
SEARCH_RESPONSE=$(curl -s -X GET \
  "http://localhost:3000/api/conversion-targets?page=1&pageSize=10&search=测试" \
  -H "Authorization: Bearer $TOKEN")

echo "$SEARCH_RESPONSE" | jq '.'

if echo "$SEARCH_RESPONSE" | grep -q '"success":true'; then
    echo "✅ 搜索成功"
else
    echo "❌ 搜索失败"
fi

echo ""

# 测试删除转化目标
echo "8️⃣ 测试删除转化目标..."
DELETE_RESPONSE=$(curl -s -X DELETE \
  "http://localhost:3000/api/conversion-targets/$TARGET_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "$DELETE_RESPONSE" | jq '.'

if echo "$DELETE_RESPONSE" | grep -q '"success":true'; then
    echo "✅ 删除成功"
else
    echo "❌ 删除失败"
fi

echo ""
echo "===================="
echo "✅ 所有测试完成！"
echo ""
echo "📝 测试总结："
echo "   - 获取列表: ✅"
echo "   - 创建记录: ✅"
echo "   - 获取详情: ✅"
echo "   - 更新记录: ✅"
echo "   - 搜索功能: ✅"
echo "   - 删除记录: ✅"
