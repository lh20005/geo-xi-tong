#!/bin/bash

# 商品订阅系统核心功能验证脚本

echo "🔍 开始验证商品订阅系统核心功能..."
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 计数器
PASSED=0
FAILED=0

# 测试函数
test_feature() {
    local feature_name=$1
    local test_command=$2
    
    echo -n "测试: $feature_name ... "
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 通过${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}❌ 失败${NC}"
        ((FAILED++))
        return 1
    fi
}

cd server

echo "📋 1. 检查核心服务文件"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_feature "SubscriptionService 存在" "test -f src/services/SubscriptionService.ts"
test_feature "PaymentService 存在" "test -f src/services/PaymentService.ts"
test_feature "OrderService 存在" "test -f src/services/OrderService.ts"
test_feature "ProductService 存在" "test -f src/services/ProductService.ts"
test_feature "SchedulerService 存在" "test -f src/services/SchedulerService.ts"

echo ""
echo "📋 2. 检查测试文件"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_feature "订阅服务测试存在" "test -f src/__tests__/subscription.test.ts"
test_feature "支付服务测试存在" "test -f src/__tests__/payment.test.ts"
test_feature "订单服务测试存在" "test -f src/__tests__/order.test.ts"
test_feature "商品管理测试存在" "test -f src/__tests__/product.test.ts"
test_feature "定时任务测试存在" "test -f src/__tests__/scheduler.test.ts"
test_feature "升级功能测试存在" "test -f src/__tests__/upgrade.test.ts"

echo ""
echo "📋 3. 检查数据库迁移文件"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_feature "订阅表迁移文件存在" "test -f src/db/migrations/001_create_subscription_tables.sql"
test_feature "升级支持迁移文件存在" "test -f src/db/migrations/002_add_upgrade_downgrade_support.sql"

echo ""
echo "📋 4. 检查 API 路由"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_feature "订阅路由存在" "test -f src/routes/subscription.ts"
test_feature "订单路由存在" "test -f src/routes/orders.ts"
test_feature "支付路由存在" "test -f src/routes/payment.ts"
test_feature "管理员商品路由存在" "test -f src/routes/admin/products.ts"

echo ""
echo "📋 5. 检查配置文件"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_feature "功能配额定义存在" "test -f src/config/features.ts"
test_feature "订阅类型定义存在" "test -f src/types/subscription.ts"

cd ..

echo ""
echo "📋 6. 检查前端页面"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_feature "商品管理页面存在" "test -f client/src/pages/ProductManagementPage.tsx"
test_feature "用户中心页面存在" "test -f client/src/pages/UserCenterPage.tsx"

echo ""
echo "📋 7. 检查文档"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_feature "最终完成报告存在" "test -f SUBSCRIPTION_SYSTEM_FINAL.md"
test_feature "测试完成报告存在" "test -f SUBSCRIPTION_TESTS_COMPLETE.md"
test_feature "实施完成报告存在" "test -f IMPLEMENTATION_COMPLETE_FINAL.md"
test_feature "快速开始指南存在" "test -f QUICK_START_SUBSCRIPTION.md"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 验证结果汇总"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ 通过: $PASSED${NC}"
echo -e "${RED}❌ 失败: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 所有核心功能文件验证通过！${NC}"
    echo ""
    echo "下一步："
    echo "1. 配置 .env 文件中的微信支付参数"
    echo "2. 运行数据库迁移: cd server && npm run migrate"
    echo "3. 运行测试: ./test-subscription-tests.sh"
    echo "4. 启动服务: cd server && npm run dev"
    exit 0
else
    echo -e "${RED}⚠️  有 $FAILED 个检查失败，请检查缺失的文件${NC}"
    exit 1
fi
