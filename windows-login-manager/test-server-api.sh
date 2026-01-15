#!/bin/bash

# Phase 8.1 服务器 API 测试脚本
# 测试配额预扣减、分析上报等服务器端 API

SERVER_URL="https://jzgeo.cc"

echo "========================================"
echo "📋 Phase 8.1 服务器 API 测试"
echo "========================================"
echo "服务器: $SERVER_URL"
echo ""

# 计数器
PASSED=0
FAILED=0

test_api() {
    local name="$1"
    local expected_status="$2"
    local actual_status="$3"
    
    if [ "$actual_status" = "$expected_status" ]; then
        echo "✅ $name (HTTP $actual_status)"
        ((PASSED++))
    else
        echo "❌ $name (Expected: $expected_status, Got: $actual_status)"
        ((FAILED++))
    fi
}

echo "--- 测试 API 端点存在性（无需认证）---"

# 测试健康检查
status=$(curl -s -o /dev/null -w "%{http_code}" "$SERVER_URL/api/health")
test_api "健康检查 API" "200" "$status"

# 测试配额预扣减 API（应返回 401 未授权）
status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SERVER_URL/api/quota/reserve" -H "Content-Type: application/json" -d '{"quotaType":"publish","amount":1}')
test_api "配额预扣减 API 存在" "401" "$status"

# 测试配额确认 API
status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SERVER_URL/api/quota/confirm" -H "Content-Type: application/json" -d '{"reservationId":"test"}')
test_api "配额确认 API 存在" "401" "$status"

# 测试配额释放 API
status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SERVER_URL/api/quota/release" -H "Content-Type: application/json" -d '{"reservationId":"test"}')
test_api "配额释放 API 存在" "401" "$status"

# 测试分析上报 API
status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SERVER_URL/api/analytics/publish-report" -H "Content-Type: application/json" -d '{"taskId":"test"}')
test_api "分析上报 API 存在" "401" "$status"

# 测试批量分析上报 API
status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SERVER_URL/api/analytics/publish-report/batch" -H "Content-Type: application/json" -d '{"reports":[]}')
test_api "批量分析上报 API 存在" "401" "$status"

# 测试数据同步上传 API
status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SERVER_URL/api/sync/upload" -H "Content-Type: application/json" -d '{}')
test_api "数据同步上传 API 存在" "401" "$status"

# 测试数据同步快照列表 API
status=$(curl -s -o /dev/null -w "%{http_code}" "$SERVER_URL/api/sync/snapshots")
test_api "数据同步快照列表 API 存在" "401" "$status"

# 测试适配器版本 API（公开 API，不需要认证）
status=$(curl -s -o /dev/null -w "%{http_code}" "$SERVER_URL/api/adapters/versions")
test_api "适配器版本 API 存在" "200" "$status"

# 测试 AI 生成确认 API
status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SERVER_URL/api/article-generation/confirm" -H "Content-Type: application/json" -d '{"generationId":"test"}')
test_api "AI 生成确认 API 存在" "401" "$status"

# 测试 AI 生成重新获取 API
status=$(curl -s -o /dev/null -w "%{http_code}" "$SERVER_URL/api/article-generation/retrieve/test")
test_api "AI 生成重新获取 API 存在" "401" "$status"

echo ""
echo "========================================"
echo "📊 测试总结"
echo "========================================"
echo "✅ 通过: $PASSED"
echo "❌ 失败: $FAILED"

if [ $FAILED -eq 0 ]; then
    echo ""
    echo "🎉 所有 API 端点验证通过！"
    echo "（返回 401 表示 API 存在但需要认证，这是正确的行为）"
    exit 0
else
    echo ""
    echo "⚠️  有 $FAILED 个测试失败"
    exit 1
fi
