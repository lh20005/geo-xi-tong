#!/bin/bash

# 修复 Token 隔离问题 - 快速执行脚本

echo ""
echo "========================================"
echo "🔧 修复多租户 Token 隔离问题"
echo "========================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 问题描述：${NC}"
echo "   lzc2005 在 Windows 端登录的账号，在 Web 端的 testuser 中也能看到"
echo ""

echo -e "${BLUE}🔍 根本原因：${NC}"
echo "   两个用户可能使用了相同的 JWT token"
echo ""

echo -e "${YELLOW}⚠️  警告：此脚本将清除所有客户端的认证信息${NC}"
echo ""

read -p "是否继续？(y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "操作已取消"
    exit 0
fi

echo ""
echo "========================================"
echo "步骤 1: 检查当前状态"
echo "========================================"
echo ""

# 检查数据库中的用户和账号
if [ -f "server/check-user-accounts.js" ]; then
    echo "正在查询数据库..."
    node server/check-user-accounts.js
else
    echo -e "${RED}❌ 检查脚本不存在${NC}"
fi

echo ""
echo "========================================"
echo "步骤 2: 生成清除指令"
echo "========================================"
echo ""

echo -e "${GREEN}请在各个客户端执行以下操作：${NC}"
echo ""

echo -e "${BLUE}【Windows 端 - lzc2005 用户】${NC}"
echo "1. 打开 Windows 登录管理器"
echo "2. 按 F12 打开开发者工具"
echo "3. 在 Console 中执行以下代码："
echo ""
echo -e "${YELLOW}// 清除所有认证信息${NC}"
echo "localStorage.clear();"
echo "if (window.electron) {"
echo "  window.electron.storage.clearTokens().then(() => {"
echo "    console.log('✅ Electron storage 已清除');"
echo "    location.reload();"
echo "  });"
echo "} else {"
echo "  location.reload();"
echo "}"
echo ""

echo -e "${BLUE}【Web 端 - testuser 用户】${NC}"
echo "1. 打开浏览器访问 Web 端"
echo "2. 按 F12 打开开发者工具"
echo "3. 在 Console 中执行以下代码："
echo ""
echo -e "${YELLOW}// 清除所有认证信息${NC}"
echo "localStorage.clear();"
echo "sessionStorage.clear();"
echo "document.cookie.split(';').forEach(c => {"
echo "  document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');"
echo "});"
echo "console.log('✅ 所有存储已清除');"
echo "location.reload();"
echo ""

echo "========================================"
echo "步骤 3: 重新登录"
echo "========================================"
echo ""

echo "清除完成后，请按以下顺序重新登录："
echo ""
echo "1. 在 Windows 端以 lzc2005 登录"
echo "2. 在 Web 端以 testuser 登录"
echo "3. 验证两个客户端显示的数据是否已隔离"
echo ""

echo "========================================"
echo "步骤 4: 验证修复"
echo "========================================"
echo ""

echo "重新登录后，请执行以下验证："
echo ""
echo -e "${BLUE}【验证 Token 是否不同】${NC}"
echo ""
echo "在 Windows 端 Console 运行："
echo -e "${YELLOW}const token = localStorage.getItem('auth_token');${NC}"
echo -e "${YELLOW}const decoded = JSON.parse(atob(token.split('.')[1]));${NC}"
echo -e "${YELLOW}console.log('Windows 端 userId:', decoded.userId, 'username:', decoded.username);${NC}"
echo ""
echo "在 Web 端 Console 运行："
echo -e "${YELLOW}const token = localStorage.getItem('auth_token');${NC}"
echo -e "${YELLOW}const decoded = JSON.parse(atob(token.split('.')[1]));${NC}"
echo -e "${YELLOW}console.log('Web 端 userId:', decoded.userId, 'username:', decoded.username);${NC}"
echo ""
echo "如果两个 userId 不同，说明修复成功！"
echo ""

echo -e "${BLUE}【验证数据隔离】${NC}"
echo ""
echo "1. 在 Windows 端（lzc2005）登录一个抖音账号"
echo "2. 在 Web 端（testuser）检查是否能看到这个账号"
echo "3. 如果看不到，说明隔离成功！"
echo ""

echo "========================================"
echo "📚 更多信息"
echo "========================================"
echo ""
echo "详细分析和长期解决方案，请查看："
echo "  - 多租户隔离问题-最佳实践分析.md"
echo "  - 账号隔离问题诊断指南.md"
echo ""
echo "如需帮助，请运行："
echo "  node diagnose-account-isolation.js"
echo ""
