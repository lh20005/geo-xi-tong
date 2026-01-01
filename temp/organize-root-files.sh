#!/bin/bash

# 根目录文件整理脚本
# 按照 README.md 的规划整理文件

echo "🗂️  开始整理根目录文件..."

# 创建目标目录
mkdir -p docs/07-开发文档/修复记录
mkdir -p docs/07-开发文档/诊断报告
mkdir -p docs/07-开发文档/实施指南
mkdir -p docs/07-开发文档/技术分析
mkdir -p scripts/testing
mkdir -p scripts/maintenance
mkdir -p scripts/deployment
mkdir -p scripts/diagnosis

# ==================== 移动文档文件 ====================

echo "📄 移动修复记录文档..."
mv -v ✅*.md docs/07-开发文档/修复记录/ 2>/dev/null
mv -v 🎉*.md docs/07-开发文档/修复记录/ 2>/dev/null
mv -v 🎊*.md docs/07-开发文档/修复记录/ 2>/dev/null
mv -v 🎯*.md docs/07-开发文档/修复记录/ 2>/dev/null
mv -v 🏆*.md docs/07-开发文档/修复记录/ 2>/dev/null
mv -v 🔒*.md docs/07-开发文档/修复记录/ 2>/dev/null
mv -v 🔧*.md docs/07-开发文档/修复记录/ 2>/dev/null
mv -v 🚀*.md docs/07-开发文档/修复记录/ 2>/dev/null
mv -v 🚨*.md docs/07-开发文档/修复记录/ 2>/dev/null

echo "📄 移动诊断报告..."
mv -v diagnose-*.md docs/07-开发文档/诊断报告/ 2>/dev/null
mv -v 🔍*.md docs/07-开发文档/诊断报告/ 2>/dev/null
mv -v 完整诊断报告.md docs/07-开发文档/诊断报告/ 2>/dev/null
mv -v 头条号图片上传问题-系统诊断报告.md docs/07-开发文档/诊断报告/ 2>/dev/null
mv -v 账号不存在问题诊断.md docs/07-开发文档/诊断报告/ 2>/dev/null
mv -v 账号隔离问题诊断指南.md docs/07-开发文档/诊断报告/ 2>/dev/null

echo "📄 移动实施指南..."
mv -v *_GUIDE.md docs/07-开发文档/实施指南/ 2>/dev/null
mv -v *_IMPLEMENTATION*.md docs/07-开发文档/实施指南/ 2>/dev/null
mv -v *_PLAN*.md docs/07-开发文档/实施指南/ 2>/dev/null
mv -v *_SUMMARY.md docs/07-开发文档/实施指南/ 2>/dev/null
mv -v *_SOLUTION.md docs/07-开发文档/实施指南/ 2>/dev/null
mv -v QUICK_*.md docs/07-开发文档/实施指南/ 2>/dev/null
mv -v 多租户*.md docs/07-开发文档/实施指南/ 2>/dev/null
mv -v 如何*.md docs/07-开发文档/实施指南/ 2>/dev/null
mv -v 平台登录*.md docs/07-开发文档/实施指南/ 2>/dev/null
mv -v 微信支付*.md docs/07-开发文档/实施指南/ 2>/dev/null
mv -v 完整测试流程.md docs/07-开发文档/实施指南/ 2>/dev/null
mv -v 快速命令参考.md docs/07-开发文档/实施指南/ 2>/dev/null
mv -v 测试*.md docs/07-开发文档/实施指南/ 2>/dev/null
mv -v 清除浏览器缓存指南.md docs/07-开发文档/实施指南/ 2>/dev/null
mv -v 环境变量配置说明.md docs/07-开发文档/实施指南/ 2>/dev/null
mv -v 知识库功能-快速使用指南.md docs/07-开发文档/实施指南/ 2>/dev/null
mv -v 配置总结.md docs/07-开发文档/实施指南/ 2>/dev/null

