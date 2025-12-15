#!/bin/bash

# 蒸馏结果API测试脚本

BASE_URL="http://localhost:3000"

echo "======================================"
echo "蒸馏结果API测试"
echo "======================================"
echo ""

# 测试1: 获取蒸馏历史
echo "1. 测试获取蒸馏历史..."
curl -s "${BASE_URL}/api/distillation/history" | jq '.' || echo "❌ 失败"
echo ""

# 测试2: 获取带使用统计的列表
echo "2. 测试获取带使用统计的列表..."
curl -s "${BASE_URL}/api/distillation/stats?page=1&pageSize=10" | jq '.' || echo "❌ 失败"
echo ""

# 测试3: 获取推荐的蒸馏结果
echo "3. 测试获取推荐的蒸馏结果..."
curl -s "${BASE_URL}/api/distillation/recommended?limit=5" | jq '.' || echo "❌ 失败"
echo ""

# 测试4: 检查数据库中的蒸馏结果
echo "4. 检查数据库中有话题的蒸馏结果..."
echo "SELECT d.id, d.keyword, d.usage_count, COUNT(t.id) as topic_count 
FROM distillations d 
LEFT JOIN topics t ON d.id = t.distillation_id 
GROUP BY d.id 
HAVING COUNT(t.id) > 0 
ORDER BY d.usage_count ASC, d.created_at ASC;" | psql $DATABASE_URL
echo ""

# 测试5: 检查最近的任务
echo "5. 检查最近的任务..."
echo "SELECT id, requested_count, generated_count, selected_distillation_ids, status 
FROM generation_tasks 
ORDER BY created_at DESC 
LIMIT 3;" | psql $DATABASE_URL
echo ""

echo "======================================"
echo "测试完成"
echo "======================================"
