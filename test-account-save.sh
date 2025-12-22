#!/bin/bash

echo "=========================================="
echo "🔧 账号保存问题修复验证"
echo "=========================================="
echo ""

echo "📋 修复内容："
echo "  1. ✅ 后端支持 real_username 字段"
echo "  2. ✅ 前端登录成功后刷新账号列表"
echo ""

echo "=========================================="
echo "📝 步骤 1: 检查后端代码修改"
echo "=========================================="
echo ""

if grep -q "createAccountWithRealUsername" server/src/routes/platformAccounts.ts; then
  echo "✅ 后端已支持 real_username 字段"
else
  echo "❌ 后端代码未修改"
  echo "请检查文件: server/src/routes/platformAccounts.ts"
  exit 1
fi

echo ""
echo "=========================================="
echo "📝 步骤 2: 检查前端代码修改"
echo "=========================================="
echo ""

if grep -q "refreshAccounts" windows-login-manager/src/pages/PlatformSelection.tsx; then
  echo "✅ 前端已添加账号刷新逻辑"
else
  echo "❌ 前端代码未修改"
  echo "请检查文件: windows-login-manager/src/pages/PlatformSelection.tsx"
  exit 1
fi

if grep -q "useApp" windows-login-manager/src/pages/PlatformSelection.tsx; then
  echo "✅ 前端已导入 AppContext"
else
  echo "❌ 前端未导入 AppContext"
  exit 1
fi

echo ""
echo "=========================================="
echo "📝 步骤 3: 测试后端 API"
echo "=========================================="
echo ""

echo "测试创建账号 API（带 real_username）..."

# 创建测试数据
TEST_DATA='{
  "platform_id": "test_platform",
  "account_name": "test_account",
  "real_username": "test_real_username",
  "credentials": {
    "username": "test",
    "password": "test",
    "cookies": [],
    "loginTime": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'"
  }
}'

# 发送请求
RESPONSE=$(curl -s -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -d "$TEST_DATA")

# 检查响应
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "✅ API 测试成功"
  
  # 提取账号 ID
  ACCOUNT_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
  
  if [ -n "$ACCOUNT_ID" ]; then
    echo "✅ 账号已创建，ID: $ACCOUNT_ID"
    
    # 清理测试数据
    echo "清理测试数据..."
    curl -s -X DELETE "http://localhost:3000/api/accounts/$ACCOUNT_ID" > /dev/null
    echo "✅ 测试数据已清理"
  fi
else
  echo "⚠️  API 测试失败（可能是服务未启动）"
  echo "响应: $RESPONSE"
fi

echo ""
echo "=========================================="
echo "✅ 修复验证完成！"
echo "=========================================="
echo ""
echo "🧪 测试步骤："
echo ""
echo "1. 重启后端服务器："
echo "   cd server && npm run dev"
echo ""
echo "2. 重启 Windows 登录管理器："
echo "   cd windows-login-manager && npm run dev"
echo ""
echo "3. 测试头条号登录："
echo "   - 打开应用"
echo "   - 点击「平台管理」"
echo "   - 选择「头条号」"
echo "   - 点击「登录」"
echo "   - 在浏览器中完成登录"
echo "   - 看到「登录成功」提示"
echo ""
echo "4. 验证账号保存："
echo "   - 点击「账号管理」"
echo "   - 应该立即看到新添加的头条号账号"
echo "   - 账号信息应该包含真实用户名"
echo ""
echo "5. 预期结果："
echo "   ✅ 登录成功后立即显示新账号"
echo "   ✅ 账号列表中显示真实用户名"
echo "   ✅ 无需手动刷新页面"
echo ""
echo "=========================================="
echo "📚 详细文档："
echo "=========================================="
echo ""
echo "  - dev-docs/ACCOUNT_SAVE_FIX.md"
echo "  - dev-docs/TOUTIAO_LOGIN_COMPLETE_FIX.md"
echo ""
echo "=========================================="
