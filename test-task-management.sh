#!/bin/bash

# 发布任务管理功能测试脚本

echo "=========================================="
echo "发布任务管理功能测试"
echo "=========================================="
echo ""

BASE_URL="http://localhost:3001/api/publishing"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试结果统计
PASS=0
FAIL=0

# 测试函数
test_api() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    
    echo -e "${YELLOW}测试: ${name}${NC}"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}${endpoint}")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}${endpoint}" \
            -H "Content-Type: application/json" \
            -d "$data")
    elif [ "$method" = "DELETE" ]; then
        response=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE_URL}${endpoint}")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✓ 通过 (HTTP $http_code)${NC}"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        ((PASS++))
    else
        echo -e "${RED}✗ 失败 (HTTP $http_code)${NC}"
        echo "$body"
        ((FAIL++))
    fi
    echo ""
}

echo "1. 获取任务列表"
echo "----------------------------------------"
test_api "获取所有任务" "GET" "/tasks?page=1&pageSize=10"

echo ""
echo "2. 测试任务终止功能"
echo "----------------------------------------"
echo "提示: 需要先有一个执行中的任务"
echo "请输入要终止的任务ID (输入0跳过): "
read -r task_id

if [ "$task_id" != "0" ] && [ -n "$task_id" ]; then
    test_api "终止任务 #${task_id}" "POST" "/tasks/${task_id}/terminate"
else
    echo "跳过终止测试"
    echo ""
fi

echo ""
echo "3. 测试单个任务删除"
echo "----------------------------------------"
echo "请输入要删除的任务ID (输入0跳过): "
read -r delete_id

if [ "$delete_id" != "0" ] && [ -n "$delete_id" ]; then
    test_api "删除任务 #${delete_id}" "DELETE" "/tasks/${delete_id}"
else
    echo "跳过删除测试"
    echo ""
fi

echo ""
echo "4. 测试批量删除功能"
echo "----------------------------------------"
echo "请输入要批量删除的任务ID，用逗号分隔 (例如: 1,2,3，输入0跳过): "
read -r batch_ids

if [ "$batch_ids" != "0" ] && [ -n "$batch_ids" ]; then
    # 将逗号分隔的ID转换为JSON数组
    json_ids=$(echo "$batch_ids" | sed 's/,/,/g' | awk '{print "[" $0 "]"}')
    test_api "批量删除任务" "POST" "/tasks/batch-delete" "{\"taskIds\": $json_ids}"
else
    echo "跳过批量删除测试"
    echo ""
fi

echo ""
echo "5. 查看任务日志"
echo "----------------------------------------"
echo "请输入要查看日志的任务ID (输入0跳过): "
read -r log_id

if [ "$log_id" != "0" ] && [ -n "$log_id" ]; then
    test_api "获取任务日志 #${log_id}" "GET" "/tasks/${log_id}/logs"
else
    echo "跳过日志查看"
    echo ""
fi

echo ""
echo "=========================================="
echo "测试完成"
echo "=========================================="
echo -e "通过: ${GREEN}${PASS}${NC}"
echo -e "失败: ${RED}${FAIL}${NC}"
echo ""

echo "=========================================="
echo "前端测试指南"
echo "=========================================="
echo ""
echo "1. 启动前端服务:"
echo "   cd client && npm run dev"
echo ""
echo "2. 访问发布任务页面:"
echo "   http://localhost:5173/publishing-tasks"
echo ""
echo "3. 测试功能:"
echo "   ✓ 勾选任务复选框"
echo "   ✓ 点击'批量删除'按钮"
echo "   ✓ 对执行中的任务点击'终止'按钮"
echo "   ✓ 对已完成的任务点击'删除'按钮"
echo "   ✓ 点击'删除全部'按钮"
echo "   ✓ 查看任务日志"
echo ""
echo "4. 验证功能:"
echo "   ✓ 所有操作都有二次确认"
echo "   ✓ 操作按钮根据任务状态显示"
echo "   ✓ 批量操作显示成功/失败统计"
echo "   ✓ 删除后任务从列表中消失"
echo ""
