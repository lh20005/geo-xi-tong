#!/bin/bash

echo "======================================"
echo "平台登录功能诊断"
echo "======================================"
echo ""

# 检查后端服务
echo "1. 检查后端服务（端口3000）..."
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "✅ 后端服务正在运行"
    echo "   进程信息:"
    lsof -Pi :3000 -sTCP:LISTEN | head -2
else
    echo "❌ 后端服务未运行"
    echo "   请运行: cd server && npm run dev"
    exit 1
fi
echo ""

# 检查前端服务
echo "2. 检查前端服务（端口5173）..."
if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "✅ 前端服务正在运行"
    echo "   进程信息:"
    lsof -Pi :5173 -sTCP:LISTEN | head -2
else
    echo "❌ 前端服务未运行"
    echo "   请运行: cd client && npm run dev"
    exit 1
fi
echo ""

# 测试后端API
echo "3. 测试后端API..."
echo "   测试: GET http://localhost:3000/api/publishing/platforms"
RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:3000/api/publishing/platforms)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ 平台列表API正常"
    echo "   返回数据:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
    echo "❌ 平台列表API失败 (HTTP $HTTP_CODE)"
    echo "   响应:"
    echo "$BODY"
    exit 1
fi
echo ""

# 测试账号列表API
echo "4. 测试账号列表API..."
echo "   测试: GET http://localhost:3000/api/publishing/accounts"
RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:3000/api/publishing/accounts)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ 账号列表API正常"
    echo "   返回数据:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
    echo "❌ 账号列表API失败 (HTTP $HTTP_CODE)"
    echo "   响应:"
    echo "$BODY"
    exit 1
fi
echo ""

# 检查Puppeteer
echo "5. 检查Puppeteer安装..."
cd server
if npm list puppeteer >/dev/null 2>&1; then
    echo "✅ Puppeteer已安装"
    npm list puppeteer | grep puppeteer
else
    echo "❌ Puppeteer未安装"
    echo "   请运行: cd server && npm install puppeteer"
    exit 1
fi
cd ..
echo ""

# 检查数据库表
echo "6. 检查数据库表..."
echo "   检查 platforms_config 表..."
RESULT=$(psql -d geo_system -t -c "SELECT COUNT(*) FROM platforms_config;" 2>&1)
if [ $? -eq 0 ]; then
    echo "✅ platforms_config 表存在，记录数: $RESULT"
else
    echo "❌ platforms_config 表不存在或数据库连接失败"
    echo "   错误: $RESULT"
    echo "   请运行: cd server && npm run migrate:publishing"
    exit 1
fi

echo "   检查 platform_accounts 表..."
RESULT=$(psql -d geo_system -t -c "SELECT COUNT(*) FROM platform_accounts;" 2>&1)
if [ $? -eq 0 ]; then
    echo "✅ platform_accounts 表存在，记录数: $RESULT"
else
    echo "❌ platform_accounts 表不存在"
    echo "   错误: $RESULT"
    exit 1
fi
echo ""

echo "======================================"
echo "✅ 所有检查通过！"
echo "======================================"
echo ""
echo "现在可以测试浏览器登录功能："
echo "1. 打开浏览器访问: http://localhost:5173"
echo "2. 点击左侧菜单的【平台登录】"
echo "3. 点击任意平台卡片"
echo "4. 应该会打开浏览器窗口"
echo ""
echo "如果仍然无法打开浏览器，请查看："
echo "- 浏览器控制台（F12）的错误信息"
echo "- 后端终端的日志输出"
