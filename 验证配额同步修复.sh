#!/bin/bash

# 验证配额同步修复脚本
# 用于快速验证配额调整后是否正确同步

echo "========================================"
echo "验证配额同步修复"
echo "========================================"
echo ""

# 检查是否在 server 目录
if [ ! -f "package.json" ]; then
    echo "❌ 请在 server 目录下运行此脚本"
    exit 1
fi

echo "1. 检查迁移 032 是否已执行..."
echo ""

# 检查 check_user_quota 函数是否包含 custom_quotas
RESULT=$(psql $DATABASE_URL -t -c "
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'check_user_quota' 
LIMIT 1
" 2>&1)

if echo "$RESULT" | grep -q "v_custom_quotas"; then
    echo "✅ check_user_quota 函数已更新（包含 custom_quotas 逻辑）"
else
    echo "❌ check_user_quota 函数未更新"
    echo ""
    echo "请运行迁移："
    echo "  cd server"
    echo "  npx ts-node src/db/run-migration-032.ts"
    exit 1
fi

echo ""
echo "2. 测试配额检查..."
echo ""

# 运行测试脚本
npx ts-node src/scripts/test-quota-check-after-adjustment.ts

echo ""
echo "========================================"
echo "验证完成"
echo "========================================"
echo ""
echo "如果看到 '✅ 一致'，说明修复成功！"
echo ""
