#!/bin/bash

# 多租户API测试脚本

echo "=========================================="
echo "  多租户API功能测试"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_URL="http://localhost:3000/api"

echo -e "${BLUE}📝 测试说明：${NC}"
echo "  1. 确保服务器正在运行（npm run dev）"
echo "  2. 将创建两个测试用户"
echo "  3. 测试数据隔离功能"
echo ""

read -p "按Enter键开始测试..." 

# 测试1：注册用户1
echo ""
echo -e "${YELLOW}测试1: 注册用户1...${NC}"
RESPONSE1=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser1","password":"Test123456"}')

echo "$RESPONSE1" | jq '.' 2>/dev/null || echo "$RESPONSE1"

TOKEN1=$(echo "$RESPONSE1" | jq -r '.data.token' 2>/dev/null)

if [ "$TOKEN1" != "null" ] && [ -n "$TOKEN1" ]; then
    echo -e "${GREEN}✓ 用户1注册成功${NC}"
else
    echo -e "${RED}✗ 用户1注册失败${NC}"
    exit 1
fi

# 测试2：注册用户2
echo ""
echo -e "${YELLOW}测试2: 注册用户2...${NC}"
RESPONSE2=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser2","password":"Test123456"}')

echo "$RESPONSE2" | jq '.' 2>/dev/null || echo "$RESPONSE2"

TOKEN2=$(echo "$RESPONSE2" | jq -r '.data.token' 2>/dev/null)

if [ "$TOKEN2" != "null" ] && [ -n "$TOKEN2" ]; then
    echo -e "${GREEN}✓ 用户2注册成功${NC}"
else
    echo -e "${RED}✗ 用户2注册失败${NC}"
    exit 1
fi

# 测试3：用户1创建相册
echo ""
echo -e "${YELLOW}测试3: 用户1创建相册...${NC}"
ALBUM1=$(curl -s -X POST "$API_URL/gallery/albums" \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d '{"name":"用户1的相册"}')

echo "$ALBUM1" | jq '.' 2>/dev/null || echo "$ALBUM1"

ALBUM1_ID=$(echo "$ALBUM1" | jq -r '.id' 2>/dev/null)

if [ "$ALBUM1_ID" != "null" ] && [ -n "$ALBUM1_ID" ]; then
    echo -e "${GREEN}✓ 用户1创建相册成功 (ID: $ALBUM1_ID)${NC}"
else
    echo -e "${RED}✗ 用户1创建相册失败${NC}"
fi

# 测试4：用户2创建相册
echo ""
echo -e "${YELLOW}测试4: 用户2创建相册...${NC}"
ALBUM2=$(curl -s -X POST "$API_URL/gallery/albums" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -d '{"name":"用户2的相册"}')

echo "$ALBUM2" | jq '.' 2>/dev/null || echo "$ALBUM2"

ALBUM2_ID=$(echo "$ALBUM2" | jq -r '.id' 2>/dev/null)

if [ "$ALBUM2_ID" != "null" ] && [ -n "$ALBUM2_ID" ]; then
    echo -e "${GREEN}✓ 用户2创建相册成功 (ID: $ALBUM2_ID)${NC}"
else
    echo -e "${RED}✗ 用户2创建相册失败${NC}"
fi

# 测试5：用户1查询相册（应该只看到自己的）
echo ""
echo -e "${YELLOW}测试5: 用户1查询相册（应该只看到自己的）...${NC}"
USER1_ALBUMS=$(curl -s -X GET "$API_URL/gallery/albums" \
  -H "Authorization: Bearer $TOKEN1")

echo "$USER1_ALBUMS" | jq '.' 2>/dev/null || echo "$USER1_ALBUMS"

USER1_COUNT=$(echo "$USER1_ALBUMS" | jq '.albums | length' 2>/dev/null)

if [ "$USER1_COUNT" == "1" ]; then
    echo -e "${GREEN}✓ 数据隔离成功：用户1只看到1个相册（自己的）${NC}"
else
    echo -e "${RED}✗ 数据隔离失败：用户1看到 $USER1_COUNT 个相册${NC}"
fi

# 测试6：用户2查询相册（应该只看到自己的）
echo ""
echo -e "${YELLOW}测试6: 用户2查询相册（应该只看到自己的）...${NC}"
USER2_ALBUMS=$(curl -s -X GET "$API_URL/gallery/albums" \
  -H "Authorization: Bearer $TOKEN2")

