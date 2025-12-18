#!/bin/bash

echo "=========================================="
echo "抖音发布调试脚本"
echo "=========================================="
echo ""

echo "1. 检查服务器是否运行..."
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ 服务器正在运行"
else
    echo "❌ 服务器未运行，请先启动: cd server && npm start"
    exit 1
fi

echo ""
echo "2. 检查抖音账号..."
DOUYIN_ACCOUNT=$(curl -s "http://localhost:3000/api/publishing/accounts/platform/douyin")
ACCOUNT_COUNT=$(echo $DOUYIN_ACCOUNT | grep -o '"id"' | wc -l)

if [ $ACCOUNT_COUNT -gt 0 ]; then
    echo "✅ 找到 $ACCOUNT_COUNT 个抖音账号"
    echo "$DOUYIN_ACCOUNT" | python3 -m json.tool 2>/dev/null || echo "$DOUYIN_ACCOUNT"
else
    echo "❌ 没有找到抖音账号"
    echo "请先在平台登录页面登录抖音"
    exit 1
fi

echo ""
echo "3. 检查测试文章..."
ARTICLES=$(curl -s "http://localhost:3000/api/articles?limit=5")
ARTICLE_COUNT=$(echo $ARTICLES | grep -o '"id"' | wc -l)

if [ $ARTICLE_COUNT -gt 0 ]; then
    echo "✅ 找到 $ARTICLE_COUNT 篇文章"
    echo "文章列表："
    echo "$ARTICLES" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if 'data' in data:
        for i, article in enumerate(data['data'][:5], 1):
            print(f\"  [{i}] ID={article['id']}, 标题={article['title'][:30]}...\")
except:
    pass
" 2>/dev/null
else
    echo "❌ 没有找到文章"
    exit 1
fi

echo ""
echo "4. 查看最近的服务器日志..."
if [ -f "server/logs/app.log" ]; then
    echo "最近10条日志："
    tail -10 server/logs/app.log | grep -E "抖音|douyin|ERROR" || echo "  (没有相关日志)"
else
    echo "⚠️  日志文件不存在"
fi

echo ""
echo "=========================================="
echo "调试提示："
echo "=========================================="
echo ""
echo "如果发布没有任何操作，请检查："
echo ""
echo "1. 查看实时日志："
echo "   tail -f server/logs/app.log | grep 抖音"
echo ""
echo "2. 查看浏览器截图："
echo "   open douyin-home-page.png"
echo ""
echo "3. 检查选择器是否有效："
echo "   - 打开 https://creator.douyin.com/creator-micro/home"
echo "   - 按 F12 打开开发者工具"
echo "   - 在 Console 中运行："
echo "     document.querySelector('#douyin-creator-master-side-upload')"
echo ""
echo "4. 手动测试发布流程："
echo "   - 登录抖音创作者中心"
echo "   - 悬停在"高清发布"按钮上"
echo "   - 查看是否出现下拉菜单"
echo "   - 点击"发布图文""
echo ""
echo "=========================================="
