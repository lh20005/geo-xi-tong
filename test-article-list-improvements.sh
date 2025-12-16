#!/bin/bash

echo "======================================"
echo "文章管理页面优化测试"
echo "======================================"
echo ""

BASE_URL="http://localhost:3000/api"

echo "1. 测试获取关键词统计..."
echo "GET $BASE_URL/articles/stats/keywords"
curl -s "$BASE_URL/articles/stats/keywords" | jq '.'
echo ""
echo ""

echo "2. 测试按关键词筛选文章..."
echo "GET $BASE_URL/articles?keyword=测试"
curl -s "$BASE_URL/articles?keyword=测试&page=1&pageSize=5" | jq '.articles[] | {id, keyword, title}'
echo ""
echo ""

echo "3. 测试搜索功能（模糊搜索）..."
echo "GET $BASE_URL/articles?keyword=关键"
curl -s "$BASE_URL/articles?keyword=关键&page=1&pageSize=5" | jq '.articles[] | {id, keyword, title}'
echo ""
echo ""

echo "4. 测试组合筛选（发布状态 + 关键词）..."
echo "GET $BASE_URL/articles?publishStatus=published&keyword=测试"
curl -s "$BASE_URL/articles?publishStatus=published&keyword=测试&page=1&pageSize=5" | jq '{total, articles: [.articles[] | {id, keyword, isPublished}]}'
echo ""
echo ""

echo "======================================"
echo "测试完成！"
echo "======================================"
echo ""
echo "前端测试步骤："
echo "1. 启动应用: npm run dev"
echo "2. 访问: http://localhost:5173"
echo "3. 进入文章管理页面"
echo "4. 测试关键词筛选下拉菜单"
echo "5. 测试搜索框功能"
echo "6. 检查布局是否美观均匀"
echo ""
