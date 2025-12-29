#!/bin/bash

# 多租户数据隔离测试脚本

BASE_URL="http://localhost:3001/api"

echo "🧪 多租户数据隔离测试"
echo "===================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试结果统计
PASSED=0
FAILED=0

# 测试函数
test_case() {
    local name=$1
    local result=$2
    
    if [ "$result" = "PASS" ]; then
        echo -e "${GREEN}✅ PASS${NC}: $name"
        ((PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC}: $name"
        ((FAILED++))
    fi
}

echo "步骤 1: 注册两个测试用户"
echo "------------------------"

# 注册用户1
USER1_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_user_1_'$(date +%s)'",
    "password": "Test123456"
  }')

USER1_TOKEN=$(echo $USER1_RESPONSE | jq -r '.data.token')
USER1_ID=$(echo $USER1_RESPONSE | jq -r '.data.user.id')

if [ "$USER1_TOKEN" != "null" ] && [ "$USER1_TOKEN" != "" ]; then
    echo -e "${GREEN}✅${NC} 用户1注册成功 (ID: $USER1_ID)"
else
    echo -e "${RED}❌${NC} 用户1注册失败"
    echo "响应: $USER1_RESPONSE"
    exit 1
fi

# 注册用户2
USER2_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_user_2_'$(date +%s)'",
    "password": "Test123456"
  }')

USER2_TOKEN=$(echo $USER2_RESPONSE | jq -r '.data.token')
USER2_ID=$(echo $USER2_RESPONSE | jq -r '.data.user.id')

if [ "$USER2_TOKEN" != "null" ] && [ "$USER2_TOKEN" != "" ]; then
    echo -e "${GREEN}✅${NC} 用户2注册成功 (ID: $USER2_ID)"
else
    echo -e "${RED}❌${NC} 用户2注册失败"
    echo "响应: $USER2_RESPONSE"
    exit 1
fi

echo ""
echo "步骤 2: 用户1创建数据"
echo "--------------------"

# 用户1创建转化目标
CT1_RESPONSE=$(curl -s -X POST "$BASE_URL/conversion-targets" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER1_TOKEN" \
  -d '{
    "companyName": "测试公司1_'$(date +%s)'",
    "industry": "科技"
  }')

CT1_ID=$(echo $CT1_RESPONSE | jq -r '.data.id')

if [ "$CT1_ID" != "null" ] && [ "$CT1_ID" != "" ]; then
    echo -e "${GREEN}✅${NC} 用户1创建转化目标成功 (ID: $CT1_ID)"
else
    echo -e "${RED}❌${NC} 用户1创建转化目标失败"
    echo "响应: $CT1_RESPONSE"
fi

echo ""
echo "步骤 3: 用户2创建数据"
echo "--------------------"

# 用户2创建转化目标
CT2_RESPONSE=$(curl -s -X POST "$BASE_URL/conversion-targets" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER2_TOKEN" \
  -d '{
    "companyName": "测试公司2_'$(date +%s)'",
    "industry": "金融"
  }')

CT2_ID=$(echo $CT2_RESPONSE | jq -r '.data.id')

if [ "$CT2_ID" != "null" ] && [ "$CT2_ID" != "" ]; then
    echo -e "${GREEN}✅${NC} 用户2创建转化目标成功 (ID: $CT2_ID)"
else
    echo -e "${RED}❌${NC} 用户2创建转化目标失败"
    echo "响应: $CT2_RESPONSE"
fi

echo ""
echo "步骤 4: 测试数据隔离"
echo "-------------------"

# 测试1: 用户1查看自己的数据
USER1_LIST=$(curl -s -X GET "$BASE_URL/conversion-targets" \
  -H "Authorization: Bearer $USER1_TOKEN")

USER1_COUNT=$(echo $USER1_LIST | jq -r '.data.total')
USER1_HAS_CT1=$(echo $USER1_LIST | jq -r ".data.targets[] | select(.id == $CT1_ID) | .id")
USER1_HAS_CT2=$(echo $USER1_LIST | jq -r ".data.targets[] | select(.id == $CT2_ID) | .id")

