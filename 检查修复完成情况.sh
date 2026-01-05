#!/bin/bash

echo "================================"
echo "检查存储空间配额调整修复完成情况"
echo "================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_pass() {
    echo -e "${GREEN}✅ $1${NC}"
}

check_fail() {
    echo -e "${RED}❌ $1${NC}"
}

check_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo "📋 检查修改的文件..."
echo ""

# 检查前端文件
if grep -q "addonAfter.*storage_space.*MB" client/src/components/UserSubscription/AdjustQuotaModal.tsx 2>/dev/null; then
    check_pass "前端文件已修改：AdjustQuotaModal.tsx"
else
    check_fail "前端文件未修改或修改不正确"
fi

# 检查后端文件
if grep -q "storage_quota_changed" server/src/services/UserSubscriptionManagementService.ts 2>/dev/null; then
    check_pass "后端文件已修改：UserSubscriptionManagementService.ts"
else
    check_fail "后端文件未修改或修改不正确"
fi

echo ""
echo "📝 检查文档..."
echo ""

# 检查文档
docs=(
    "✅存储空间配额调整单位和同步修复完成.md"
    "测试存储空间配额调整和同步.md"
    "验证配额调整修复.md"
    "配额调整修复总结.md"
    "QUICK_FIX_STORAGE_QUOTA.md"
)

for doc in "${docs[@]}"; do
    if [ -f "$doc" ]; then
        check_pass "文档已创建：$doc"
    else
        check_fail "文档缺失：$doc"
    fi
done

echo ""
echo "🧪 检查测试脚本..."
echo ""

if [ -f "server/src/scripts/test-storage-quota-adjustment.ts" ]; then
    check_pass "测试脚本已创建"
else
    check_fail "测试脚本缺失"
fi

if [ -f "快速测试配额调整.sh" ]; then
    check_pass "快速测试脚本已创建"
else
    check_fail "快速测试脚本缺失"
fi

echo ""
echo "🔨 检查编译状态..."
echo ""

if [ -d "server/dist" ]; then
    check_pass "后端已编译"
else
    check_warn "后端未编译，运行: cd server && npm run build"
fi

echo ""
echo "================================"
echo "检查完成"
echo "================================"
echo ""
echo "📝 下一步："
echo "1. 运行测试: ./快速测试配额调整.sh"
echo "2. 启动服务进行手动测试"
echo "3. 查看文档: cat QUICK_FIX_STORAGE_QUOTA.md"
echo ""