echo "📄 移动技术分析..."
mv -v *分析*.md docs/07-开发文档/技术分析/ 2>/dev/null
mv -v *对比*.md docs/07-开发文档/技术分析/ 2>/dev/null
mv -v *说明*.md docs/07-开发文档/技术分析/ 2>/dev/null
mv -v Playwright*.md docs/07-开发文档/技术分析/ 2>/dev/null
mv -v preload*.md docs/07-开发文档/技术分析/ 2>/dev/null
mv -v webview*.md docs/07-开发文档/技术分析/ 2>/dev/null
mv -v WEBVIEW*.md docs/07-开发文档/技术分析/ 2>/dev/null
mv -v GEO应用脚本详细分析.md docs/07-开发文档/技术分析/ 2>/dev/null
mv -v MCP*.md docs/07-开发文档/技术分析/ 2>/dev/null
mv -v 系统架构*.md docs/07-开发文档/技术分析/ 2>/dev/null
mv -v 登录管理器架构分析.md docs/07-开发文档/技术分析/ 2>/dev/null

echo "📄 移动其他开发文档..."
mv -v *FIX*.md docs/07-开发文档/ 2>/dev/null
mv -v *CHECKLIST*.md docs/07-开发文档/ 2>/dev/null
mv -v *REPORT*.md docs/07-开发文档/ 2>/dev/null
mv -v 下一步操作指南.md docs/07-开发文档/ 2>/dev/null
mv -v 交付清单*.md docs/07-开发文档/ 2>/dev/null
mv -v 修复*.md docs/07-开发文档/ 2>/dev/null
mv -v 关键修复点*.md docs/07-开发文档/ 2>/dev/null
mv -v 关闭浏览器按钮完整修复总结.md docs/07-开发文档/ 2>/dev/null
mv -v 切换webview影响分析.md docs/07-开发文档/ 2>/dev/null
mv -v 参考系统登录器分析与迁移方案.md docs/07-开发文档/ 2>/dev/null
mv -v 发现的自动发布脚本分析.md docs/07-开发文档/ 2>/dev/null
mv -v 只需修改一个文件即可.md docs/07-开发文档/ 2>/dev/null
mv -v 启动脚本*.md docs/07-开发文档/ 2>/dev/null
mv -v 定时发布修复说明.md docs/07-开发文档/ 2>/dev/null
mv -v 小红书*.md docs/07-开发文档/ 2>/dev/null
mv -v 开始测试支付.md docs/07-开发文档/ 2>/dev/null
mv -v 快速修复支付问题.md docs/07-开发文档/ 2>/dev/null
mv -v 快速测试多租户隔离.md docs/07-开发文档/ 2>/dev/null
mv -v 批量修复剩余路由.md docs/07-开发文档/ 2>/dev/null
mv -v 所有平台录制命令.md docs/07-开发文档/ 2>/dev/null
mv -v 搜狐号*.md docs/07-开发文档/ 2>/dev/null
mv -v 文档更新说明*.md docs/07-开发文档/ 2>/dev/null
mv -v 方案对比*.md docs/07-开发文档/ 2>/dev/null
mv -v 最简单的实施方案*.md docs/07-开发文档/ 2>/dev/null
mv -v 最终解决方案.md docs/07-开发文档/ 2>/dev/null
mv -v 本地测试*.md docs/07-开发文档/ 2>/dev/null
mv -v 简书*.md docs/07-开发文档/ 2>/dev/null
mv -v 申请微信支付APIv3.md docs/07-开发文档/ 2>/dev/null
mv -v 禁用微信支付测试版本.md docs/07-开发文档/ 2>/dev/null
mv -v 立即测试*.md docs/07-开发文档/ 2>/dev/null
mv -v 获取ngrok_token.md docs/07-开发文档/ 2>/dev/null
mv -v 诊断ngrok问题.md docs/07-开发文档/ 2>/dev/null
mv -v 路由修复进度.md docs/07-开发文档/ 2>/dev/null
mv -v 重启Windows登录管理器.md docs/07-开发文档/ 2>/dev/null
mv -v 问题根源*.md docs/07-开发文档/ 2>/dev/null
mv -v 一键修复账号隔离.md docs/07-开发文档/ 2>/dev/null
mv -v 完成*.md docs/07-开发文档/ 2>/dev/null

