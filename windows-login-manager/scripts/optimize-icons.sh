#!/bin/bash

# 图标优化脚本
# 使用 ImageMagick 和 pngquant 优化图标文件

echo "🎨 开始优化平台图标..."
echo ""

# 检查依赖
check_dependencies() {
    if ! command -v convert &> /dev/null; then
        echo "❌ ImageMagick 未安装"
        echo "安装方法: brew install imagemagick"
        exit 1
    fi
    
    if ! command -v pngquant &> /dev/null; then
        echo "⚠️  pngquant 未安装（可选，但推荐）"
        echo "安装方法: brew install pngquant"
    fi
}

# 创建备份目录
BACKUP_DIR="public/images/backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# 优化单个PNG图标
optimize_png() {
    local file=$1
    local target_size=$2
    local filename=$(basename "$file")
    
    echo "📦 优化 $filename..."
    
    # 备份原文件
    cp "$file" "$BACKUP_DIR/"
    
    # 获取原始大小
    local original_size=$(du -h "$file" | cut -f1)
    
    # 使用 ImageMagick 调整质量和尺寸
    convert "$file" \
        -strip \
        -quality 85 \
        -define png:compression-level=9 \
        "${file}.tmp"
    
    # 如果安装了 pngquant，进一步压缩
    if command -v pngquant &> /dev/null; then
        pngquant --quality=80-95 --speed 1 --force "${file}.tmp" --output "$file"
        rm "${file}.tmp"
    else
        mv "${file}.tmp" "$file"
    fi
    
    # 获取优化后大小
    local new_size=$(du -h "$file" | cut -f1)
    
    echo "   原始: $original_size → 优化后: $new_size"
}

# 优化JPEG图标
optimize_jpeg() {
    local file=$1
    local filename=$(basename "$file")
    
    echo "📦 优化 $filename..."
    
    # 备份原文件
    cp "$file" "$BACKUP_DIR/"
    
    # 获取原始大小
    local original_size=$(du -h "$file" | cut -f1)
    
    # 使用 ImageMagick 优化JPEG
    convert "$file" \
        -strip \
        -quality 80 \
        -sampling-factor 4:2:0 \
        "${file}.tmp"
    
    mv "${file}.tmp" "$file"
    
    # 获取优化后大小
    local new_size=$(du -h "$file" | cut -f1)
    
    echo "   原始: $original_size → 优化后: $new_size"
}

# 主函数
main() {
    cd "$(dirname "$0")/.." || exit
    
    check_dependencies
    
    echo "📁 备份目录: $BACKUP_DIR"
    echo ""
    
    # 优化大文件（> 40KB）
    echo "🔧 优化大文件..."
    echo ""
    
    # 头条号 (252KB) - 最需要优化
    if [ -f "public/images/toutiaohao.png" ]; then
        optimize_png "public/images/toutiaohao.png" 50
    fi
    
    # 搜狐号 (57KB JPEG)
    if [ -f "public/images/souhu.jpeg" ]; then
        optimize_jpeg "public/images/souhu.jpeg"
    fi
    
    # 微信公众号 (52KB)
    if [ -f "public/images/gongzhonghao.png" ]; then
        optimize_png "public/images/gongzhonghao.png" 30
    fi
    
    # 小红书 (44KB)
    if [ -f "public/images/xiaohongshu.png" ]; then
        optimize_png "public/images/xiaohongshu.png" 30
    fi
    
    echo ""
    echo "✅ 优化完成！"
    echo ""
    echo "📊 优化统计:"
    echo "   备份位置: $BACKUP_DIR"
    echo ""
    echo "💡 提示:"
    echo "   - 如果效果不满意，可以从备份目录恢复"
    echo "   - 建议在浏览器中测试图标显示效果"
    echo "   - 运行 'npm run dev' 查看效果"
}

main
