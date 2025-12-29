#!/bin/bash

# 清理文档中的敏感信息脚本
# 使用方法: ./scripts/clean-sensitive-docs.sh

echo "🔒 开始清理文档中的敏感信息..."

# 定义敏感信息的占位符
APP_ID_PLACEHOLDER="wx_your_app_id_here"
MCH_ID_PLACEHOLDER="your_merchant_id"
API_KEY_PLACEHOLDER="your_32_character_api_v3_key_here"
SERIAL_NO_PLACEHOLDER="your_certificate_serial_number_here"
PUBLIC_KEY_ID_PLACEHOLDER="PUB_KEY_ID_your_public_key_id_here"

# 真实的敏感信息（需要替换）
REAL_APP_ID="wx76c24846b57dfaa9"
REAL_MCH_ID="1103960104"
REAL_API_KEY="3453DGDsdf3gsd564DSFDSR2N67N8Lfs"
REAL_SERIAL_NO="305B80592042FA4A46F7A68E10044169EE13093D"
REAL_PUBLIC_KEY_ID="PUB_KEY_ID_0111039601042025122900292089000201"

# 需要清理的文档文件列表
FILES=(
  "✅完整支付测试指南.md"
  "QUICK_SETUP_WECHAT_PAY.md"
  "HOW_TO_GET_PRIVATE_KEY.md"
  "YOUR_WECHAT_PAY_CONFIG.md"
  "✅支付功能测试成功.md"
  "环境变量配置说明.md"
  "ngrok测试支付-已修复.md"
  "下一步操作指南.md"
  "申请微信支付APIv3.md"
  "微信支付配置完成.md"
  "WECHAT_PAY_SETUP_GUIDE.md"
  "文档更新说明-公钥模式.md"
  "✅服务器启动成功-立即测试.md"
  "微信支付测试-完整流程.md"
  "本地测试-vs-ngrok测试.md"
  "立即测试支付.md"
  "测试支付功能.md"
  "开始测试支付.md"
  "快速修复支付问题.md"
  "最终解决方案.md"
  "配置总结.md"
  "🚀立即开始测试.md"
  "✅准备完成-开始测试.md"
)

# 备份目录
BACKUP_DIR="docs-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📦 创建备份目录: $BACKUP_DIR"

# 计数器
CLEANED_COUNT=0
SKIPPED_COUNT=0

# 遍历文件并替换
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "📝 处理: $file"
    
    # 备份原文件
    cp "$file" "$BACKUP_DIR/"
    
    # 替换敏感信息
    sed -i.tmp \
      -e "s/$REAL_APP_ID/$APP_ID_PLACEHOLDER/g" \
      -e "s/$REAL_MCH_ID/$MCH_ID_PLACEHOLDER/g" \
      -e "s/$REAL_API_KEY/$API_KEY_PLACEHOLDER/g" \
      -e "s/$REAL_SERIAL_NO/$SERIAL_NO_PLACEHOLDER/g" \
      -e "s/$REAL_PUBLIC_KEY_ID/$PUBLIC_KEY_ID_PLACEHOLDER/g" \
      "$file"
    
    # 删除临时文件
    rm -f "${file}.tmp"
    
    CLEANED_COUNT=$((CLEANED_COUNT + 1))
  else
    echo "⚠️  文件不存在: $file"
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
  fi
done

echo ""
echo "✅ 清理完成！"
echo "   - 已处理: $CLEANED_COUNT 个文件"
echo "   - 跳过: $SKIPPED_COUNT 个文件"
echo "   - 备份位置: $BACKUP_DIR"
echo ""
echo "⚠️  重要提示："
echo "   1. 请检查清理后的文件是否正确"
echo "   2. 如果有问题，可以从备份目录恢复"
echo "   3. 确认无误后，可以删除备份目录"
echo ""
echo "🔍 验证命令："
echo "   grep -r '$REAL_APP_ID' *.md"
echo "   grep -r '$REAL_MCH_ID' *.md"
echo ""
