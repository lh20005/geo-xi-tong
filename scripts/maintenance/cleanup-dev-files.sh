#!/bin/bash

echo "🧹 清理开发测试文件..."
echo "================================"

# 统计清理前的文件数量
BEFORE=$(find . -type f | wc -l)
echo "清理前总文件数: $BEFORE"

echo ""
echo "🗑️  删除开发测试文件..."

# 1. 删除 dev-docs/tests 目录
if [ -d "dev-docs/tests" ]; then
    echo "删除 dev-docs/tests/ 目录..."
    rm -rf dev-docs/tests/
fi

# 2. 删除 server 中的测试文件
echo "删除 server 中的测试文件..."
rm -f server/test-*.ts
rm -f server/src/test-*.ts
rm -f server/src/scripts/test-*.ts
rm -f server/dist/test-*.js
rm -f server/dist/scripts/test-*.js

# 3. 删除 scripts/testing 相关目录
echo "删除测试脚本目录..."
rm -rf scripts/testing/
rm -rf scripts/testing-html/
rm -rf scripts/testing-js/

# 4. 删除其他测试文件
echo "删除其他测试文件..."
rm -f dev-docs/test-*.js
rm -f dev-docs/test-*.sh
rm -f dev-docs/test-*.md
rm -f landing/test-*.md

# 5. 删除临时和日志文件
echo "删除临时文件..."
find . -name "*.log" -not -path "*/node_modules/*" -delete 2>/dev/null || true
find . -name "*.tmp" -not -path "*/node_modules/*" -delete 2>/dev/null || true
find . -name "*~" -not -path "*/node_modules/*" -delete 2>/dev/null || true

# 6. 删除编译产物中的重复文件
echo "删除重复的编译文件..."
rm -f server/dist/*\ 2.js 2>/dev/null || true

# 统计清理后的文件数量
AFTER=$(find . -type f | wc -l)
DELETED=$((BEFORE - AFTER))

echo ""
echo "✅ 清理完成！"
echo "================================"
echo "清理前文件数: $BEFORE"
echo "清理后文件数: $AFTER"
echo "删除文件数: $DELETED"
echo ""

if [ $DELETED -gt 0 ]; then
    echo "🎉 成功删除了 $DELETED 个开发测试文件"
    echo "💾 节省了磁盘空间"
else
    echo "ℹ️  没有找到需要清理的文件"
fi

echo ""
echo "📋 保留的重要文件:"
echo "  ✅ 所有源代码文件"
echo "  ✅ 配置文件"
echo "  ✅ 文档文件"
echo "  ✅ node_modules (依赖包)"
echo "  ✅ 编译后的生产文件"