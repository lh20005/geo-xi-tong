#!/bin/bash

echo "=========================================="
echo "测试：批量生成文章时蒸馏结果显示"
echo "=========================================="
echo ""

# 测试任务列表API，查看蒸馏结果字段
echo "1. 获取任务列表，检查蒸馏结果显示格式..."
echo ""

curl -s http://localhost:3000/api/generation-tasks?page=1&pageSize=5 | jq '.tasks[] | {
  id: .id,
  keyword: .keyword,
  requestedCount: .requestedCount,
  generatedCount: .generatedCount,
  status: .status,
  distillationResult: .distillationResult
}'

echo ""
echo "=========================================="
echo "说明："
echo "- distillationResult 字段现在使用 ||| 分隔每篇文章的话题"
echo "- 前端会将其按行显示，每行一个话题"
echo "- 每行前面会显示文章序号（1. 2. 3. ...）"
echo "=========================================="
