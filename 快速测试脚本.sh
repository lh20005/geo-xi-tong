#!/bin/bash

# 快速测试脚本 - 验证API和均衡选择算法

echo "========================================="
echo "🔍 快速诊断脚本"
echo "========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试1: 检查后端服务器
echo "📡 测试1: 检查后端服务器..."
if curl -s http://localhost:3000/api/distillation/history > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 后端服务器正常运行${NC}"
else
    echo -e "${RED}❌ 后端服务器未运行！${NC}"
    echo -e "${YELLOW}请执行: cd server && npm run dev${NC}"
    exit 1
fi
echo ""

# 测试2: 检查蒸馏结果数量
echo "📊 测试2: 检查蒸馏结果数量..."
HISTORY_RESPONSE=$(curl -s http://localhost:3000/api/distillation/history)
DISTILLATION_COUNT=$(echo $HISTORY_RESPONSE | jq '.data | length' 2>/dev/null || echo "0")

echo "当前蒸馏结果数量: $DISTILLATION_COUNT"

if [ "$DISTILLATION_COUNT" -eq "0" ]; then
    echo -e "${RED}❌ 没有蒸馏结果！${NC}"
    echo -e "${YELLOW}请在前端页面创建至少3-5个蒸馏结果${NC}"
    exit 1
elif [ "$DISTILLATION_COUNT" -lt "3" ]; then
    echo -e "${YELLOW}⚠️  蒸馏结果数量较少（少于3个）${NC}"
    echo -e "${YELLOW}建议创建至少3-5个蒸馏结果以测试均衡选择${NC}"
else
    echo -e "${GREEN}✅ 蒸馏结果数量充足（$DISTILLATION_COUNT 个）${NC}"
fi
echo ""

# 测试3: 检查推荐API
echo "🎯 测试3: 测试推荐API（均衡选择）..."
RECOMMENDED_RESPONSE=$(curl -s "http://localhost:3000/api/distillation/recommended?limit=5")

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 推荐API正常工作${NC}"
    echo ""
    echo "推荐的蒸馏结果（按usage_count升序）："
    echo "$RECOMMENDED_RESPONSE" | jq -r '.[] | "  - ID: \(.distillationId), 关键词: \(.keyword), 使用次数: \(.usageCount)"' 2>/dev/null || echo "$RECOMMENDED_RESPONSE"
else
    echo -e "${RED}❌ 推荐API调用失败${NC}"
fi
echo ""

# 测试4: 检查使用统计API
echo "📈 测试4: 测试使用统计API..."
STATS_RESPONSE=$(curl -s "http://localhost:3000/api/distillation/stats?sortBy=usage_count&sortOrder=asc")

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 使用统计API正常工作${NC}"
    echo ""
    echo "蒸馏结果使用统计："
    echo "$STATS_RESPONSE" | jq -r '.distillations[] | "  - ID: \(.distillationId), 关键词: \(.keyword), 使用次数: \(.usageCount), 话题数: \(.topicCount)"' 2>/dev/null || echo "$STATS_RESPONSE"
else
    echo -e "${RED}❌ 使用统计API调用失败${NC}"
fi
echo ""

# 测试5: 检查前端服务器
echo "🌐 测试5: 检查前端服务器..."
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 前端服务器正常运行${NC}"
    echo "访问地址: http://localhost:5173/distillation"
else
    echo -e "${RED}❌ 前端服务器未运行！${NC}"
    echo -e "${YELLOW}请执行: cd client && npm run dev${NC}"
fi
echo ""

# 总结
echo "========================================="
echo "📋 诊断总结"
echo "========================================="

if [ "$DISTILLATION_COUNT" -ge "3" ]; then
    echo -e "${GREEN}✅ 系统状态良好，可以测试均衡选择功能${NC}"
    echo ""
    echo "下一步操作："
    echo "1. 访问 http://localhost:5173/article-generation"
    echo "2. 创建任务，生成3篇文章"
    echo "3. 查看文章是否使用了不同的关键词"
else
    echo -e "${YELLOW}⚠️  需要创建更多蒸馏结果${NC}"
    echo ""
    echo "下一步操作："
    echo "1. 访问 http://localhost:5173/distillation"
    echo "2. 输入不同的关键词（如：Python、Java、React等）"
    echo "3. 每个关键词点击"开始蒸馏""
    echo "4. 创建至少3-5个蒸馏结果"
fi

echo ""
echo "========================================="
