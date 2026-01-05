#!/bin/bash

echo "=========================================="
echo "配额时效性修复执行脚本"
echo "=========================================="
echo ""

# 检查是否在正确的目录
if [ ! -d "server" ]; then
  echo "❌ 错误: 请在项目根目录执行此脚本"
  exit 1
fi

echo "📋 修复步骤:"
echo "1. 执行数据库迁移 030"
echo "2. 运行测试验证"
echo "3. 重启服务器"
echo ""

read -p "是否继续? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ 已取消"
  exit 1
fi

echo ""
echo "=========================================="
echo "步骤 1: 执行数据库迁移"
echo "=========================================="
echo ""

cd server
npx ts-node src/db/run-migration-030.ts

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ 迁移执行失败，请检查错误信息"
  exit 1
fi

echo ""
echo "=========================================="
echo "步骤 2: 运行测试验证"
echo "=========================================="
echo ""

npx ts-node src/scripts/test-quota-expiration-fix.ts

if [ $? -ne 0 ]; then
  echo ""
  echo "⚠️  测试发现问题，但迁移已完成"
  echo "请查看测试输出并手动修复问题"
fi

echo ""
echo "=========================================="
echo "步骤 3: 重启服务器"
echo "=========================================="
echo ""

echo "请手动重启服务器以应用更改:"
echo ""
echo "  npm run server:dev"
echo ""
echo "或者在生产环境:"
echo ""
echo "  pm2 restart geo-server"
echo ""

echo "=========================================="
echo "✅ 配额时效性修复完成！"
echo "=========================================="
echo ""
echo "📖 详细信息请查看: 配额时效性修复完成报告.md"
echo ""
