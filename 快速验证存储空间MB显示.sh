#!/bin/bash

# 快速验证存储空间 MB 单位显示
# 使用方法: ./快速验证存储空间MB显示.sh

echo "=========================================="
echo "存储空间 MB 单位显示验证"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查数据库中的存储空间配额单位
echo "1. 检查数据库中的存储空间配额..."
echo "----------------------------------------"

psql $DATABASE_URL -c "
SELECT 
  sp.plan_name as \"套餐名称\",
  pf.feature_value as \"配额值\",
  pf.feature_unit as \"单位\",
  CASE 
    WHEN pf.feature_value = -1 THEN '无限制'
    WHEN pf.feature_value >= 1024 THEN CONCAT(ROUND(pf.feature_value::numeric / 1024, 1), ' GB')
    ELSE CONCAT(pf.feature_value, ' MB')
  END as \"显示值\"
FROM plan_features pf
JOIN subscription_plans sp ON pf.plan_id = sp.id
WHERE pf.feature_code = 'storage_space'
ORDER BY sp.display_order;
" 2>/dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 数据库查询成功${NC}"
else
    echo -e "${RED}✗ 数据库查询失败，请检查 DATABASE_URL 环境变量${NC}"
fi

echo ""
echo "2. 检查前端代码中的格式化函数..."
echo "----------------------------------------"

# 检查 client 中的 formatStorageMB
if grep -q "formatStorageMB" client/src/api/storage.ts; then
    echo -e "${GREEN}✓ client/src/api/storage.ts 包含 formatStorageMB 函数${NC}"
else
    echo -e "${RED}✗ client/src/api/storage.ts 缺少 formatStorageMB 函数${NC}"
fi

# 检查 windows-login-manager 中的 formatStorageMB
if grep -q "formatStorageMB" windows-login-manager/src/api/storage.ts; then
    echo -e "${GREEN}✓ windows-login-manager/src/api/storage.ts 包含 formatStorageMB 函数${NC}"
else
    echo -e "${RED}✗ windows-login-manager/src/api/storage.ts 缺少 formatStorageMB 函数${NC}"
fi

echo ""
echo "3. 检查落地页显示逻辑..."
echo "----------------------------------------"

if grep -q "storage_space.*MB.*GB" landing/src/pages/HomePage.tsx; then
    echo -e "${GREEN}✓ 落地页包含 MB/GB 转换逻辑${NC}"
else
    echo -e "${YELLOW}⚠ 落地页可能需要更新显示逻辑${NC}"
fi

echo ""
echo "4. 检查商品管理显示逻辑..."
echo "----------------------------------------"

if grep -q "storage_space.*MB.*GB" client/src/pages/ProductManagementPage.tsx; then
    echo -e "${GREEN}✓ 商品管理包含 MB/GB 转换逻辑${NC}"
else
    echo -e "${YELLOW}⚠ 商品管理可能需要更新显示逻辑${NC}"
fi

echo ""
echo "5. 检查个人中心显示逻辑..."
echo "----------------------------------------"

if grep -q "formatStorageMB" client/src/pages/UserCenterPage.tsx; then
    echo -e "${GREEN}✓ 个人中心使用 formatStorageMB 函数${NC}"
else
    echo -e "${YELLOW}⚠ 个人中心可能需要更新显示逻辑${NC}"
fi

echo ""
echo "=========================================="
echo "验证完成"
echo "=========================================="
echo ""
echo "下一步操作："
echo "1. 启动服务: npm run dev"
echo "2. 访问落地页: http://localhost:8080"
echo "3. 访问商品管理: http://localhost:5173/product-management"
echo "4. 访问个人中心: http://localhost:5173/user-center"
echo ""
echo "检查所有位置的存储空间是否显示为 MB/GB 单位"
echo ""
