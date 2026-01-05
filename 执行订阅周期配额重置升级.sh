#!/bin/bash

# 订阅周期配额重置系统升级脚本
# 执行迁移 031 并运行测试

set -e  # 遇到错误立即退出

echo "========================================"
echo "订阅周期配额重置系统升级"
echo "========================================"
echo ""

# 检查是否在项目根目录
if [ ! -d "server" ]; then
  echo "❌ 错误：请在项目根目录执行此脚本"
  exit 1
fi

cd server

echo "1️⃣ 执行数据库迁移 031..."
echo "----------------------------------------"
npx ts-node src/db/run-migration-031.ts

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ 迁移执行成功！"
else
  echo ""
  echo "❌ 迁移执行失败，请检查错误信息"
  exit 1
fi

echo ""
echo "2️⃣ 运行测试脚本..."
echo "----------------------------------------"
npx ts-node src/scripts/test-subscription-cycle-quota.ts

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ 测试通过！"
else
  echo ""
  echo "⚠️  测试未完全通过，请检查输出"
fi

echo ""
echo "========================================"
echo "✅ 升级完成！"
echo "========================================"
echo ""
echo "配额重置系统已升级为订阅周期模式："
echo "  - 月度套餐：配额在每月订阅日重置"
echo "  - 年度套餐：配额在每年订阅日重置"
echo "  - 每个用户有独立的重置周期"
echo ""
echo "查看详细文档："
echo "  cat ../订阅周期配额重置系统实施完成.md"
echo ""
