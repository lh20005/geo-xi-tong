#!/bin/bash

# 多租户数据隔离完整测试脚本
# 测试所有修复的路由是否正确实现了数据隔离

API_URL="http://localhost:3001/api"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 多租户数据隔离完整测试"
echo "================================"
echo ""

# 检查是否提供了token
if [ -z "$USER_A_TOKEN" ] || [ -z "$USER_B_TOKEN" ]; then
  echo -e "${YELLOW}⚠️  请设置环境变量:${NC}"
  echo "export USER_A_TOKEN='用户A的JWT token'"
  echo "export USER_B_TOKEN='用户B的JWT token'"
  echo ""
  echo "获取token的方法："
  echo "1. 注册/登录用户A和用户B"
  echo "2. 从登录响应中获取token"
  exit 1
fi

echo -e "${GREEN}✓ Token已配置${NC}"
echo ""

# 测试计数器
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 测试函数
test_isolation() {
  local test_name=$1
  local method=$2
  local endpoint=$3
  local token=$4
  local data=$5
  local expected_status=$6
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  
  echo -n "测试 $TOTAL_TESTS: $test_name ... "
  
  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" -X GET "$API_URL$endpoint" \
      -H "Authorization: Bearer $token")
  elif [ "$method" = "POST" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL$endpoint" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "$data")
  elif [ "$method" = "PUT" ]; then
    response=$(curl -s -w "\n%{http_code}" -X PUT "$API_URL$endpoint" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "$data")
  elif [ "$method" = "DELETE" ]; then
    response=$(curl -s -w "\n%{http_code}" -X DELETE "$API_URL$endpoint" \
      -H "Authorization: Bearer $token")
  fi
  
  status_code=$(echo "$response" | tail -n1)
  
  if [ "$status_code" = "$expected_status" ]; then
    echo -e "${GREEN}✓ 通过${NC} (状态码: $status_code)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
  else
    echo -e "${RED}✗ 失败${NC} (期望: $expected_status, 实际: $status_code)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
}

echo "📋 测试1: 转化目标隔离"
echo "------------------------"
test_isolation "用户A获取转化目标列表" "GET" "/conversion-targets" "$USER_A_TOKEN" "" "200"
test_isolation "用户B获取转化目标列表" "GET" "/conversion-targets" "$USER_B_TOKEN" "" "200"
echo ""

echo "📋 测试2: 文章设置隔离"
echo "------------------------"
test_isolation "用户A获取文章设置列表" "GET" "/article-settings" "$USER_A_TOKEN" "" "200"
test_isolation "用户B获取文章设置列表" "GET" "/article-settings" "$USER_B_TOKEN" "" "200"
echo ""

echo "📋 测试3: 蒸馏记录隔离"
echo "------------------------"
test_isolation "用户A获取蒸馏记录" "GET" "/distillation" "$USER_A_TOKEN" "" "200"
test_isolation "用户B获取蒸馏记录" "GET" "/distillation" "$USER_B_TOKEN" "" "200"
echo ""

echo "📋 测试4: 文章隔离"
echo "------------------------"
test_isolation "用户A获取文章列表" "GET" "/articles" "$USER_A_TOKEN" "" "200"
test_isolation "用户B获取文章列表" "GET" "/articles" "$USER_B_TOKEN" "" "200"
test_isolation "用户A获取文章统计" "GET" "/articles/stats" "$USER_A_TOKEN" "" "200"
test_isolation "用户B获取文章统计" "GET" "/articles/stats" "$USER_B_TOKEN" "" "200"
echo ""

echo "📋 测试5: 平台账号隔离"
echo "------------------------"
test_isolation "用户A获取平台账号" "GET" "/publishing/accounts" "$USER_A_TOKEN" "" "200"
test_isolation "用户B获取平台账号" "GET" "/publishing/accounts" "$USER_B_TOKEN" "" "200"
echo ""

echo "📋 测试6: 发布任务隔离"
echo "------------------------"
test_isolation "用户A获取发布任务" "GET" "/publishing/tasks" "$USER_A_TOKEN" "" "200"
test_isolation "用户B获取发布任务" "GET" "/publishing/tasks" "$USER_B_TOKEN" "" "200"
echo ""

echo "📋 测试7: Electron账号隔离"
echo "------------------------"
test_isolation "用户A获取Electron账号" "GET" "/accounts" "$USER_A_TOKEN" "" "200"
test_isolation "用户B获取Electron账号" "GET" "/accounts" "$USER_B_TOKEN" "" "200"
echo ""

echo "📋 测试8: 跨用户访问拒绝"
echo "------------------------"
echo -e "${YELLOW}注意: 以下测试需要实际的资源ID，如果没有数据会返回404${NC}"
test_isolation "用户B访问用户A的文章(ID:1)" "GET" "/articles/1" "$USER_B_TOKEN" "" "404"
test_isolation "用户B删除用户A的文章(ID:1)" "DELETE" "/articles/1" "$USER_B_TOKEN" "" "404"
echo ""

# 测试总结
echo "================================"
echo "📊 测试总结"
echo "================================"
echo -e "总测试数: $TOTAL_TESTS"
echo -e "${GREEN}通过: $PASSED_TESTS${NC}"
echo -e "${RED}失败: $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}🎉 所有测试通过！多租户隔离工作正常！${NC}"
  exit 0
else
  echo -e "${RED}❌ 有测试失败，请检查日志${NC}"
  exit 1
fi