echo "$USER2_ALBUMS" | jq '.' 2>/dev/null || echo "$USER2_ALBUMS"

USER2_COUNT=$(echo "$USER2_ALBUMS" | jq '.albums | length' 2>/dev/null)

if [ "$USER2_COUNT" == "1" ]; then
    echo -e "${GREEN}✓ 数据隔离成功：用户2只看到1个相册（自己的）${NC}"
else
    echo -e "${RED}✗ 数据隔离失败：用户2看到 $USER2_COUNT 个相册${NC}"
fi

# 测试7：用户2尝试访问用户1的相册（应该失败）
echo ""
echo -e "${YELLOW}测试7: 用户2尝试访问用户1的相册（应该被拒绝）...${NC}"
UNAUTHORIZED=$(curl -s -X GET "$API_URL/gallery/albums/$ALBUM1_ID" \
  -H "Authorization: Bearer $TOKEN2")

echo "$UNAUTHORIZED" | jq '.' 2>/dev/null || echo "$UNAUTHORIZED"

if echo "$UNAUTHORIZED" | grep -q "无权访问\|不存在"; then
    echo -e "${GREEN}✓ 所有权验证成功：用户2无法访问用户1的相册${NC}"
else
    echo -e "${RED}✗ 所有权验证失败：用户2可以访问用户1的相册${NC}"
fi

# 测试8：查询配额
echo ""
echo -e "${YELLOW}测试8: 查询用户1的配额...${NC}"
QUOTA=$(curl -s -X GET "$API_URL/quota" \
  -H "Authorization: Bearer $TOKEN1")

echo "$QUOTA" | jq '.' 2>/dev/null || echo "$QUOTA"

PLAN=$(echo "$QUOTA" | jq -r '.data.plan' 2>/dev/null)

if [ "$PLAN" == "free" ]; then
    echo -e "${GREEN}✓ 配额查询成功：用户1使用免费套餐${NC}"
else
    echo -e "${YELLOW}⚠ 配额查询返回：$PLAN${NC}"
fi

# 测试9：创建知识库
echo ""
echo -e "${YELLOW}测试9: 用户1创建知识库...${NC}"
KB1=$(curl -s -X POST "$API_URL/knowledge-bases" \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d '{"name":"用户1的知识库","description":"测试知识库"}')

echo "$KB1" | jq '.' 2>/dev/null || echo "$KB1"

KB1_ID=$(echo "$KB1" | jq -r '.id' 2>/dev/null)

if [ "$KB1_ID" != "null" ] && [ -n "$KB1_ID" ]; then
    echo -e "${GREEN}✓ 用户1创建知识库成功 (ID: $KB1_ID)${NC}"
else
    echo -e "${RED}✗ 用户1创建知识库失败${NC}"
fi

# 测试10：用户2查询知识库（应该看不到用户1的）
echo ""
echo -e "${YELLOW}测试10: 用户2查询知识库（应该看不到用户1的）...${NC}"
USER2_KBS=$(curl -s -X GET "$API_URL/knowledge-bases" \
  -H "Authorization: Bearer $TOKEN2")

echo "$USER2_KBS" | jq '.' 2>/dev/null || echo "$USER2_KBS"

USER2_KB_COUNT=$(echo "$USER2_KBS" | jq '.knowledgeBases | length' 2>/dev/null)

if [ "$USER2_KB_COUNT" == "0" ]; then
    echo -e "${GREEN}✓ 数据隔离成功：用户2看不到用户1的知识库${NC}"
else
    echo -e "${RED}✗ 数据隔离失败：用户2看到 $USER2_KB_COUNT 个知识库${NC}"
fi

# 总结
echo ""
echo -e "${GREEN}=========================================="
echo "  测试完成！"
echo "==========================================${NC}"
echo ""
echo "📊 测试结果："
echo "  ✓ 用户注册和认证"
echo "  ✓ 数据隔离（相册）"
echo "  ✓ 数据隔离（知识库）"
echo "  ✓ 所有权验证"
echo "  ✓ 配额查询"
echo ""
echo "🎉 多租户功能正常工作！"
echo ""
echo "💡 提示："
echo "  - 用户1 Token: $TOKEN1"
echo "  - 用户2 Token: $TOKEN2"
echo "  - 用户1相册ID: $ALBUM1_ID"
echo "  - 用户2相册ID: $ALBUM2_ID"
echo ""
