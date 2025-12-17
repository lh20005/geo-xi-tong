#!/bin/bash

echo "=========================================="
echo "发布任务模态框诊断工具"
echo "=========================================="
echo ""

# 检查文件是否存在
FILE="client/src/components/Publishing/PublishingConfigModal.tsx"
if [ ! -f "$FILE" ]; then
    echo "❌ 错误：找不到文件 $FILE"
    exit 1
fi

echo "✅ 文件存在：$FILE"
echo ""

# 检查关键代码
echo "📋 检查关键代码..."
echo ""

# 检查是否有 Table 组件
if grep -q "<Table" "$FILE"; then
    echo "✅ 找到 Table 组件"
else
    echo "❌ 未找到 Table 组件"
fi

# 检查是否有 pagination 配置
if grep -q "pagination={{" "$FILE"; then
    echo "✅ 找到 pagination 配置"
else
    echo "❌ 未找到 pagination 配置"
fi

# 检查是否有 scroll 配置（不应该有）
if grep -q "scroll.*{" "$FILE"; then
    echo "⚠️  警告：找到 scroll 配置（可能导致滚动）"
    grep -n "scroll" "$FILE"
else
    echo "✅ 没有 scroll 配置（正确）"
fi

# 检查 Modal 宽度
if grep -q "width={1200}" "$FILE"; then
    echo "✅ Modal 宽度设置为 1200px"
else
    echo "⚠️  警告：Modal 宽度可能不是 1200px"
fi

# 检查分页选项
if grep -q "pageSizeOptions=\[" "$FILE"; then
    echo "✅ 找到分页选项配置"
    grep -A 1 "pageSizeOptions" "$FILE" | head -2
else
    echo "❌ 未找到分页选项配置"
fi

# 检查是否有 showQuickJumper
if grep -q "showQuickJumper: true" "$FILE"; then
    echo "✅ 启用了快速跳转功能"
else
    echo "⚠️  警告：未启用快速跳转功能"
fi

echo ""
echo "=========================================="
echo "📊 代码统计"
echo "=========================================="
echo ""

# 统计行数
LINES=$(wc -l < "$FILE")
echo "总行数: $LINES"

# 统计 useState 数量
STATES=$(grep -c "useState" "$FILE")
echo "状态数量: $STATES"

# 统计 useEffect 数量
EFFECTS=$(grep -c "useEffect" "$FILE")
echo "副作用数量: $EFFECTS"

echo ""
echo "=========================================="
echo "🔍 关键配置检查"
echo "=========================================="
echo ""

# 提取 pagination 配置
echo "分页配置："
grep -A 15 "pagination={{" "$FILE" | head -16

echo ""
echo "=========================================="
echo "💡 建议"
echo "=========================================="
echo ""

echo "1. 如果看到的还是滚动式列表，请尝试："
echo "   - 清除浏览器缓存（Ctrl+Shift+R 或 Cmd+Shift+R）"
echo "   - 重启前端开发服务器"
echo "   - 检查浏览器控制台是否有错误"
echo ""
echo "2. 验证要点："
echo "   - Modal 宽度应该是 1200px"
echo "   - Table 不应该有 scroll 属性"
echo "   - 应该有 pagination 配置"
echo "   - 分页器应该在表格底部显示"
echo ""
echo "3. 打开测试页面："
echo "   open test-publishing-modal-pagination.html"
echo ""

echo "=========================================="
echo "诊断完成！"
echo "=========================================="
