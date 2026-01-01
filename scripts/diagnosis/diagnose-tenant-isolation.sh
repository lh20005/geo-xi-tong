#!/bin/bash

# 多租户数据隔离诊断脚本

echo "🔍 开始诊断多租户数据隔离问题..."
echo ""

# 检查数据库表是否有 user_id 字段
echo "📊 检查数据库表结构..."
echo "================================"

tables=("articles" "distillations" "conversion_targets" "article_settings" "generation_tasks" "platform_accounts" "albums" "knowledge_bases")

for table in "${tables[@]}"; do
    echo "检查表: $table"
    psql -U postgres -d geo_system -c "\d $table" | grep user_id
    if [ $? -eq 0 ]; then
        echo "  ✅ $table 表有 user_id 字段"
    else
        echo "  ❌ $table 表缺少 user_id 字段"
    fi
    echo ""
done

echo ""
echo "📝 检查路由文件是否使用租户隔离..."
echo "================================"

# 检查路由文件是否导入了租户中间件
routes=("article.ts" "distillation.ts" "conversionTarget.ts" "articleGeneration.ts" "articleSettings.ts" "platformAccounts.ts")

for route in "${routes[@]}"; do
    file="server/src/routes/$route"
    echo "检查文件: $route"
    
    # 检查是否导入了租户中间件
    if grep -q "getCurrentTenantId" "$file"; then
        echo "  ✅ 已导入 getCurrentTenantId"
    else
        echo "  ❌ 未导入 getCurrentTenantId"
    fi
    
    # 检查是否使用了 requireTenantContext
    if grep -q "requireTenantContext" "$file"; then
        echo "  ✅ 已使用 requireTenantContext 中间件"
    else
        echo "  ❌ 未使用 requireTenantContext 中间件"
    fi
    
    # 检查查询是否包含 user_id 过滤
    if grep -q "user_id = \$" "$file"; then
        echo "  ✅ 查询包含 user_id 过滤"
    else
        echo "  ❌ 查询缺少 user_id 过滤"
    fi
    
    echo ""
done

echo ""
echo "🎯 诊断完成！"
echo ""
echo "📋 修复建议："
echo "1. 确保所有表都有 user_id 字段"
echo "2. 在路由文件中添加租户中间件"
echo "3. 在所有查询中添加 user_id 过滤"
echo ""
echo "详细修复方案请查看: fix-tenant-isolation.md"
