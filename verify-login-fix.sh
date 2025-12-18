#!/bin/bash

echo "======================================"
echo "验证平台登录修复"
echo "======================================"
echo ""

# 检查编译后的文件
echo "检查编译结果..."
if grep -q "hasValidPath" server/dist/services/AccountService.js; then
    echo "✅ 抖音登录修复已编译"
else
    echo "❌ 抖音登录修复未编译"
    exit 1
fi

if grep -q "小红书登录检测" server/dist/services/AccountService.js; then
    echo "✅ 小红书登录修复已编译"
else
    echo "❌ 小红书登录修复未编译"
    exit 1
fi

if grep -q "B站登录检测" server/dist/services/AccountService.js; then
    echo "✅ B站登录修复已编译"
else
    echo "❌ B站登录修复未编译"
    exit 1
fi

echo ""
echo "======================================"
echo "修复内容摘要"
echo "======================================"
echo ""
echo "已修复的平台："
echo "  1. 抖音 (douyin)"
echo "  2. 小红书 (xiaohongshu)"
echo "  3. B站 (bilibili)"
echo ""
echo "修复内容："
echo "  - 添加URL路径验证（必须跳转到登录后页面）"
echo "  - 添加Cookie验证（必须有有效的登录Cookie）"
echo "  - 双重验证确保真正登录成功"
echo ""
echo "======================================"
echo "下一步操作"
echo "======================================"
echo ""
echo "1. 重启服务器："
echo "   - 停止当前服务（如果正在运行）"
echo "   - cd server && npm start"
echo ""
echo "2. 清理旧账号（如果有）："
echo "   - 查看账号：curl http://localhost:3000/api/platform-accounts/platform/douyin"
echo "   - 删除账号：curl -X DELETE http://localhost:3000/api/platform-accounts/{id}"
echo ""
echo "3. 测试登录："
echo "   - 打开前端：http://localhost:5173"
echo "   - 进入「平台登录」页面"
echo "   - 测试抖音、小红书、B站登录"
echo ""
echo "4. 查看日志："
echo "   - tail -f server/logs/app.log | grep '等待登录'"
echo ""
