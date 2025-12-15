#!/bin/bash

# 测试文章-蒸馏数据流
# 这个脚本帮助你验证文章生成时蒸馏数据是否正确关联

echo "=========================================="
echo "文章-蒸馏数据流测试"
echo "=========================================="
echo ""

# 1. 获取蒸馏历史列表
echo "1. 获取蒸馏历史列表..."
echo "API: GET /api/distillation/history"
curl -s http://localhost:3000/api/distillation/history | jq '.' > /tmp/distillations.json
echo "✓ 蒸馏历史已保存到 /tmp/distillations.json"
echo ""

# 显示前3个蒸馏结果
echo "前3个蒸馏结果："
cat /tmp/distillations.json | jq '.data[0:3] | .[] | {id, keyword, topic_count, usage_count}'
echo ""

# 2. 选择第一个蒸馏结果，查看详情
DISTILLATION_ID=$(cat /tmp/distillations.json | jq -r '.data[0].id')
echo "2. 查看蒸馏结果详情 (ID: $DISTILLATION_ID)..."
echo "API: GET /api/distillation/$DISTILLATION_ID"
curl -s http://localhost:3000/api/distillation/$DISTILLATION_ID | jq '.' > /tmp/distillation_detail.json
echo "✓ 蒸馏详情已保存到 /tmp/distillation_detail.json"
echo ""

# 显示关键词和话题
echo "关键词和话题："
cat /tmp/distillation_detail.json | jq '{keyword, questions: .questions[0:3]}'
echo ""

# 3. 查询使用这个蒸馏结果生成的文章
echo "3. 查询使用此蒸馏结果生成的文章..."
echo "API: GET /api/articles?distillationId=$DISTILLATION_ID"
curl -s "http://localhost:3000/api/articles?distillationId=$DISTILLATION_ID" | jq '.' > /tmp/articles.json
echo "✓ 文章列表已保存到 /tmp/articles.json"
echo ""

# 显示文章信息
ARTICLE_COUNT=$(cat /tmp/articles.json | jq '.articles | length')
echo "找到 $ARTICLE_COUNT 篇文章"
if [ "$ARTICLE_COUNT" -gt 0 ]; then
  echo ""
  echo "文章详情："
  cat /tmp/articles.json | jq '.articles[] | {id, keyword, distillationId, distillationKeyword, title}'
  echo ""
  
  # 4. 验证数据一致性
  echo "4. 验证数据一致性..."
  DISTILLATION_KEYWORD=$(cat /tmp/distillation_detail.json | jq -r '.keyword')
  ARTICLE_DISTILLATION_KEYWORD=$(cat /tmp/articles.json | jq -r '.articles[0].distillationKeyword')
  
  echo "蒸馏结果的关键词: $DISTILLATION_KEYWORD"
  echo "文章中显示的蒸馏关键词: $ARTICLE_DISTILLATION_KEYWORD"
  
  if [ "$DISTILLATION_KEYWORD" = "$ARTICLE_DISTILLATION_KEYWORD" ]; then
    echo "✓ 数据一致！"
  else
    echo "✗ 数据不一致！这就是你遇到的问题。"
  fi
else
  echo "没有找到使用此蒸馏结果的文章"
fi

echo ""
echo "=========================================="
echo "测试完成"
echo "=========================================="
echo ""
echo "如果发现数据不一致，请检查："
echo "1. articles表中的distillation_id是否正确"
echo "2. 前端是否正确显示distillationKeyword字段"
echo "3. 是否有数据库迁移问题"
