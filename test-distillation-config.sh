#!/bin/bash

echo "=========================================="
echo "关键词蒸馏配置功能测试"
echo "=========================================="
echo ""

BASE_URL="http://localhost:3000/api"

echo "1. 测试获取当前关键词蒸馏配置"
echo "------------------------------------------"
curl -s -X GET "$BASE_URL/config/distillation" | jq '.'
echo ""
echo ""

echo "2. 测试保存新的关键词蒸馏配置"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/config/distillation" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "你是一个专业的搜索行为分析专家。请根据关键词\"{keyword}\"，生成{count}个真实用户在互联网搜索时可能提出的问题。\n\n要求：\n1. 问题要符合真实用户的搜索习惯\n2. 包含不同的搜索意图（比较、推荐、评价等）\n3. 使用常见的搜索词组合，如\"哪家好\"、\"靠谱的\"、\"口碑好的\"、\"性价比高的\"、\"专业的\"等\n4. 问题要自然、口语化\n\n示例（关键词：英国留学）：\n- 专业的英国留学哪家好\n- 靠谱的英国留学机构哪家好\n- 口碑好的英国留学企业哪家好\n- 性价比高的英国留学公司哪家好\n- 专业的英国留学服务商哪家专业\n\n请直接返回问题列表，每行一个问题，不要编号，不要其他说明文字。",
    "topicCount": 15
  }' | jq '.'
echo ""
echo ""

echo "3. 验证配置已更新"
echo "------------------------------------------"
curl -s -X GET "$BASE_URL/config/distillation" | jq '.'
echo ""
echo ""

echo "4. 测试参数验证 - 缺少 {keyword} 占位符"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/config/distillation" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "这是一个测试提示词，没有关键词占位符",
    "topicCount": 10
  }' | jq '.'
echo ""
echo ""

echo "5. 测试参数验证 - 话题数量超出范围"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/config/distillation" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "测试 {keyword} 和 {count}",
    "topicCount": 50
  }' | jq '.'
echo ""
echo ""

echo "6. 查看数据库中的配置记录"
echo "------------------------------------------"
psql postgresql://lzc@localhost:5432/geo_system -c "SELECT id, topic_count, is_active, created_at FROM distillation_config ORDER BY created_at DESC LIMIT 3;"
echo ""

echo "=========================================="
echo "测试完成！"
echo "=========================================="
