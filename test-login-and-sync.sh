#!/bin/bash

echo "=========================================="
echo "测试登录和实时同步功能"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 服务器地址
API_URL="http://localhost:3000"

echo "1. 测试登录功能..."
echo "-------------------------------------------"

# 登录
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

echo "登录响应: $LOGIN_RESPONSE"
echo ""

# 提取token
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
REFRESH_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"refreshToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ 登录失败！${NC}"
  exit 1
else
  echo -e "${GREEN}✅ 登录成功！${NC}"
  echo "Token: ${TOKEN:0:20}..."
  echo ""
fi

echo "2. 测试获取账号列表..."
echo "-------------------------------------------"

ACCOUNTS_RESPONSE=$(curl -s -X GET "$API_URL/api/publishing/accounts" \
  -H "Authorization: Bearer $TOKEN")

echo "账号列表响应: $ACCOUNTS_RESPONSE"
echo ""

# 统计账号数量
ACCOUNT_COUNT=$(echo $ACCOUNTS_RESPONSE | grep -o '"id":[0-9]*' | wc -l)
echo -e "${GREEN}✅ 当前账号数量: $ACCOUNT_COUNT${NC}"
echo ""

echo "3. 测试创建测试账号..."
echo "-------------------------------------------"

CREATE_RESPONSE=$(curl -s -X POST "$API_URL/api/publishing/accounts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "platform_id": "douyin",
    "account_name": "test_sync_account",
    "credentials": {
      "username": "test_sync_account",
      "password": "test123",
      "cookies": "test_cookies"
    },
    "real_username": "test_sync_account"
  }')

echo "创建响应: $CREATE_RESPONSE"
echo ""

# 提取新账号ID
NEW_ACCOUNT_ID=$(echo $CREATE_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -z "$NEW_ACCOUNT_ID" ]; then
  echo -e "${RED}❌ 创建账号失败！${NC}"
else
  echo -e "${GREEN}✅ 创建账号成功！ID: $NEW_ACCOUNT_ID${NC}"
  echo ""
  
  echo "4. 等待3秒后删除账号..."
  echo "-------------------------------------------"
  sleep 3
  
  echo "5. 测试删除账号（应该触发WebSocket广播）..."
  echo "-------------------------------------------"
  
  DELETE_RESPONSE=$(curl -s -X DELETE "$API_URL/api/publishing/accounts/$NEW_ACCOUNT_ID" \
    -H "Authorization: Bearer $TOKEN")
  
  echo "删除响应: $DELETE_RESPONSE"
  echo ""
  
  if echo $DELETE_RESPONSE | grep -q '"success":true'; then
    echo -e "${GREEN}✅ 删除账号成功！${NC}"
    echo -e "${YELLOW}💡 请检查网页端是否收到实时更新${NC}"
  else
    echo -e "${RED}❌ 删除账号失败！${NC}"
  fi
fi

echo ""
echo "6. 测试Token刷新..."
echo "-------------------------------------------"

REFRESH_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")

echo "刷新响应: $REFRESH_RESPONSE"
echo ""

if echo $REFRESH_RESPONSE | grep -q '"token"'; then
  echo -e "${GREEN}✅ Token刷新成功！${NC}"
else
  echo -e "${RED}❌ Token刷新失败！${NC}"
fi

echo ""
echo "=========================================="
echo "测试完成！"
echo "=========================================="
echo ""
echo "下一步："
echo "1. 打开浏览器访问 http://localhost:5173"
echo "2. 使用 admin/admin123 登录"
echo "3. 打开开发者工具查看WebSocket连接"
echo "4. 再次运行此脚本，观察网页端是否实时更新"
echo ""
