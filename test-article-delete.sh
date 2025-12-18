#!/bin/bash

echo "======================================"
echo "文章删除功能测试"
echo "======================================"
echo ""

API_BASE="http://localhost:3000/api"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "1. 测试删除不存在的文章"
echo "--------------------------------------"
response=$(curl -s -X DELETE "$API_BASE/articles/999999")
echo "响应: $response"
if echo "$response" | grep -q "文章不存在"; then
    echo -e "${GREEN}✓ 正确返回文章不存在错误${NC}"
else
    echo -e "${RED}✗ 未正确处理不存在的文章${NC}"
fi
echo ""

echo "2. 测试批量删除（空数组）"
echo "--------------------------------------"
response=$(curl -s -X DELETE "$API_BASE/articles/batch" \
    -H "Content-Type: application/json" \
    -d '{"ids":[]}')
echo "响应: $response"
if echo "$response" | grep -q "ids参数必须是非空数组"; then
    echo -e "${GREEN}✓ 正确验证空数组${NC}"
else
    echo -e "${RED}✗ 未正确验证空数组${NC}"
fi
echo ""

echo "3. 测试批量删除（无效参数）"
echo "--------------------------------------"
response=$(curl -s -X DELETE "$API_BASE/articles/batch" \
    -H "Content-Type: application/json" \
    -d '{}')
echo "响应: $response"
if echo "$response" | grep -q "ids参数必须是非空数组"; then
    echo -e "${GREEN}✓ 正确验证缺失参数${NC}"
else
    echo -e "${RED}✗ 未正确验证缺失参数${NC}"
fi
echo ""

echo "4. 获取当前文章列表"
echo "--------------------------------------"
articles=$(curl -s "$API_BASE/articles?page=1&pageSize=5")
echo "$articles" | jq '.'
echo ""

# 提取第一篇文章的ID
first_article_id=$(echo "$articles" | jq -r '.articles[0].id // empty')

if [ -n "$first_article_id" ]; then
    echo "5. 测试删除单篇文章 (ID: $first_article_id)"
    echo "--------------------------------------"
    response=$(curl -s -X DELETE "$API_BASE/articles/$first_article_id")
    echo "响应: $response"
    if echo "$response" | grep -q "success.*true"; then
        echo -e "${GREEN}✓ 成功删除文章${NC}"
    else
        echo -e "${RED}✗ 删除文章失败${NC}"
    fi
    echo ""
    
    echo "6. 验证文章已被删除"
    echo "--------------------------------------"
    response=$(curl -s -X DELETE "$API_BASE/articles/$first_article_id")
    echo "响应: $response"
    if echo "$response" | grep -q "文章不存在"; then
        echo -e "${GREEN}✓ 文章已被删除${NC}"
    else
        echo -e "${RED}✗ 文章仍然存在${NC}"
    fi
    echo ""
else
    echo -e "${YELLOW}⚠ 没有文章可供测试删除${NC}"
    echo ""
fi

# 获取更多文章用于批量删除测试
articles=$(curl -s "$API_BASE/articles?page=1&pageSize=3")
article_ids=$(echo "$articles" | jq -r '[.articles[].id] | @json')

if [ "$article_ids" != "[]" ] && [ "$article_ids" != "null" ]; then
    echo "7. 测试批量删除文章"
    echo "--------------------------------------"
    echo "要删除的文章IDs: $article_ids"
    response=$(curl -s -X DELETE "$API_BASE/articles/batch" \
        -H "Content-Type: application/json" \
        -d "{\"ids\":$article_ids}")
    echo "响应: $response"
    if echo "$response" | grep -q "success.*true"; then
        echo -e "${GREEN}✓ 批量删除成功${NC}"
    else
        echo -e "${RED}✗ 批量删除失败${NC}"
    fi
    echo ""
else
    echo -e "${YELLOW}⚠ 没有足够的文章进行批量删除测试${NC}"
    echo ""
fi

echo "8. 获取文章统计"
echo "--------------------------------------"
stats=$(curl -s "$API_BASE/articles/stats")
echo "$stats" | jq '.'
total=$(echo "$stats" | jq -r '.total')
echo ""

if [ "$total" -gt 0 ]; then
    echo -e "${YELLOW}提示: 当前还有 $total 篇文章${NC}"
    echo -e "${YELLOW}如需测试删除所有文章，请手动执行:${NC}"
    echo -e "${YELLOW}curl -X DELETE $API_BASE/articles/all${NC}"
else
    echo -e "${GREEN}✓ 所有文章已清空${NC}"
fi
echo ""

echo "======================================"
echo "测试完成"
echo "======================================"
