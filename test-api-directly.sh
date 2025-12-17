#!/bin/bash

echo "======================================"
echo "直接测试浏览器登录API"
echo "======================================"
echo ""

echo "⚠️  警告：这将打开Chrome浏览器！"
echo ""
read -p "按回车键继续，或按Ctrl+C取消..."
echo ""

echo "测试知乎登录（最简单）..."
echo ""

curl -X POST http://localhost:3000/api/publishing/browser-login \
  -H "Content-Type: application/json" \
  -d '{"platform_id":"zhihu"}' \
  -v

echo ""
echo ""
echo "======================================"
echo "测试完成"
echo "======================================"
echo ""
echo "请检查："
echo "1. Chrome是否打开了知乎登录页面"
echo "2. 登录后Chrome是否自动关闭"
echo "3. 上面的响应中是否有 success: true"
echo "4. 运行以下命令检查数据库："
echo "   psql -d geo_system -c \"SELECT * FROM platform_accounts;\""
