#!/bin/bash

# 为现有没有订阅的用户统一配置免费版套餐并配置配额

echo "========================================"
echo "为现有无订阅用户配置免费版套餐"
echo "========================================"
echo ""

# 1. 检查免费版套餐配置
echo "步骤 1: 检查免费版套餐配置..."
cd server
npx ts-node src/scripts/check-free-plan-quotas.ts

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ 免费版套餐配置检查失败，请先确保免费版套餐已正确配置"
  exit 1
fi

echo ""
echo "========================================"
echo ""

# 2. 执行批量配置
echo "步骤 2: 为所有无订阅用户配置免费版..."
npx ts-node src/scripts/reset-users-to-free-subscription.ts

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ 批量配置失败"
  exit 1
fi

echo ""
echo "========================================"
echo ""

# 3. 验证配置结果
echo "步骤 3: 验证配置结果..."
npx ts-node src/scripts/verify-free-subscription-setup.ts

echo ""
echo "========================================"
echo "✅ 所有操作完成"
echo "========================================"
echo ""
echo "建议："
echo "1. 检查上方验证报告，确认所有用户都已成功配置"
echo "2. 登录系统验证用户的订阅状态和配额"
echo "3. 测试用户是否可以正常使用各项功能"
echo ""
