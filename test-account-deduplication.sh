#!/bin/bash

echo "=========================================="
echo "🔧 账号去重功能测试"
echo "=========================================="
echo ""

echo "📋 功能说明："
echo "  - 同一账号只保存一条记录"
echo "  - 重复登录时更新凭证，而不是创建新记录"
echo "  - 使用 platform_id + real_username 作为唯一标识"
echo ""

echo "=========================================="
echo "📝 步骤 1: 清理现有重复账号"
echo "=========================================="
echo ""

cd server
npx ts-node src/db/cleanup-duplicate-accounts.ts

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ 重复账号清理完成"
else
  echo ""
  echo "❌ 清理失败"
  exit 1
fi

cd ..

echo ""
echo "=========================================="
echo "📝 步骤 2: 测试去重 API"
echo "=========================================="
echo ""

echo "测试 1: 创建新账号..."
RESPONSE1=$(curl -s -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "platform_id": "test_dedup",
    "account_name": "test_user",
    "real_username": "test_user",
    "credentials": {
      "username": "test",
      "password": "test",
      "cookies": [],
      "loginTime": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'"
    }
  }')

if echo "$RESPONSE1" | grep -q '"isNew":true'; then
  echo "✅ 测试 1 通过：成功创建新账号"
  ACCOUNT_ID=$(echo "$RESPONSE1" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
  echo "   账号 ID: $ACCOUNT_ID"
else
  echo "❌ 测试 1 失败"
  echo "   响应: $RESPONSE1"
fi

echo ""
echo "测试 2: 重复登录同一账号（应该更新而不是创建）..."
sleep 1

RESPONSE2=$(curl -s -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "platform_id": "test_dedup",
    "account_name": "test_user",
    "real_username": "test_user",
    "credentials": {
      "username": "test",
      "password": "test_updated",
      "cookies": [],
      "loginTime": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'"
    }
  }')

if echo "$RESPONSE2" | grep -q '"isNew":false'; then
  echo "✅ 测试 2 通过：成功更新现有账号（未创建新记录）"
  UPDATED_ID=$(echo "$RESPONSE2" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
  echo "   账号 ID: $UPDATED_ID"
  
  if [ "$ACCOUNT_ID" = "$UPDATED_ID" ]; then
    echo "   ✅ ID 一致，确认是更新而不是新建"
  else
    echo "   ❌ ID 不一致，可能创建了新记录"
  fi
else
  echo "❌ 测试 2 失败"
  echo "   响应: $RESPONSE2"
fi

echo ""
echo "测试 3: 登录不同账号（应该创建新记录）..."
sleep 1

RESPONSE3=$(curl -s -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "platform_id": "test_dedup",
    "account_name": "another_user",
    "real_username": "another_user",
    "credentials": {
      "username": "another",
      "password": "test",
      "cookies": [],
      "loginTime": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'"
    }
  }')

if echo "$RESPONSE3" | grep -q '"isNew":true'; then
  echo "✅ 测试 3 通过：成功创建不同的账号"
  ANOTHER_ID=$(echo "$RESPONSE3" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
  echo "   账号 ID: $ANOTHER_ID"
else
  echo "❌ 测试 3 失败"
  echo "   响应: $RESPONSE3"
fi

echo ""
echo "清理测试数据..."
if [ -n "$ACCOUNT_ID" ]; then
  curl -s -X DELETE "http://localhost:3000/api/accounts/$ACCOUNT_ID" > /dev/null
fi
if [ -n "$ANOTHER_ID" ]; then
  curl -s -X DELETE "http://localhost:3000/api/accounts/$ANOTHER_ID" > /dev/null
fi
echo "✅ 测试数据已清理"

echo ""
echo "=========================================="
echo "✅ 测试完成！"
echo "=========================================="
echo ""
echo "🧪 手动测试步骤："
echo ""
echo "1. 重启后端服务器："
echo "   cd server && npm run dev"
echo ""
echo "2. 重启 Windows 登录管理器："
echo "   cd windows-login-manager && npm run dev"
echo ""
echo "3. 测试头条号登录："
echo "   - 第一次登录：应该创建新账号"
echo "   - 第二次登录：应该更新现有账号（不创建新的）"
echo "   - 检查账号列表：应该只有一个头条号账号"
echo ""
echo "4. 预期结果："
echo "   ✅ 同一账号只有一条记录"
echo "   ✅ updated_at 和 last_used_at 更新为最新时间"
echo "   ✅ 凭证（Cookie）已更新"
echo ""
echo "=========================================="
echo "📚 详细文档："
echo "=========================================="
echo ""
echo "  - dev-docs/ACCOUNT_DEDUPLICATION_FIX.md"
echo ""
echo "=========================================="
