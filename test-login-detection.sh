#!/bin/bash

echo "======================================"
echo "测试平台登录检测"
echo "======================================"
echo ""

# 检查编译
echo "1. 检查代码编译..."
if grep -q "hasCookies" server/dist/services/AccountService.js; then
    echo "✅ 新的检测逻辑已编译"
else
    echo "❌ 新的检测逻辑未编译"
    echo "   请运行: cd server && npm run build"
    exit 1
fi

# 检查服务器
echo ""
echo "2. 检查服务器状态..."
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ 服务器正在运行"
else
    echo "❌ 服务器未运行"
    echo "   请运行: cd server && npm start"
    exit 1
fi

echo ""
echo "======================================"
echo "测试方式"
echo "======================================"
echo ""
echo "【方式1：正常测试】"
echo "1. 打开前端：http://localhost:5173"
echo "2. 进入「平台登录」页面"
echo "3. 点击「抖音」平台"
echo "4. 在浏览器中完成登录"
echo "5. 观察是否保存登录信息"
echo ""
echo "【方式2：使用诊断工具】"
echo "运行: node diagnose-douyin-login.js"
echo ""
echo "诊断工具会："
echo "  • 打开浏览器"
echo "  • 每5秒检测URL和Cookie"
echo "  • 显示详细的检测信息"
echo "  • 帮助你了解登录过程"
echo ""
echo "======================================"
echo "优化内容"
echo "======================================"
echo ""
echo "检测条件已放宽："
echo "  • 原来：URL路径 AND Cookie名称（必须同时满足）"
echo "  • 现在：URL路径 OR (Cookie名称 AND Cookie数量>500)"
echo ""
echo "新增Cookie检查："
echo "  • 抖音：passport_csrf_token, odin_tt"
echo "  • 小红书：xhsTrackerId"
echo "  • B站：DedeUserID"
echo ""
echo "======================================"
echo "查看日志"
echo "======================================"
echo ""
echo "实时查看："
echo "  tail -f server/logs/app.log | grep '抖音'"
echo ""
echo "搜索历史："
echo "  grep '抖音登录检测' server/logs/app.log"
echo ""
echo "预期日志："
echo "  [抖音登录检测] { url: '...', hasValidPath: true, hasCookies: true, ... }"
echo "  [等待登录] 抖音登录成功"
echo "  [浏览器登录] 账号保存成功"
echo ""