# ==================== 移动脚本文件 ====================

echo "🔧 移动测试脚本..."
mv -v test-*.sh scripts/testing/ 2>/dev/null
mv -v test-*.js scripts/testing/ 2>/dev/null
mv -v check-*.sh scripts/testing/ 2>/dev/null
mv -v check-*.js scripts/testing/ 2>/dev/null
mv -v 快速测试.sh scripts/testing/ 2>/dev/null
mv -v 快速测试抖音关闭按钮.sh scripts/testing/ 2>/dev/null

echo "🔧 移动诊断脚本..."
mv -v diagnose-*.sh scripts/diagnosis/ 2>/dev/null
mv -v diagnose-*.js scripts/diagnosis/ 2>/dev/null

echo "🔧 移动维护脚本..."
mv -v fix-*.sh scripts/maintenance/ 2>/dev/null
mv -v fix-*.js scripts/maintenance/ 2>/dev/null
mv -v fix-*.sql scripts/maintenance/ 2>/dev/null
mv -v fix-*.py scripts/maintenance/ 2>/dev/null
mv -v fix-*.patch scripts/maintenance/ 2>/dev/null
mv -v apply-*.js scripts/maintenance/ 2>/dev/null
mv -v batch-*.js scripts/maintenance/ 2>/dev/null
mv -v add-*.js scripts/maintenance/ 2>/dev/null
mv -v add-*.sql scripts/maintenance/ 2>/dev/null
mv -v cleanup-*.sh scripts/maintenance/ 2>/dev/null
mv -v rebuild-*.sh scripts/maintenance/ 2>/dev/null

echo "🔧 移动部署脚本..."
mv -v setup-*.sh scripts/deployment/ 2>/dev/null
mv -v implement-*.sh scripts/deployment/ 2>/dev/null
mv -v create-*.sh scripts/deployment/ 2>/dev/null
mv -v start-*.sh scripts/deployment/ 2>/dev/null

echo "🔧 移动启动脚本..."
mv -v restart-*.sh scripts/deployment/ 2>/dev/null
mv -v *.command scripts/deployment/ 2>/dev/null

# ==================== 移动配置和其他文件 ====================

echo "⚙️  移动配置文件..."
mv -v auth-*.json config/ 2>/dev/null
mv -v *.pem config/ 2>/dev/null

echo "🗑️  移动备份文件..."
mkdir -p backups
mv -v backup_*.sql backups/ 2>/dev/null
mv -v *-backup-* backups/ 2>/dev/null

echo "🗑️  移动临时文件..."
mkdir -p temp
mv -v test-upload-file.txt temp/ 2>/dev/null
mv -v test-env-config.html temp/ 2>/dev/null
mv -v server.log temp/ 2>/dev/null
mv -v hand*.js temp/ 2>/dev/null
mv -v access-windows-files.sh temp/ 2>/dev/null

echo ""
echo "✅ 文件整理完成！"
echo ""
echo "📊 整理结果："
echo "  - 文档文件 → docs/07-开发文档/"
echo "  - 测试脚本 → scripts/testing/"
echo "  - 诊断脚本 → scripts/diagnosis/"
echo "  - 维护脚本 → scripts/maintenance/"
echo "  - 部署脚本 → scripts/deployment/"
echo "  - 配置文件 → config/"
echo "  - 备份文件 → backups/"
echo "  - 临时文件 → temp/"
echo ""
echo "💡 提示："
echo "  1. 请检查移动后的文件是否正确"
echo "  2. 确认无误后可以删除 temp/ 目录"
echo "  3. 备份文件已移至 backups/ 目录"
