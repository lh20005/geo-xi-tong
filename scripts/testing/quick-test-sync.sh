#!/bin/bash

echo "=========================================="
echo "快速测试 Windows端 → 网页端 实时同步"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}📋 测试前准备：${NC}"
echo "1. 确保网页端已登录（http://localhost:5173）"
echo "2. 确保Windows端已登录"
echo "3. 网页端打开"平台管理"页面"
echo "4. 网页端打开开发者工具 Console (F12)"
echo ""
echo -e "${YELLOW}按 Enter 继续...${NC}"
read

echo ""
echo "🚀 创建测试账号..."

# 登录获取token
TOKEN=$(curl -s -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | \
  grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ 无法获取token，请确保服务端正常运行"
  exit 1
fi

# 创建测试账号
RESPONSE=$(curl -s -X POST "http://localhost:3000/api/publishing/accounts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "platform_id": "douyin",
    "account_name": "sync_test_account",
    "credentials": {
      "username": "sync_test",
      "password": "test123"
    },
    "real_username": "sync_test_account"
  }')

ACCOUNT_ID=$(echo $RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -z "$ACCOUNT_ID" ]; then
  echo "❌ 创建账号失败"
  exit 1
fi

echo -e "${GREEN}✅ 测试账号已创建 (ID: $ACCOUNT_ID)${NC}"
echo ""
echo -e "${YELLOW}👀 请观察网页端：${NC}"
echo "   - 应该看到新账号出现（sync_test_account）"
echo ""
echo -e "${YELLOW}按 Enter 继续删除测试...${NC}"
read

echo ""
echo "🗑️  删除测试账号..."

curl -s -X DELETE "http://localhost:3000/api/publishing/accounts/$ACCOUNT_ID" \
  -H "Authorization: Bearer $TOKEN" > /dev/null

echo -e "${GREEN}✅ 删除请求已发送${NC}"
echo ""
echo -e "${YELLOW}👀 请立即观察网页端：${NC}"
echo "   ✅ 账号应该立即消失"
echo "   ✅ 显示通知：账号已被删除"
echo "   ✅ Console显示：[WebSocket] 收到账号删除事件"
echo "   ✅ 无需刷新页面"
echo ""
echo "=========================================="
echo "测试完成！"
echo "=========================================="
echo ""
echo "如果网页端实时更新了，说明同步成功！🎉"
echo ""
