#!/bin/bash

echo "======================================"
echo "测试文章生成模块下拉列表API"
echo "======================================"
echo ""

BASE_URL="http://localhost:3000/api"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试函数
test_api() {
    local name=$1
    local url=$2
    local jq_filter=$3
    
    echo -n "测试 $name ... "
    
    response=$(curl -s "$url")
    count=$(echo "$response" | jq "$jq_filter" 2>/dev/null)
    
    if [ $? -eq 0 ] && [ ! -z "$count" ]; then
        echo -e "${GREEN}✓${NC} 成功 (${count}条记录)"
        echo "$response" | jq '.' | head -20
    else
        echo -e "${RED}✗${NC} 失败"
        echo "$response"
    fi
    echo ""
}

# 测试各个API
test_api "蒸馏历史统计" \
    "${BASE_URL}/distillation/stats?page=1&pageSize=100" \
    ".distillations | length"

test_api "相册列表" \
    "${BASE_URL}/gallery/albums" \
    ".albums | length"

test_api "知识库列表" \
    "${BASE_URL}/knowledge-bases" \
    ".knowledgeBases | length"

test_api "文章设置列表" \
    "${BASE_URL}/article-settings" \
    ".settings | length"

test_api "转化目标列表" \
    "${BASE_URL}/conversion-targets" \
    ".data.targets | length"

echo "======================================"
echo "测试完成"
echo "======================================"
