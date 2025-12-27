#!/bin/bash

# 前端性能测试脚本

echo "======================================"
echo "前端性能测试"
echo "======================================"
echo ""

SERVER="http://43.143.163.6"

echo "📊 测试 1: HTML 加载速度"
echo "--------------------------------------"
curl -s -o /dev/null -w "时间: %{time_total}s | 大小: %{size_download} bytes\n" $SERVER/app/
echo ""

echo "📊 测试 2: CSS 加载速度"
echo "--------------------------------------"
CSS_FILE=$(curl -s $SERVER/app/ | grep -o 'href="/app/assets/[^"]*\.css"' | head -1 | sed 's/href="//;s/"//')
if [ -n "$CSS_FILE" ]; then
    curl -s -o /dev/null -w "时间: %{time_total}s | 大小: %{size_download} bytes\n" $SERVER$CSS_FILE
else
    echo "未找到 CSS 文件"
fi
echo ""

echo "📊 测试 3: 主 JS 加载速度"
echo "--------------------------------------"
JS_FILE=$(curl -s $SERVER/app/ | grep -o 'src="/app/assets/[^"]*\.js"' | head -1 | sed 's/src="//;s/"//')
if [ -n "$JS_FILE" ]; then
    echo "文件: $JS_FILE"
    echo "未压缩:"
    curl -s -o /dev/null -w "  时间: %{time_total}s | 大小: %{size_download} bytes (%.2f MB)\n" $SERVER$JS_FILE
    echo "Gzip 压缩:"
    curl -s -H "Accept-Encoding: gzip" -o /dev/null -w "  时间: %{time_total}s | 大小: %{size_download} bytes (%.2f KB)\n" $SERVER$JS_FILE
else
    echo "未找到 JS 文件"
fi
echo ""

echo "📊 测试 4: 服务器资源使用"
echo "--------------------------------------"
if command -v sshpass &> /dev/null; then
    sshpass -p 'Woaini7758521@' ssh -o StrictHostKeyChecking=no ubuntu@43.143.163.6 "
        echo '内存使用:'
        free -h | grep Mem | awk '{print \"  总量: \"\$2\" | 已用: \"\$3\" | 可用: \"\$7}'
        echo ''
        echo 'CPU 负载:'
        uptime | awk -F'load average:' '{print \"  \"\$2}'
        echo ''
        echo '磁盘使用:'
        df -h / | tail -1 | awk '{print \"  总量: \"\$2\" | 已用: \"\$3\" | 可用: \"\$4\" | 使用率: \"\$5}'
    " 2>/dev/null
else
    echo "需要 sshpass 才能测试服务器资源"
fi
echo ""

echo "📊 测试 5: Nginx 配置检查"
echo "--------------------------------------"
echo "Gzip 压缩:"
GZIP=$(curl -s -H "Accept-Encoding: gzip" -I $SERVER/app/assets/index-CMdy-wqx.js 2>/dev/null | grep -i "content-encoding: gzip")
if [ -n "$GZIP" ]; then
    echo "  ✅ 已启用"
else
    echo "  ❌ 未启用"
fi

echo "缓存控制:"
CACHE=$(curl -s -I $SERVER/app/assets/index-CMdy-wqx.js 2>/dev/null | grep -i "cache-control")
if [ -n "$CACHE" ]; then
    echo "  ✅ $CACHE"
else
    echo "  ⚠️  未配置"
fi
echo ""

echo "======================================"
echo "性能分析总结"
echo "======================================"
echo ""

# 计算总加载时间
HTML_TIME=$(curl -s -o /dev/null -w "%{time_total}" $SERVER/app/)
CSS_TIME=$(curl -s -o /dev/null -w "%{time_total}" $SERVER$CSS_FILE 2>/dev/null || echo "0")
JS_TIME=$(curl -s -o /dev/null -w "%{time_total}" $SERVER$JS_FILE 2>/dev/null || echo "0")

TOTAL_TIME=$(echo "$HTML_TIME + $CSS_TIME + $JS_TIME" | bc)

echo "总加载时间: ${TOTAL_TIME}s"
echo ""

if (( $(echo "$TOTAL_TIME > 2" | bc -l) )); then
    echo "⚠️  加载速度较慢，建议优化："
    echo "   1. 启用路由懒加载"
    echo "   2. 启用组件懒加载"
    echo "   3. 优化 Antd 导入"
    echo ""
    echo "📖 详细方案: docs/06-问题修复/前端加载慢优化方案.md"
elif (( $(echo "$TOTAL_TIME > 1" | bc -l) )); then
    echo "✅ 加载速度正常，可以进一步优化"
else
    echo "✅ 加载速度优秀！"
fi

echo ""
echo "======================================"
