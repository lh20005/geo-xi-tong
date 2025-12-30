#!/bin/bash

echo "=========================================="
echo "小红书登录快速测试"
echo "=========================================="
echo ""

echo "📋 修复内容："
echo "  ✅ 登录检测：URL跳转到 https://creator.xiaohongshu.com/new/home"
echo "  ✅ 用户名提取：#header-area > div > div > div:nth-child(2) > div > span"
echo ""

echo "🚀 启动测试..."
echo ""

node test-xiaohongshu-selectors.js

echo ""
echo "=========================================="
echo "测试完成"
echo "=========================================="
