#!/bin/bash

echo "🗂️  继续整理根目录文件..."

# ==================== 移动剩余文档 ====================

echo "📄 移动剩余的修复和测试文档..."
mv -v 🔥*.md docs/07-开发文档/修复记录/ 2>/dev/null

echo "📄 移动实施指南文档..."
mv -v 平台选择器配置参考.md docs/07-开发文档/实施指南/ 2>/dev/null
mv -v 头条号自动发布详细流程和调试指南.md docs/07-开发文档/实施指南/ 2>/dev/null
mv -v 账号登录测试-快速指南.md docs/07-开发文档/实施指南/ 2>/dev/null
mv -v PAYMENT_QUICK_TEST.md docs/07-开发文档/实施指南/ 2>/dev/null
mv -v HOW_TO_GET_PRIVATE_KEY.md docs/07-开发文档/实施指南/ 2>/dev/null
mv -v LOCAL_DEV_SETUP.md docs/07-开发文档/实施指南/ 2>/dev/null
mv -v WECHAT_PAY_TROUBLESHOOTING.md docs/07-开发文档/实施指南/ 2>/dev/null
mv -v YOUR_WECHAT_PAY_CONFIG.md docs/07-开发文档/实施指南/ 2>/dev/null
mv -v README_多租户实施.md docs/07-开发文档/实施指南/ 2>/dev/null

echo "📄 移动技术分析文档..."
mv -v ADAPTER_MIGRATION_ANALYSIS.md docs/07-开发文档/技术分析/ 2>/dev/null
mv -v BROWSER_FULLSCREEN_CONFIG.md docs/07-开发文档/技术分析/ 2>/dev/null
mv -v BROWSERVIEW_FULLSCREEN_FINAL.md docs/07-开发文档/技术分析/ 2>/dev/null
mv -v WINDOWS_FULLSCREEN_CONFIG.md docs/07-开发文档/技术分析/ 2>/dev/null
mv -v CHROME_DEVTOOLS_MCP_方案.md docs/07-开发文档/技术分析/ 2>/dev/null

echo "📄 移动完成报告..."
mv -v MIGRATION_SUCCESS.md docs/07-开发文档/修复记录/ 2>/dev/null
mv -v PLAYWRIGHT_MIGRATION_COMPLETED.md docs/07-开发文档/修复记录/ 2>/dev/null
mv -v ngrok测试支付-已修复.md docs/07-开发文档/修复记录/ 2>/dev/null

echo "📄 移动测试文档..."
mv -v test-account-delete-fix.md docs/07-开发文档/实施指南/ 2>/dev/null
mv -v test-knowledge-base-upload.md docs/07-开发文档/实施指南/ 2>/dev/null
mv -v test-websocket-isolation.md docs/07-开发文档/实施指南/ 2>/dev/null
mv -v fix-tenant-isolation.md docs/07-开发文档/实施指南/ 2>/dev/null

# ==================== 移动剩余脚本 ====================

echo "🔧 移动剩余脚本..."
mv -v apply-tenant-fixes.sh scripts/maintenance/ 2>/dev/null
mv -v 手动全屏测试脚本.js scripts/testing/ 2>/dev/null

# ==================== 清理 ====================

echo "🗑️  移动整理脚本到 temp..."
mv -v organize-root-files.sh temp/ 2>/dev/null

echo ""
echo "✅ 继续整理完成！"
echo ""
echo "📊 当前根目录状态："
ls -1 | grep -E '\.(md|sh|js|json|sql)$' | head -20
echo ""
echo "💡 提示："
echo "  1. 核心文件保留在根目录：README.md, package.json, .env 等"
echo "  2. 所有开发文档已移至 docs/07-开发文档/"
echo "  3. 所有脚本已移至 scripts/"
echo "  4. 临时文件在 temp/ 目录"
