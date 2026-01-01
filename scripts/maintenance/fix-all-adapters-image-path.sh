#!/bin/bash

echo "========================================="
echo "🔧 批量修复所有平台适配器的图片路径问题"
echo "========================================="
echo ""

# 需要修复的适配器列表
adapters=(
  "JianshuAdapter.ts"
  "WangyiAdapter.ts"
  "BaijiahaoAdapter.ts"
  "XiaohongshuAdapter.ts"
  "CSDNAdapter.ts"
  "ZhihuAdapter.ts"
  "SouhuAdapter.ts"
  "QieAdapter.ts"
  "BilibiliAdapter.ts"
  "DouyinAdapter.ts"
)

adapter_dir="server/src/services/adapters"

for adapter in "${adapters[@]}"; do
  file_path="$adapter_dir/$adapter"
  
  if [ -f "$file_path" ]; then
    echo "📝 修复: $adapter"
    
    # 备份原文件
    cp "$file_path" "$file_path.backup"
    
    # 修复路径1: process.cwd(), imagePath -> process.cwd(), 'server', imagePath
    sed -i '' 's/path\.join(process\.cwd(), imagePath)/path.join(process.cwd(), '\''server'\'', imagePath)/g' "$file_path"
    
    # 修复路径2: process.cwd(), 'uploads' -> process.cwd(), 'server', 'uploads'
    sed -i '' "s/path\.join(process\.cwd(), 'uploads'/path.join(process.cwd(), 'server', 'uploads'/g" "$file_path"
    
    echo "   ✅ 已修复并备份到 $file_path.backup"
  else
    echo "   ⚠️  文件不存在: $file_path"
  fi
done

echo ""
echo "========================================="
echo "✅ 批量修复完成"
echo "========================================="
echo ""
echo "💡 修复内容:"
echo "  - 所有图片路径查找从 uploads/ 改为 server/uploads/"
echo "  - 原文件已备份为 .backup 后缀"
echo ""
echo "📋 下一步:"
echo "  1. 重启服务器: ./restart-backend.sh"
echo "  2. 测试头条号发布"
echo "  3. 如果有问题，可以从 .backup 文件恢复"
