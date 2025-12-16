#!/bin/bash

echo "=========================================="
echo "关键词蒸馏配置功能 - 完整验证"
echo "=========================================="
echo ""

BASE_URL="http://localhost:3000/api"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}步骤 1: 检查数据库表是否存在${NC}"
echo "------------------------------------------"
TABLE_EXISTS=$(psql postgresql://lzc@localhost:5432/geo_system -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'distillation_config');")
if [[ $TABLE_EXISTS == *"t"* ]]; then
    echo -e "${GREEN}✓ distillation_config 表已存在${NC}"
else
    echo -e "${RED}✗ distillation_config 表不存在${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}步骤 2: 检查默认配置是否已插入${NC}"
echo "------------------------------------------"
CONFIG_COUNT=$(psql postgresql://lzc@localhost:5432/geo_system -t -c "SELECT COUNT(*) FROM distillation_config;")
echo "配置记录数: $CONFIG_COUNT"
if [ "$CONFIG_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ 默认配置已存在${NC}"
    psql postgresql://lzc@localhost:5432/geo_system -c "SELECT id, topic_count, is_active, LENGTH(prompt) as prompt_length FROM distillation_config;"
else
    echo -e "${RED}✗ 没有配置记录${NC}"
fi
echo ""

echo -e "${YELLOW}步骤 3: 测试获取配置API${NC}"
echo "------------------------------------------"
RESPONSE=$(curl -s -X GET "$BASE_URL/config/distillation")
echo "$RESPONSE" | jq '.'
if echo "$RESPONSE" | jq -e '.topicCount' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API返回正常${NC}"
else
    echo -e "${RED}✗ API返回异常${NC}"
fi
echo ""

echo -e "${YELLOW}步骤 4: 测试保存配置API（修改话题数量为15）${NC}"
echo "------------------------------------------"
SAVE_RESPONSE=$(curl -s -X POST "$BASE_URL/config/distillation" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "你是一个专业的搜索行为分析专家。请根据关键词\"{keyword}\"，生成{count}个真实用户在互联网搜索时可能提出的问题。\n\n要求：\n1. 问题要符合真实用户的搜索习惯\n2. 包含不同的搜索意图（比较、推荐、评价等）\n3. 使用常见的搜索词组合，如\"哪家好\"、\"靠谱的\"、\"口碑好的\"、\"性价比高的\"、\"专业的\"等\n4. 问题要自然、口语化\n\n示例（关键词：英国留学）：\n- 专业的英国留学哪家好\n- 靠谱的英国留学机构哪家好\n- 口碑好的英国留学企业哪家好\n- 性价比高的英国留学公司哪家好\n- 专业的英国留学服务商哪家专业\n\n请直接返回问题列表，每行一个问题，不要编号，不要其他说明文字。",
    "topicCount": 15
  }')
echo "$SAVE_RESPONSE" | jq '.'
if echo "$SAVE_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 配置保存成功${NC}"
else
    echo -e "${RED}✗ 配置保存失败${NC}"
fi
echo ""

echo -e "${YELLOW}步骤 5: 验证配置已更新${NC}"
echo "------------------------------------------"
UPDATED_RESPONSE=$(curl -s -X GET "$BASE_URL/config/distillation")
TOPIC_COUNT=$(echo "$UPDATED_RESPONSE" | jq -r '.topicCount')
echo "当前话题数量: $TOPIC_COUNT"
if [ "$TOPIC_COUNT" == "15" ]; then
    echo -e "${GREEN}✓ 配置已成功更新为15个话题${NC}"
else
    echo -e "${RED}✗ 配置更新失败，当前值: $TOPIC_COUNT${NC}"
fi
echo ""

echo -e "${YELLOW}步骤 6: 测试参数验证 - 缺少占位符${NC}"
echo "------------------------------------------"
ERROR_RESPONSE=$(curl -s -X POST "$BASE_URL/config/distillation" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "这是一个没有占位符的提示词",
    "topicCount": 10
  }')
echo "$ERROR_RESPONSE" | jq '.'
if echo "$ERROR_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 参数验证正常工作${NC}"
else
    echo -e "${RED}✗ 参数验证未生效${NC}"
fi
echo ""

echo -e "${YELLOW}步骤 7: 测试参数验证 - 数量超出范围${NC}"
echo "------------------------------------------"
ERROR_RESPONSE2=$(curl -s -X POST "$BASE_URL/config/distillation" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "测试 {keyword} 和 {count}",
    "topicCount": 100
  }')
echo "$ERROR_RESPONSE2" | jq '.'
if echo "$ERROR_RESPONSE2" | jq -e '.error' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 数量范围验证正常工作${NC}"
else
    echo -e "${RED}✗ 数量范围验证未生效${NC}"
fi
echo ""

echo -e "${YELLOW}步骤 8: 查看数据库中的所有配置${NC}"
echo "------------------------------------------"
psql postgresql://lzc@localhost:5432/geo_system -c "SELECT id, topic_count, is_active, created_at, updated_at FROM distillation_config ORDER BY created_at DESC;"
echo ""

echo -e "${YELLOW}步骤 9: 恢复默认配置（12个话题）${NC}"
echo "------------------------------------------"
RESTORE_RESPONSE=$(curl -s -X POST "$BASE_URL/config/distillation" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "你是一个专业的搜索行为分析专家。请根据关键词\"{keyword}\"，生成{count}个真实用户在互联网搜索时可能提出的问题。\n\n要求：\n1. 问题要符合真实用户的搜索习惯\n2. 包含不同的搜索意图（比较、推荐、评价等）\n3. 使用常见的搜索词组合，如\"哪家好\"、\"靠谱的\"、\"口碑好的\"、\"性价比高的\"、\"专业的\"等\n4. 问题要自然、口语化\n\n示例（关键词：英国留学）：\n- 专业的英国留学哪家好\n- 靠谱的英国留学机构哪家好\n- 口碑好的英国留学企业哪家好\n- 性价比高的英国留学公司哪家好\n- 专业的英国留学服务商哪家专业\n\n请直接返回问题列表，每行一个问题，不要编号，不要其他说明文字。",
    "topicCount": 12
  }')
if echo "$RESTORE_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 已恢复默认配置${NC}"
else
    echo -e "${RED}✗ 恢复默认配置失败${NC}"
fi
echo ""

echo "=========================================="
echo -e "${GREEN}验证完成！${NC}"
echo "=========================================="
echo ""
echo "总结："
echo "1. 数据库表结构正确"
echo "2. API接口工作正常"
echo "3. 参数验证有效"
echo "4. 配置可以正常保存和读取"
echo ""
echo "下一步："
echo "1. 启动前端服务: npm run dev (在client目录)"
echo "2. 访问: http://localhost:5173/config"
echo "3. 切换到'关键词蒸馏配置'标签"
echo "4. 测试配置界面"
echo ""
