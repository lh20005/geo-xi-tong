#!/bin/bash

echo "======================================"
echo "测试转化目标地址字段"
echo "======================================"
echo ""

# 检查数据库中是否有address字段
echo "1. 检查conversion_targets表结构..."
psql -U postgres -d article_generation -c "\d conversion_targets"

echo ""
echo "2. 查看现有转化目标的地址数据..."
psql -U postgres -d article_generation -c "SELECT id, company_name, address FROM conversion_targets;"

echo ""
echo "======================================"
echo "测试完成"
echo "======================================"
echo ""
echo "如果address字段不存在，请运行迁移："
echo "psql -U postgres -d article_generation -f server/migrations/20241218_simplify_conversion_targets.sql"
