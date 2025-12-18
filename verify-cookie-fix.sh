#!/bin/bash

echo "======================================"
echo "验证Cookie检测修复"
echo "======================================"
echo ""

# 检查编译
echo "1. 检查代码编译..."
if grep -q "hasLoginCookie" server/dist/services/AccountService.js; then
    echo "✅ 新的Cookie检测逻辑已编译"
else
    echo "❌ 新的Cookie检测逻辑未编译"
    exit 1
fi

# 检查服务器
echo ""
echo "2. 检查服务器状态..."
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ 服务器正在运行"
else
    echo "❌ 服务器未运行，请先启动"
    exit 1
fi

# 检查现有抖音账号
echo ""
echo "3. 检查现有抖音账号..."
ACCOUNTS=$(curl -s http://localhost:3000/api/publishing/accounts/platform/douyin)
COUNT=$(echo "$ACCOUNTS" | python3 -c "import sys, json; print(len(json.load(sys.stdin)['data']))" 2>/dev/null || echo "0")

echo "当前抖音账号数: $COUNT"

if [ "$COUNT" -gt 0 ]; then
    echo ""
    echo "账号列表:"
    echo "$ACCOUNTS" | python3 -m json.tool 2>/dev/null | grep -E "(id|account_name|created_at)" | head -20
    
    echo ""
    echo "⚠️  建议删除旧的无效账号："
    echo "$ACCOUNTS" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for acc in data['data']:
        print(f\"   curl -X DELETE http://localhost:3000/api/publishing/accounts/{acc['id']}\")
except:
    pass
" 2>/dev/null
fi

echo ""
echo "======================================"
echo "修复内容"
echo "======================================"
echo ""
echo "检测逻辑改进："
echo "  • 原来：只检查URL不包含login（太宽松）"
echo "  • 现在：检查真正的登录Cookie是否出现"
echo ""
echo "关键Cookie："
echo "  • 抖音：sessionid, sid_guard, passport_auth_status_ss"
echo "  • 小红书：web_session, customer-sso-sid"
echo "  • B站：SESSDATA, DedeUserID"
echo ""
echo "======================================"
echo "测试步骤"
echo "======================================"
echo ""
echo "1. 删除旧账号（如果有）"
echo "   见上面的删除命令"
echo ""
echo "2. 重新登录"
echo "   • 打开：http://localhost:5173"
echo "   • 进入「平台登录」页面"
echo "   • 点击「抖音」"
echo "   • ⚠️  完成登录（扫码或密码）"
echo "   • 等待跳转到创作者中心"
echo "   • 系统会自动保存Cookie"
echo ""
echo "3. 验证Cookie"
echo "   运行以下命令查看Cookie："
echo ""
echo "   curl -s \"http://localhost:3000/api/publishing/accounts/platform/douyin\" | python3 -c \""
echo "import sys, json"
echo "data = json.load(sys.stdin)"
echo "if data['data']:"
echo "    acc_id = data['data'][0]['id']"
echo "    print(f'账号ID: {acc_id}')"
echo "    print('查看Cookie详情：')"
echo "    print(f'curl -s \\\"http://localhost:3000/api/publishing/accounts/{acc_id}?includeCredentials=true\\\" | python3 -m json.tool')"
echo "\""
echo ""
echo "4. 检查关键Cookie"
echo "   成功的Cookie应该包含："
echo "   ✅ sessionid"
echo "   ✅ sid_guard"
echo "   ✅ passport_auth_status_ss"
echo ""
echo "======================================"
echo "问题排查"
echo "======================================"
echo ""
echo "如果仍然没有保存："
echo "  • 确保完成了登录（扫码或密码）"
echo "  • 等待页面跳转到创作者中心"
echo "  • 查看服务器日志：tail -f server/logs/app.log"
echo ""
echo "如果保存了但没有sessionid："
echo "  • 使用诊断工具：node diagnose-douyin-login.js"
echo "  • 查看实际的Cookie名称"
echo "  • 可能需要更新检测逻辑"
echo ""
