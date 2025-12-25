#!/bin/bash

# 用户功能验证脚本
# 验证个人中心、升级降级、实时更新功能

echo "========================================="
echo "  商品订阅系统 - 用户功能验证"
echo "========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 计数器
TOTAL=0
PASSED=0
FAILED=0

# 检查文件是否存在
check_file() {
    local file=$1
    local description=$2
    TOTAL=$((TOTAL + 1))
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $description"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $description - 文件不存在: $file"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# 检查目录是否存在
check_directory() {
    local dir=$1
    local description=$2
    TOTAL=$((TOTAL + 1))
    
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} $description"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $description - 目录不存在: $dir"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

echo "1. 检查前端页面"
echo "-----------------------------------"
check_file "client/src/pages/UserCenterPage.tsx" "用户个人中心页面"
check_file "client/src/pages/ProductManagementPage.tsx" "商品管理页面（管理员）"
echo ""

echo "2. 检查前端测试"
echo "-----------------------------------"
check_file "client/src/pages/__tests__/ProductManagementPage.test.tsx" "商品管理页面测试"
check_file "client/src/pages/__tests__/UserCenterPage.subscription.test.tsx" "订阅信息测试"
check_file "client/src/pages/__tests__/UserCenterPage.usage.test.tsx" "使用统计测试"
check_file "client/src/pages/__tests__/UserCenterPage.orders.test.tsx" "订单记录测试"
echo ""

echo "3. 检查 WebSocket 实时更新"
echo "-----------------------------------"
check_file "client/src/services/UserWebSocketService.ts" "前端 WebSocket 服务"
check_file "server/src/services/WebSocketService.ts" "后端 WebSocket 服务"
echo ""

echo "4. 检查后端服务"
echo "-----------------------------------"
check_file "server/src/services/SubscriptionService.ts" "订阅服务"
check_file "server/src/services/PaymentService.ts" "支付服务"
check_file "server/src/services/OrderService.ts" "订单服务"
check_file "server/src/services/ProductService.ts" "商品配置服务"
check_file "server/src/services/SchedulerService.ts" "定时任务服务"
echo ""

echo "5. 检查 API 路由"
echo "-----------------------------------"
check_file "server/src/routes/subscription.ts" "订阅 API"
check_file "server/src/routes/orders.ts" "订单 API"
check_file "server/src/routes/payment.ts" "支付回调 API"
check_file "server/src/routes/admin/products.ts" "管理员商品管理 API"
echo ""

echo "6. 检查后端测试"
echo "-----------------------------------"
check_file "server/src/__tests__/subscription.test.ts" "订阅服务测试"
check_file "server/src/__tests__/payment.test.ts" "支付服务测试"
check_file "server/src/__tests__/order.test.ts" "订单服务测试"
check_file "server/src/__tests__/product.test.ts" "商品管理测试"
check_file "server/src/__tests__/scheduler.test.ts" "定时任务测试"
check_file "server/src/__tests__/upgrade.test.ts" "升级功能测试"
echo ""

echo "7. 检查数据库迁移"
echo "-----------------------------------"
check_file "server/src/db/migrations/001_create_subscription_tables.sql" "创建订阅表迁移"
check_file "server/src/db/migrations/002_add_upgrade_downgrade_support.sql" "升级支持迁移"
echo ""

echo "8. 检查配置文件"
echo "-----------------------------------"
check_file "server/src/config/features.ts" "功能配额定义"
check_file "server/src/types/subscription.ts" "订阅类型定义"
check_file ".env.example" "环境变量模板"
echo ""

echo "========================================="
echo "  验证结果汇总"
echo "========================================="
echo ""
echo "总计: $TOTAL 项"
echo -e "${GREEN}通过: $PASSED 项${NC}"
echo -e "${RED}失败: $FAILED 项${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ 所有检查通过！用户功能验证完成。${NC}"
    echo ""
    echo "下一步："
    echo "1. 运行前端测试: cd client && npm test"
    echo "2. 运行后端测试: cd server && npm test"
    echo "3. 启动服务测试实时更新功能"
    echo ""
    exit 0
else
    echo -e "${RED}✗ 有 $FAILED 项检查失败，请修复后重试。${NC}"
    echo ""
    exit 1
fi
