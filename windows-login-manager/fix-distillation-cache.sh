#!/bin/bash

echo "=== Windows 端蒸馏显示问题 - 快速修复 ==="
echo ""

# 检查操作系统
if [[ "$OSTYPE" == "darwin"* ]]; then
  CACHE_DIR="$HOME/Library/Application Support/ai-geo-system/Cache"
  CODE_CACHE_DIR="$HOME/Library/Application Support/ai-geo-system/Code Cache"
  PLATFORM="macOS"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
  CACHE_DIR="$APPDATA/ai-geo-system/Cache"
  CODE_CACHE_DIR="$APPDATA/ai-geo-system/Code Cache"
  PLATFORM="Windows"
else
  echo "❌ 不支持的操作系统: $OSTYPE"
  exit 1
fi

echo "📍 平台: $PLATFORM"
echo ""

# 检查应用是否正在运行
echo "🔍 检查应用状态..."
if pgrep -f "ai-geo-system" > /dev/null; then
  echo "⚠️  应用正在运行！"
  echo ""
  echo "请先完全退出应用，然后重新运行此脚本。"
  echo ""
  echo "退出方法:"
  echo "1. 点击应用窗口右上角的 × 按钮"
  echo "2. 确保应用图标从任务栏/Dock 消失"
  echo "3. 重新运行此脚本"
  exit 1
fi

echo "✅ 应用未运行"
echo ""

# 清除缓存
echo "🧹 清除应用缓存..."

if [ -d "$CACHE_DIR" ]; then
  echo "删除: $CACHE_DIR"
  rm -rf "$CACHE_DIR"
  echo "✅ Cache 已删除"
else
  echo "ℹ️  Cache 目录不存在"
fi

if [ -d "$CODE_CACHE_DIR" ]; then
  echo "删除: $CODE_CACHE_DIR"
  rm -rf "$CODE_CACHE_DIR"
  echo "✅ Code Cache 已删除"
else
  echo "ℹ️  Code Cache 目录不存在"
fi

echo ""
echo "=" | tr -d '\n' | head -c 60
echo ""
echo ""
echo "✅ 缓存清除完成！"
echo ""
echo "📋 下一步操作:"
echo "1. 重新启动应用"
echo "2. 登录账号（如果需要）"
echo "3. 进入蒸馏管理页面"
echo "4. 应该能看到所有蒸馏结果了"
echo ""
echo "预期结果:"
echo "- 法国留学: 12 个话题"
echo "- 周口装修公司: 12 个话题"
echo "- 装修装饰公司: 12 个话题"
echo ""
