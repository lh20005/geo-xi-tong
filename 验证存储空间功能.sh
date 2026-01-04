#!/bin/bash

echo "========================================"
echo "存储空间功能验证脚本"
echo "========================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 步骤 1: 检查数据库迁移
echo "步骤 1: 检查数据库中的存储空间配置..."
echo "----------------------------------------"
cd server
npx ts-node -e "
import { pool } from './src/db/database';

async function check() {
  try {
    const result = await pool.query(\`
      SELECT 
        sp.plan_name,
        pf.feature_name,
        pf.feature_value,
        pf.feature_unit
      FROM plan_features pf
      JOIN subscription_plans sp ON pf.plan_id = sp.id
      WHERE pf.feature_code = 'storage_space'
      ORDER BY sp.display_order
    \`);
    
    console.log('✅ 数据库配置:');
    result.rows.forEach(row => {
      console.log(\`   ${row.plan_name}: ${row.feature_value} ${row.feature_unit}\`);
    });
    
    const allMB = result.rows.every(r => r.feature_unit === 'MB');
    if (allMB) {
      console.log('✅ 单位正确: 所有套餐都使用 MB');
    } else {
      console.log('❌ 单位错误: 存在非 MB 单位');
      process.exit(1);
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ 检查失败:', error);
    process.exit(1);
  }
}

check();
"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 数据库配置检查通过${NC}"
else
    echo -e "${RED}❌ 数据库配置检查失败${NC}"
    exit 1
fi

echo ""
echo "步骤 2: 运行连通性测试..."
echo "----------------------------------------"
npx ts-node src/scripts/test-storage-feature-connectivity.ts

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 连通性测试通过${NC}"
else
    echo -e "${RED}❌ 连通性测试失败${NC}"
    exit 1
fi

cd ..

echo ""
echo "步骤 3: 检查前端代码..."
echo "----------------------------------------"

# 检查商品管理页面
if grep -q "storage_space" client/src/pages/ProductManagementPage.tsx; then
    echo -e "${GREEN}✅ 商品管理页面包含 storage_space 选项${NC}"
else
    echo -e "${RED}❌ 商品管理页面缺少 storage_space 选项${NC}"
    exit 1
fi

echo ""
echo "========================================"
echo "验证完成！"
echo "========================================"
echo ""
echo "下一步操作："
echo "1. 重启后端服务: npm run server:dev"
echo "2. 重启前端服务: npm run client:dev"
echo "3. 访问商品管理页面测试: http://localhost:5173/admin/products"
echo "4. 访问落地页测试: http://localhost:8080"
echo ""
echo "验证清单："
echo "□ 商品管理页面可以选择'存储空间'选项"
echo "□ 单位显示为 'MB'"
echo "□ 落地页套餐卡片显示存储空间配额"
echo "□ 用户中心显示存储使用情况（MB）"
echo ""