if [ "$USER1_HAS_CT1" = "$CT1_ID" ]; then
    test_case "用户1可以看到自己的数据" "PASS"
else
    test_case "用户1可以看到自己的数据" "FAIL"
fi

if [ "$USER1_HAS_CT2" = "" ] || [ "$USER1_HAS_CT2" = "null" ]; then
    test_case "用户1看不到用户2的数据" "PASS"
else
    test_case "用户1看不到用户2的数据" "FAIL"
    echo -e "${YELLOW}⚠️  警告: 数据隔离失败！用户1可以看到用户2的数据${NC}"
fi

# 测试2: 用户2查看自己的数据
USER2_LIST=$(curl -s -X GET "$BASE_URL/conversion-targets" \
  -H "Authorization: Bearer $USER2_TOKEN")

USER2_COUNT=$(echo $USER2_LIST | jq -r '.data.total')
USER2_HAS_CT1=$(echo $USER2_LIST | jq -r ".data.targets[] | select(.id == $CT1_ID) | .id")
USER2_HAS_CT2=$(echo $USER2_LIST | jq -r ".data.targets[] | select(.id == $CT2_ID) | .id")

if [ "$USER2_HAS_CT2" = "$CT2_ID" ]; then
    test_case "用户2可以看到自己的数据" "PASS"
else
    test_case "用户2可以看到自己的数据" "FAIL"
fi

if [ "$USER2_HAS_CT1" = "" ] || [ "$USER2_HAS_CT1" = "null" ]; then
    test_case "用户2看不到用户1的数据" "PASS"
else
    test_case "用户2看不到用户1的数据" "FAIL"
    echo -e "${YELLOW}⚠️  警告: 数据隔离失败！用户2可以看到用户1的数据${NC}"
fi

# 测试3: 用户1尝试访问用户2的数据
USER1_ACCESS_CT2=$(curl -s -X GET "$BASE_URL/conversion-targets/$CT2_ID" \
  -H "Authorization: Bearer $USER1_TOKEN")

CT2_FROM_USER1=$(echo $USER1_ACCESS_CT2 | jq -r '.data.id')

if [ "$CT2_FROM_USER1" = "null" ] || [ "$CT2_FROM_USER1" = "" ]; then
    test_case "用户1无法直接访问用户2的数据" "PASS"
else
    test_case "用户1无法直接访问用户2的数据" "FAIL"
    echo -e "${YELLOW}⚠️  警告: 权限控制失败！用户1可以直接访问用户2的数据${NC}"
fi

# 测试4: 用户1尝试删除用户2的数据
DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/conversion-targets/$CT2_ID" \
  -H "Authorization: Bearer $USER2_TOKEN" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$DELETE_RESPONSE" | tail -n 1)

if [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "404" ]; then
    test_case "用户1无法删除用户2的数据" "PASS"
else
    # 先用用户2删除，确保清理
    curl -s -X DELETE "$BASE_URL/conversion-targets/$CT2_ID" \
      -H "Authorization: Bearer $USER2_TOKEN" > /dev/null
    test_case "用户1无法删除用户2的数据" "FAIL"
fi

echo ""
echo "步骤 5: 清理测试数据"
echo "-------------------"

# 删除测试数据
curl -s -X DELETE "$BASE_URL/conversion-targets/$CT1_ID" \
  -H "Authorization: Bearer $USER1_TOKEN" > /dev/null
echo "✅ 已删除用户1的测试数据"

curl -s -X DELETE "$BASE_URL/conversion-targets/$CT2_ID" \
  -H "Authorization: Bearer $USER2_TOKEN" > /dev/null
echo "✅ 已删除用户2的测试数据"

echo ""
echo "===================="
echo "📊 测试结果统计"
echo "===================="
echo -e "${GREEN}通过: $PASSED${NC}"
echo -e "${RED}失败: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 所有测试通过！多租户数据隔离正常工作${NC}"
    exit 0
else
    echo -e "${RED}❌ 有 $FAILED 个测试失败！需要修复多租户数据隔离${NC}"
    echo ""
    echo "请查看修复方案: fix-tenant-isolation.md"
    exit 1
fi
