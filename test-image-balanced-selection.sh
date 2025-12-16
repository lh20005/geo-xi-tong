#!/bin/bash

# 测试图片均衡选择功能
# 验证图片是否按照使用次数最少的原则被选择

echo "=========================================="
echo "测试图片均衡选择功能"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. 检查数据库迁移状态
echo "步骤1: 检查数据库迁移状态..."
echo ""

# 检查images表是否有usage_count字段
USAGE_COUNT_EXISTS=$(psql -U postgres -d article_generation -tAc "
  SELECT COUNT(*) 
  FROM information_schema.columns 
  WHERE table_name='images' AND column_name='usage_count'
")

if [ "$USAGE_COUNT_EXISTS" -eq "0" ]; then
  echo -e "${YELLOW}⚠️  images表缺少usage_count字段，需要运行迁移${NC}"
  echo "运行迁移命令: npm run migrate:image-usage"
  echo ""
else
  echo -e "${GREEN}✅ images表已有usage_count字段${NC}"
  echo ""
fi

# 检查image_usage表是否存在
IMAGE_USAGE_EXISTS=$(psql -U postgres -d article_generation -tAc "
  SELECT COUNT(*) 
  FROM information_schema.tables 
  WHERE table_name='image_usage'
")

if [ "$IMAGE_USAGE_EXISTS" -eq "0" ]; then
  echo -e "${YELLOW}⚠️  image_usage表不存在，需要运行迁移${NC}"
  echo "运行迁移命令: npm run migrate:image-usage"
  echo ""
else
  echo -e "${GREEN}✅ image_usage表已存在${NC}"
  echo ""
fi

# 2. 查看相册和图片信息
echo "步骤2: 查看相册和图片信息..."
echo ""

psql -U postgres -d article_generation << 'EOF'
SELECT 
  a.id as album_id,
  a.name as album_name,
  COUNT(i.id) as image_count
FROM albums a
LEFT JOIN images i ON a.id = i.album_id
GROUP BY a.id, a.name
ORDER BY a.id;
EOF

echo ""

# 3. 查看图片使用统计
echo "步骤3: 查看图片使用统计..."
echo ""

psql -U postgres -d article_generation << 'EOF'
SELECT 
  i.id,
  i.filename,
  i.album_id,
  COALESCE(i.usage_count, 0) as usage_count,
  (SELECT COUNT(*) FROM image_usage WHERE image_id = i.id) as usage_records
FROM images i
ORDER BY i.album_id, i.usage_count ASC, i.created_at ASC
LIMIT 20;
EOF

echo ""

# 4. 测试建议
echo "=========================================="
echo "测试建议："
echo "=========================================="
echo ""
echo "1. 如果迁移未完成，请运行："
echo "   cd server && npm run migrate:image-usage"
echo ""
echo "2. 创建测试任务生成文章，观察图片选择是否均衡"
echo ""
echo "3. 查看图片使用统计："
echo "   SELECT album_id, filename, usage_count"
echo "   FROM images"
echo "   ORDER BY album_id, usage_count ASC;"
echo ""
echo "4. 验证每次生成文章时，使用次数最少的图片被优先选择"
echo ""
echo "=========================================="
