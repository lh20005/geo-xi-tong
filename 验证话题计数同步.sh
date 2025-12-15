#!/bin/bash

# 完整的话题计数同步验证脚本
# 包含：数据库查询、API测试、前端验证

echo "=========================================="
echo "话题使用计数同步 - 完整验证"
echo "=========================================="
echo ""

DISTILLATION_ID=2
API_BASE="http://localhost:3000"

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}测试环境:${NC}"
echo "  - 蒸馏结果ID: $DISTILLATION_ID"
echo "  - API地址: $API_BASE"
echo ""

# 1. 数据库验证
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}1. 数据库层面验证${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "查询话题表的usage_count字段："
psql postgresql://lzc@localhost:5432/geo_system -c "
SELECT 
  t.id,
  LEFT(t.question, 35) as question,
  t.usage_count,
  (SELECT COUNT(*) FROM topic_usage tu WHERE tu.topic_id = t.id) as actual_usage
FROM topics t 
WHERE t.distillation_id = $DISTILLATION_ID 
ORDER BY t.usage_count ASC, t.id ASC
LIMIT 8;
" 2>/dev/null
echo ""

# 2. API验证
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}2. API层面验证${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "测试API: GET /api/topics/distillation/$DISTILLATION_ID/stats"
echo ""

API_RESPONSE=$(curl -s "$API_BASE/api/topics/distillation/$DISTILLATION_ID/stats")

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ API调用成功${NC}"
  echo ""
  echo "返回数据（前8个话题）："
  echo "$API_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    topics = data.get('topics', [])[:8]
    total = data.get('total', 0)
    
    print(f'  总话题数: {total}')
    print(f'  返回话题数: {len(topics)}')
    print()
    print('  ID  | 使用次数 | 话题内容')
    print('  ' + '-' * 60)
    
    for topic in topics:
        tid = topic.get('topicId', 0)
        count = topic.get('usageCount', 0)
        question = topic.get('question', '')[:35]
        print(f'  {tid:3d} | {count:8d} | {question}')
except Exception as e:
    print(f'  解析失败: {e}')
"
else
  echo -e "${YELLOW}✗ API调用失败${NC}"
fi
echo ""

# 3. 数据一致性验证
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}3. 数据一致性验证${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "检查usage_count是否与实际使用记录一致："
INCONSISTENT=$(psql postgresql://lzc@localhost:5432/geo_system -t -c "
SELECT COUNT(*) 
FROM topics t 
WHERE t.distillation_id = $DISTILLATION_ID 
  AND t.usage_count != (SELECT COUNT(*) FROM topic_usage tu WHERE tu.topic_id = t.id);
" 2>/dev/null | xargs)

if [ "$INCONSISTENT" = "0" ]; then
  echo -e "${GREEN}✓ 所有话题的usage_count与实际使用记录一致${NC}"
else
  echo -e "${YELLOW}✗ 发现 $INCONSISTENT 个话题的usage_count不一致${NC}"
  echo ""
  echo "不一致的话题："
  psql postgresql://lzc@localhost:5432/geo_system -c "
  SELECT 
    t.id,
    LEFT(t.question, 30) as question,
    t.usage_count as stored_count,
    (SELECT COUNT(*) FROM topic_usage tu WHERE tu.topic_id = t.id) as actual_count
  FROM topics t 
  WHERE t.distillation_id = $DISTILLATION_ID 
    AND t.usage_count != (SELECT COUNT(*) FROM topic_usage tu WHERE tu.topic_id = t.id);
  " 2>/dev/null
  echo ""
  echo "可以运行以下命令修复："
  echo "  curl -X POST $API_BASE/api/topics/repair-usage-count"
fi
echo ""

# 4. 轮换算法验证
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}4. 轮换算法验证${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "下一个应该被选择的话题（usage_count最小，id最小）："
psql postgresql://lzc@localhost:5432/geo_system -c "
SELECT 
  t.id,
  LEFT(t.question, 40) as question,
  t.usage_count
FROM topics t
WHERE t.distillation_id = $DISTILLATION_ID 
  AND t.usage_count = (SELECT MIN(usage_count) FROM topics WHERE distillation_id = $DISTILLATION_ID)
ORDER BY t.id ASC
LIMIT 1;
" 2>/dev/null
echo ""

# 5. 最近使用记录
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}5. 最近使用记录${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "最近5次话题使用记录："
psql postgresql://lzc@localhost:5432/geo_system -c "
SELECT 
  tu.id as usage_id,
  tu.topic_id,
  LEFT(t.question, 35) as topic_question,
  tu.article_id,
  to_char(tu.used_at, 'YYYY-MM-DD HH24:MI:SS') as used_at
FROM topic_usage tu
LEFT JOIN topics t ON tu.topic_id = t.id
WHERE tu.distillation_id = $DISTILLATION_ID
ORDER BY tu.used_at DESC
LIMIT 5;
" 2>/dev/null
echo ""

# 6. 总结
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}6. 验证总结${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "验证项目："
echo "  [1] 数据库表结构 - topics.usage_count字段存在"
echo "  [2] API端点可用 - /api/topics/distillation/:id/stats"
echo "  [3] 数据一致性 - usage_count与实际记录一致"
echo "  [4] 轮换算法 - 按usage_count和id排序"
echo "  [5] 实时更新 - 生成文章后立即更新"
echo ""
echo -e "${GREEN}前端验证步骤：${NC}"
echo "  1. 打开浏览器访问: http://localhost:5173"
echo "  2. 进入「蒸馏结果」模块"
echo "  3. 点击某个关键词查看话题列表"
echo "  4. 应该能看到每个话题的「已使用 X 次」标签"
echo "  5. 生成一篇文章后，刷新话题列表"
echo "  6. 验证使用次数已更新"
echo ""
echo "=========================================="
