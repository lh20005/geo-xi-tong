#!/bin/bash

# 集成测试脚本：验证转化目标功能
# 测试文章生成任务配置对话框中的转化目标选择功能

echo "========================================="
echo "转化目标集成测试"
echo "========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试计数器
TESTS_PASSED=0
TESTS_FAILED=0

# 测试函数
test_api() {
  local test_name=$1
  local method=$2
  local endpoint=$3
  local data=$4
  local expected_status=$5
  
  echo -n "测试: $test_name ... "
  
  if [ -z "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X $method "http://localhost:3000$endpoint")
  else
    response=$(curl -s -w "\n%{http_code}" -X $method "http://localhost:3000$endpoint" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi
  
  status_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$status_code" = "$expected_status" ]; then
    echo -e "${GREEN}✓ 通过${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    return 0
  else
    echo -e "${RED}✗ 失败${NC}"
    echo "  期望状态码: $expected_status"
    echo "  实际状态码: $status_code"
    echo "  响应内容: $body"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    return 1
  fi
}

echo "1. 测试数据库迁移"
echo "-------------------"
echo "检查 generation_tasks 表是否包含 conversion_target_id 字段..."

# 使用 psql 检查字段是否存在
FIELD_EXISTS=$(psql -U lzc -d geo_system -t -c "SELECT column_name FROM information_schema.columns WHERE table_name='generation_tasks' AND column_name='conversion_target_id';" 2>/dev/null | xargs)

if [ "$FIELD_EXISTS" = "conversion_target_id" ]; then
  echo -e "${GREEN}✓ conversion_target_id 字段存在${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${RED}✗ conversion_target_id 字段不存在${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""
echo "2. 测试API端点"
echo "-------------------"

# 测试获取转化目标列表
test_api "获取转化目标列表" "GET" "/api/conversion-targets" "" "200"

# 测试创建任务（带转化目标）
echo ""
echo "3. 测试任务创建（需要先确保有测试数据）"
echo "-------------------"
echo -e "${YELLOW}注意: 以下测试需要数据库中存在相应的测试数据${NC}"
echo "  - 蒸馏历史 (distillations)"
echo "  - 图库 (albums)"
echo "  - 知识库 (knowledge_bases)"
echo "  - 文章设置 (article_settings)"
echo "  - 转化目标 (conversion_targets)"
echo ""

# 测试创建任务（不带转化目标 - 向后兼容性）
echo "测试向后兼容性（不带 conversionTargetId）..."
test_api "创建任务（无转化目标）" "POST" "/api/article-generation/tasks" \
  '{"distillationId":1,"albumId":1,"knowledgeBaseId":1,"articleSettingId":1,"articleCount":1}' \
  "200"

echo ""
echo "========================================="
echo "测试总结"
echo "========================================="
echo -e "通过: ${GREEN}$TESTS_PASSED${NC}"
echo -e "失败: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}所有测试通过！${NC}"
  exit 0
else
  echo -e "${RED}部分测试失败${NC}"
  exit 1
fi
