#!/bin/bash

echo "========================================="
echo "🔍 头条号图片上传问题快速诊断"
echo "========================================="
echo ""

# 1. 检查图片文件
echo "📂 1. 检查图片文件..."
if [ -d "server/uploads/gallery" ]; then
  IMAGE_COUNT=$(find server/uploads/gallery -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" | wc -l)
  echo "✅ gallery目录存在"
  echo "📊 图片文件数: $IMAGE_COUNT"
  
  if [ $IMAGE_COUNT -gt 0 ]; then
    echo ""
    echo "最近5个图片文件:"
    ls -lht server/uploads/gallery/*.{png,jpg,jpeg} 2>/dev/null | head -5 | while read line; do
      echo "  $line"
    done
  fi
else
  echo "❌ gallery目录不存在！"
fi

echo ""
echo "========================================="
echo "📝 2. 检查最新日志（头条号图片上传）"
echo "========================================="

if [ -f "server.log" ]; then
  echo ""
  echo "最近的图片上传日志:"
  grep "头条.*图片\|头条.*uploadFile\|头条.*❌.*图片" server.log | tail -20
  
  echo ""
  echo "最近的错误日志:"
  grep "头条.*❌" server.log | tail -10
else
  echo "⚠️  server.log文件不存在"
fi

echo ""
echo "========================================="
echo "🔧 3. 检查代码修复状态"
echo "========================================="

# 检查ToutiaoAdapter是否已修复
if grep -q "path.join(process.cwd(), 'server', imagePath)" server/src/services/adapters/ToutiaoAdapter.ts; then
  echo "✅ ToutiaoAdapter.ts 路径已修复"
else
  echo "❌ ToutiaoAdapter.ts 路径未修复"
fi

# 检查编译状态
if [ -f "server/dist/services/adapters/ToutiaoAdapter.js" ]; then
  echo "✅ ToutiaoAdapter.js 已编译"
  
  # 检查编译后的文件是否包含修复
  if grep -q "'server'" server/dist/services/adapters/ToutiaoAdapter.js; then
    echo "✅ 编译后的文件包含修复"
  else
    echo "❌ 编译后的文件不包含修复，需要重新编译"
    echo "💡 运行: cd server && npm run build"
  fi
else
  echo "❌ ToutiaoAdapter.js 未编译"
  echo "💡 运行: cd server && npm run build"
fi

echo ""
echo "========================================="
echo "🚀 4. 检查服务状态"
echo "========================================="

if pgrep -f "node.*server/dist/index.js" > /dev/null; then
  echo "✅ 后端服务正在运行"
  PID=$(pgrep -f "node.*server/dist/index.js")
  echo "📊 进程ID: $PID"
else
  echo "❌ 后端服务未运行"
  echo "💡 启动服务: ./restart-backend.sh"
fi

echo ""
echo "========================================="
echo "💡 诊断总结"
echo "========================================="
echo ""

# 总结问题
ISSUES=0

if [ ! -d "server/uploads/gallery" ]; then
  echo "❌ 问题1: gallery目录不存在"
  ISSUES=$((ISSUES+1))
fi

if ! grep -q "path.join(process.cwd(), 'server', imagePath)" server/src/services/adapters/ToutiaoAdapter.ts; then
  echo "❌ 问题2: 源代码未修复"
  ISSUES=$((ISSUES+1))
fi

if [ ! -f "server/dist/services/adapters/ToutiaoAdapter.js" ] || ! grep -q "'server'" server/dist/services/adapters/ToutiaoAdapter.js; then
  echo "❌ 问题3: 编译文件未更新"
  ISSUES=$((ISSUES+1))
fi

if ! pgrep -f "node.*server/dist/index.js" > /dev/null; then
  echo "❌ 问题4: 服务未运行"
  ISSUES=$((ISSUES+1))
fi

if [ $ISSUES -eq 0 ]; then
  echo "✅ 所有检查通过！"
  echo ""
  echo "📋 下一步："
  echo "1. 测试头条号图片发布"
  echo "2. 查看实时日志: tail -f server.log | grep 头条"
  echo "3. 如果仍然失败，查看详细日志找出具体原因"
else
  echo ""
  echo "⚠️  发现 $ISSUES 个问题，请先解决这些问题"
  echo ""
  echo "📋 修复步骤："
  
  if ! grep -q "path.join(process.cwd(), 'server', imagePath)" server/src/services/adapters/ToutiaoAdapter.ts; then
    echo "1. 运行修复脚本: ./fix-all-adapters-image-path.sh"
  fi
  
  if [ ! -f "server/dist/services/adapters/ToutiaoAdapter.js" ] || ! grep -q "'server'" server/dist/services/adapters/ToutiaoAdapter.js; then
    echo "2. 重新编译: cd server && npm run build"
  fi
  
  if ! pgrep -f "node.*server/dist/index.js" > /dev/null; then
    echo "3. 重启服务: ./restart-backend.sh"
  fi
fi

echo ""
echo "========================================="
echo "📚 相关文档"
echo "========================================="
echo "- 详细流程: 头条号自动发布详细流程和调试指南.md"
echo "- 修复报告: ✅头条号图片上传路径修复完成.md"
echo "- 测试指南: 测试头条号图片上传.md"
echo ""
