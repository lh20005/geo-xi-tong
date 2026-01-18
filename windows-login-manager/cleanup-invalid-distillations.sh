#!/bin/bash

# 清理无效的蒸馏记录
# 这些记录的话题保存失败，需要删除后重新执行蒸馏

echo "=== 清理无效蒸馏记录 ==="
echo ""
echo "将要删除以下记录："
echo "  ID 19: 装修装饰公司 (2026-01-16)"
echo "  ID 20: 装修公司 (2026-01-17)"
echo "  ID 21: 装修公司 (2026-01-17)"
echo "  ID 22: 应该留学 (2026-01-17)"
echo "  ID 23: 应该留学 (2026-01-17)"
echo "  ID 24: 应该留学 (2026-01-17)"
echo "  ID 25: 如何蒸馏 (2026-01-17)"
echo ""
echo "这些记录的话题保存失败（actual_topics=0），需要删除后重新执行蒸馏。"
echo ""

read -p "确认删除？(y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo "正在删除..."
    psql -U lzc -d geo_windows -c "DELETE FROM distillations WHERE id IN (19, 20, 21, 22, 23, 24, 25);"
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ 删除成功！"
        echo ""
        echo "现在可以重新执行蒸馏："
        echo "  1. 打开应用"
        echo "  2. 进入关键词蒸馏页面"
        echo "  3. 输入关键词并执行蒸馏"
        echo "  4. 验证结果页面显示正常"
    else
        echo ""
        echo "❌ 删除失败，请检查数据库连接"
    fi
else
    echo "已取消"
fi
