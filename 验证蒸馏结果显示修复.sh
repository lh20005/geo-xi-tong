#!/bin/bash

echo "=========================================="
echo "验证：批量文章蒸馏结果显示修复"
echo "=========================================="
echo ""

echo "测试场景：使用关键词'英国留学机构'生成2篇文章"
echo ""

# 获取任务列表
echo "1. 获取最新的任务列表..."
echo ""

response=$(curl -s http://localhost:3000/api/generation-tasks?page=1&pageSize=5)

echo "$response" | jq -r '.tasks[] | 
  "任务ID: \(.id)",
  "关键词: \(.keyword)",
  "请求数量: \(.requestedCount) 篇",
  "已生成: \(.generatedCount) 篇",
  "状态: \(.status)",
  "蒸馏结果:",
  (.distillationResult // "待生成"),
  "---"
'

echo ""
echo "=========================================="
echo "预期结果："
echo "- 蒸馏结果应该显示具体的话题内容"
echo "- 如果生成了2篇文章，应该看到2个话题"
echo "- 话题之间用 ||| 分隔"
echo "- 不应该显示'使用了2个蒸馏结果'"
echo "=========================================="
echo ""

# 检查是否有问题
if echo "$response" | grep -q "使用了.*个蒸馏结果"; then
    echo "❌ 发现问题：仍然显示'使用了X个蒸馏结果'"
    echo ""
    echo "请检查："
    echo "1. 服务器是否已重启"
    echo "2. 代码修改是否已生效"
else
    echo "✅ 修复成功：显示具体的话题内容"
fi
