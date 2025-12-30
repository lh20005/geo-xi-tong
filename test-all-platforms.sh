#!/bin/bash

# 批量测试所有平台登录功能
# 使用方法: ./test-all-platforms.sh

echo "========================================="
echo "🧪 批量测试所有平台登录功能"
echo "========================================="
echo ""

# 定义所有平台（除抖音外）
PLATFORMS=(
  # 自媒体平台
  "toutiao:头条号:✅已测试"
  "wangyi:网易号:⏳待测试"
  "souhu:搜狐号:⏳待测试"
  "baijiahao:百家号:⏳待测试"
  "qie:企鹅号:⏳待测试"
  
  # 社交媒体平台
  "xiaohongshu:小红书:⏳待测试"
  "wechat:微信公众号:⏳待测试"
  "bilibili:B站:⏳待测试"
  
  # 技术社区平台
  "zhihu:知乎:⏳待测试"
  "jianshu:简书:⏳待测试"
  "csdn:CSDN:⏳待测试"
  "juejin:掘金:⏳待测试"
  "segmentfault:SegmentFault:⏳待测试"
  "oschina:开源中国:⏳待测试"
  "cnblogs:博客园:⏳待测试"
  "v2ex:V2EX:⏳待测试"
)

echo "📋 支持的平台列表:"
echo ""
echo "自媒体平台 (5个):"
echo "  1. 头条号 (toutiao) - ✅ 已测试"
echo "  2. 网易号 (wangyi)"
echo "  3. 搜狐号 (souhu)"
echo "  4. 百家号 (baijiahao)"
echo "  5. 企鹅号 (qie)"
echo ""
echo "社交媒体平台 (3个，抖音已跳过):"
echo "  6. 小红书 (xiaohongshu)"
echo "  7. 微信公众号 (wechat)"
echo "  8. B站 (bilibili)"
echo ""
echo "技术社区平台 (8个):"
echo "  9. 知乎 (zhihu)"
echo "  10. 简书 (jianshu)"
echo "  11. CSDN (csdn)"
echo "  12. 掘金 (juejin)"
echo "  13. SegmentFault (segmentfault)"
echo "  14. 开源中国 (oschina)"
echo "  15. 博客园 (cnblogs)"
echo "  16. V2EX (v2ex)"
echo ""
echo "总计: 16个平台（除抖音外全部）"
echo ""
echo "========================================="
echo ""

# 询问用户选择测试方式
echo "请选择测试方式:"
echo "  1. 交互式测试（逐个测试，需要手动登录）"
echo "  2. 仅显示配置信息（不实际登录）"
echo "  3. 测试特定平台"
echo ""
read -p "请输入选项 (1/2/3): " CHOICE

case $CHOICE in
  1)
    echo ""
    echo "🚀 开始交互式测试..."
    echo ""
    
    for PLATFORM_INFO in "${PLATFORMS[@]}"; do
      IFS=':' read -r PLATFORM_ID PLATFORM_NAME STATUS <<< "$PLATFORM_INFO"
      
      echo "========================================="
      echo "📱 测试平台: $PLATFORM_NAME ($PLATFORM_ID)"
      echo "当前状态: $STATUS"
      echo "========================================="
      echo ""
      
      read -p "是否测试此平台? (y/n/q): " CONFIRM
      
      if [ "$CONFIRM" = "q" ]; then
        echo "❌ 用户取消测试"
        exit 0
      fi
      
      if [ "$CONFIRM" = "y" ]; then
        echo "🔄 正在测试 $PLATFORM_NAME..."
        ./test-platform-login.sh "$PLATFORM_ID"
        echo ""
        read -p "按回车继续下一个平台..."
      else
        echo "⏭️  跳过 $PLATFORM_NAME"
      fi
      
      echo ""
    done
    
    echo "✅ 所有测试完成！"
    ;;
    
  2)
    echo ""
    echo "📋 平台配置信息:"
    echo ""
    
    for PLATFORM_INFO in "${PLATFORMS[@]}"; do
      IFS=':' read -r PLATFORM_ID PLATFORM_NAME STATUS <<< "$PLATFORM_INFO"
      echo "- $PLATFORM_NAME ($PLATFORM_ID) - $STATUS"
    done
    
    echo ""
    echo "💡 提示: 使用 ./test-platform-login.sh <platform_id> 测试单个平台"
    ;;
    
  3)
    echo ""
    echo "可用的平台ID:"
    for PLATFORM_INFO in "${PLATFORMS[@]}"; do
      IFS=':' read -r PLATFORM_ID PLATFORM_NAME STATUS <<< "$PLATFORM_INFO"
      echo "  - $PLATFORM_ID ($PLATFORM_NAME)"
    done
    echo ""
    read -p "请输入要测试的平台ID: " PLATFORM_ID
    
    if [ -n "$PLATFORM_ID" ]; then
      ./test-platform-login.sh "$PLATFORM_ID"
    else
      echo "❌ 未输入平台ID"
    fi
    ;;
    
  *)
    echo "❌ 无效的选项"
    exit 1
    ;;
esac

echo ""
echo "========================================="
echo "🎉 测试流程结束"
echo "========================================="
