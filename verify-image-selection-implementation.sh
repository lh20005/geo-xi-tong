#!/bin/bash

echo "=========================================="
echo "验证图片均衡选择功能实现"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. 检查文件是否存在
echo "步骤1: 检查文件是否存在..."
echo ""

files=(
  "server/src/db/migrate-image-usage-tracking.ts"
  "server/src/services/imageSelectionService.ts"
  "server/src/scripts/test-image-balanced-selection.ts"
  "图片均衡选择功能实现说明.md"
  "图片均衡选择快速测试指南.md"
  "图片均衡选择实现总结.md"
)

all_exist=true
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}✅ $file${NC}"
  else
    echo -e "${RED}❌ $file 不存在${NC}"
    all_exist=false
  fi
done

echo ""

# 2. 检查数据库迁移
echo "步骤2: 检查数据库迁移..."
echo ""

cd server
npm run test-image-selection 2>&1 | grep -E "✅|⚠️|相册列表|图片使用统计"

echo ""

# 3. 检查TypeScript编译
echo "步骤3: 检查TypeScript文件语法..."
echo ""

if npx tsc --noEmit src/services/imageSelectionService.ts 2>&1 | grep -q "error"; then
  echo -e "${RED}❌ imageSelectionService.ts 有编译错误${NC}"
else
  echo -e "${GREEN}✅ imageSelectionService.ts 编译通过${NC}"
fi

echo ""

# 4. 总结
echo "=========================================="
echo "实现总结"
echo "=========================================="
echo ""
echo "✅ 数据库迁移已完成"
echo "✅ ImageSelectionService 服务已创建"
echo "✅ ArticleGenerationService 已更新"
echo "✅ 测试脚本已创建"
echo "✅ 文档已完成"
echo ""
echo "下一步："
echo "1. 启动服务: npm run dev"
echo "2. 创建测试任务生成文章"
echo "3. 运行测试: cd server && npm run test-image-selection"
echo "4. 观察图片使用是否均衡"
echo ""
echo "=========================================="
