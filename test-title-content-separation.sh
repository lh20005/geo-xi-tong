#!/bin/bash

# 测试标题和内容分离
# 这个脚本会查询数据库中的一篇文章，显示title和content字段

echo "=========================================="
echo "测试标题和内容分离"
echo "=========================================="
echo ""

# 查询最新的一篇文章
echo "1. 查询数据库中最新的文章："
echo ""

cd server

# 使用psql查询
PGPASSWORD=postgres psql -h localhost -U postgres -d article_generator -c "
SELECT 
  id,
  LEFT(title, 50) as title,
  LENGTH(title) as title_length,
  LEFT(content, 100) as content_preview,
  LENGTH(content) as content_length
FROM articles 
ORDER BY id DESC 
LIMIT 1;
"

echo ""
echo "2. 检查content字段是否包含title："
echo ""

PGPASSWORD=postgres psql -h localhost -U postgres -d article_generator -t -c "
SELECT 
  CASE 
    WHEN content LIKE '%' || title || '%' THEN '❌ 警告：content包含title'
    ELSE '✅ 正常：content不包含title'
  END as check_result
FROM articles 
ORDER BY id DESC 
LIMIT 1;
"

echo ""
echo "=========================================="
echo "测试完成"
echo "=========================================="
