#!/bin/bash

# 用户管理 API 测试脚本
# 测试所有用户管理相关的 API 端点

echo "=========================================="
echo "用户管理 API 端点测试"
echo "=========================================="
echo ""

BASE_URL="http://localhost:3000"
TEST_USERNAME="testuser_$(date +%s)"
TEST_PASSWORD="test123456"
ADMIN_TOKEN=""
USER_TOKEN=""

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试结果统计
PASSED=0
FAILED=0

# 测试函数
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_status=$5
    local headers=$6
    
    echo -n "测试: $name ... "
    
    if [ -n "$headers" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "$headers" \
            -d "$data" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null)
    fi
    
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ 通过${NC} (状态码: $status_code)"
        PASSED=$((PASSED + 1))
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    else
        echo -e "${RED}✗ 失败${NC} (期望: $expected_status, 实际: $status_code)"
        FAILED=$((FAILED + 1))
        echo "$body"
    fi
    echo ""
}

echo "=========================================="
echo "1. 测试用户注册"
echo "=========================================="

# 测试注册（不带邀请码）
test_endpoint \
    "注册新用户（不带邀请码）" \
    "POST" \
    "/api/auth/register" \
    "{\"username\":\"$TEST_USERNAME\",\"password\":\"$TEST_PASSWORD\"}" \
    "201"

# 保存用户令牌
USER_TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${TEST_USERNAME}_2\",\"password\":\"$TEST_PASSWORD\"}" \
    | jq -r '.token' 2>/dev/null)

# 测试重复用户名
test_endpoint \
    "注册重复用户名（应该失败）" \
    "POST" \
    "/api/auth/register" \
    "{\"username\":\"$TEST_USERNAME\",\"password\":\"$TEST_PASSWORD\"}" \
    "400"

# 测试密码太短
test_endpoint \
    "注册密码太短（应该失败）" \
    "POST" \
    "/api/auth/register" \
    "{\"username\":\"${TEST_USERNAME}_short\",\"password\":\"123\"}" \
    "400"

echo "=========================================="
echo "2. 测试用户登录"
echo "=========================================="

# 测试登录
test_endpoint \
    "用户登录" \
    "POST" \
    "/api/auth/login" \
    "{\"username\":\"$TEST_USERNAME\",\"password\":\"$TEST_PASSWORD\"}" \
    "200"

# 测试错误密码
test_endpoint \
    "错误密码登录（应该失败）" \
    "POST" \
    "/api/auth/login" \
    "{\"username\":\"$TEST_USERNAME\",\"password\":\"wrongpassword\"}" \
    "401"

echo "=========================================="
echo "3. 测试用户资料"
echo "=========================================="

if [ -n "$USER_TOKEN" ]; then
    # 测试获取用户资料
    test_endpoint \
        "获取用户资料" \
        "GET" \
        "/api/users/profile" \
        "" \
        "200" \
        "Authorization: Bearer $USER_TOKEN"
else
    echo -e "${YELLOW}⚠ 跳过：没有有效的用户令牌${NC}"
fi

echo "=========================================="
echo "4. 测试邀请系统"
echo "=========================================="

if [ -n "$USER_TOKEN" ]; then
    # 测试获取邀请统计
    test_endpoint \
        "获取邀请统计" \
        "GET" \
        "/api/invitations/stats" \
        "" \
        "200" \
        "Authorization: Bearer $USER_TOKEN"
    
    # 获取邀请码
    INVITATION_CODE=$(curl -s -X GET "$BASE_URL/api/invitations/stats" \
        -H "Authorization: Bearer $USER_TOKEN" \
        | jq -r '.invitationCode' 2>/dev/null)
    
    if [ -n "$INVITATION_CODE" ] && [ "$INVITATION_CODE" != "null" ]; then
        # 测试验证邀请码
        test_endpoint \
            "验证邀请码" \
            "POST" \
            "/api/invitations/validate" \
            "{\"code\":\"$INVITATION_CODE\"}" \
            "200"
        
        # 测试使用邀请码注册
        test_endpoint \
            "使用邀请码注册" \
            "POST" \
            "/api/auth/register" \
            "{\"username\":\"${TEST_USERNAME}_invited\",\"password\":\"$TEST_PASSWORD\",\"invitationCode\":\"$INVITATION_CODE\"}" \
            "201"
    fi
else
    echo -e "${YELLOW}⚠ 跳过：没有有效的用户令牌${NC}"
fi

echo "=========================================="
echo "5. 测试管理员功能"
echo "=========================================="

# 尝试使用管理员账号登录
ADMIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}' 2>/dev/null)

ADMIN_TOKEN=$(echo "$ADMIN_RESPONSE" | jq -r '.token' 2>/dev/null)

if [ -n "$ADMIN_TOKEN" ] && [ "$ADMIN_TOKEN" != "null" ]; then
    echo -e "${GREEN}✓ 管理员登录成功${NC}"
    echo ""
    
    # 测试获取用户列表
    test_endpoint \
        "获取用户列表" \
        "GET" \
        "/api/admin/users?page=1&pageSize=10" \
        "" \
        "200" \
        "Authorization: Bearer $ADMIN_TOKEN"
    
    # 测试搜索用户
    test_endpoint \
        "搜索用户" \
        "GET" \
        "/api/admin/users?search=test&page=1&pageSize=10" \
        "" \
        "200" \
        "Authorization: Bearer $ADMIN_TOKEN"
else
    echo -e "${YELLOW}⚠ 跳过管理员测试：管理员账号不可用${NC}"
    echo "   提示：请确保已创建管理员账号（username: admin, password: admin123）"
fi

echo ""
echo "=========================================="
echo "测试总结"
echo "=========================================="
echo -e "通过: ${GREEN}$PASSED${NC}"
echo -e "失败: ${RED}$FAILED${NC}"
echo "总计: $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ 所有测试通过！${NC}"
    exit 0
else
    echo -e "${RED}✗ 有测试失败${NC}"
    exit 1
fi
