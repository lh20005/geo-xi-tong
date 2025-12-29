#!/bin/bash

# 多租户路由批量修复脚本
# 此脚本会备份原文件并应用租户隔离修复

echo "🔧 开始批量修复多租户路由..."
echo ""

# 创建备份目录
BACKUP_DIR="route-backups-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📦 备份原始文件到: $BACKUP_DIR"

# 需要修复的文件列表
FILES=(
  "server/src/routes/articleGeneration.ts"
  "server/src/routes/distillation.ts"
  "server/src/routes/article.ts"
  "server/src/routes/platformAccounts.ts"
  "server/src/routes/publishingTasks.ts"
)

# 备份文件
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    cp "$file" "$BACKUP_DIR/$(basename $file)"
    echo "  ✅ 已备份: $file"
  else
    echo "  ⚠️  文件不存在: $file"
  fi
done

echo ""
echo "✅ 备份完成！"
echo ""
echo "📝 接下来需要手动修复以下文件："
echo ""
echo "1. articleGeneration.ts - 文章生成任务"
echo "2. distillation.ts - 蒸馏结果（复杂）"
echo "3. article.ts - 文章管理（复杂）"
echo "4. platformAccounts.ts - 平台账号"
echo "5. publishingTasks.ts - 发布任务"
echo ""
echo "修复模式："
echo "  1. 添加导入和中间件"
echo "  2. 在每个路由中获取 userId"
echo "  3. 修改查询添加 user_id 过滤"
echo ""
echo "参考文件："
echo "  - server/src/routes/conversionTarget.ts"
echo "  - server/src/routes/articleSettings.ts"
echo ""
echo "详细指南："
echo "  - 查看 🎯最终修复总结和指南.md"
echo ""
