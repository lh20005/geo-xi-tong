#!/bin/bash

echo "======================================"
echo "测试Chrome路径"
echo "======================================"
echo ""

CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

echo "检查Chrome是否存在..."
if [ -f "$CHROME_PATH" ]; then
    echo "✅ Chrome已安装"
    echo "   路径: $CHROME_PATH"
    echo ""
    
    echo "检查Chrome版本..."
    "$CHROME_PATH" --version 2>/dev/null || echo "无法获取版本信息"
    echo ""
    
    echo "检查执行权限..."
    if [ -x "$CHROME_PATH" ]; then
        echo "✅ Chrome有执行权限"
    else
        echo "❌ Chrome没有执行权限"
        echo "   运行: chmod +x \"$CHROME_PATH\""
    fi
else
    echo "❌ Chrome未安装在默认位置"
    echo "   请安装Chrome或检查路径"
fi

echo ""
echo "======================================"
echo "测试完成"
echo "======================================"
