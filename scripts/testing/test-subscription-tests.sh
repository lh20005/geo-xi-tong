#!/bin/bash

# 商品订阅系统测试脚本

echo "🧪 开始运行商品订阅系统测试..."
echo ""

cd server

echo "📋 测试列表："
echo "1. subscription.test.ts - 订阅服务测试"
echo "2. payment.test.ts - 支付服务测试"
echo "3. order.test.ts - 订单服务测试"
echo "4. product.test.ts - 商品管理测试"
echo "5. scheduler.test.ts - 定时任务测试"
echo "6. upgrade.test.ts - 升级功能测试"
echo ""

# 运行订阅服务测试
echo "🔍 运行订阅服务测试..."
npm test -- subscription.test.ts --verbose

# 运行订单服务测试
echo ""
echo "🔍 运行订单服务测试..."
npm test -- order.test.ts --verbose

# 运行商品管理测试
echo ""
echo "🔍 运行商品管理测试..."
npm test -- product.test.ts --verbose

# 运行定时任务测试
echo ""
echo "🔍 运行定时任务测试..."
npm test -- scheduler.test.ts --verbose

# 运行升级功能测试
echo ""
echo "🔍 运行升级功能测试..."
npm test -- upgrade.test.ts --verbose

# 运行支付服务测试（可能需要微信支付配置）
echo ""
echo "🔍 运行支付服务测试..."
echo "⚠️  注意：支付服务测试需要微信支付配置，未配置时部分测试会被跳过"
npm test -- payment.test.ts --verbose

echo ""
echo "✅ 所有测试运行完成！"
echo ""
echo "📊 查看测试覆盖率："
echo "npm test -- --coverage"
