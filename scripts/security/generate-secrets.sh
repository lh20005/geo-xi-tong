#!/bin/bash

# 生成生产环境密钥脚本

echo "🔐 生成生产环境密钥"
echo "===================="
echo ""

echo "1. JWT_SECRET (用于用户认证):"
JWT_SECRET=$(openssl rand -hex 32)
echo "   JWT_SECRET=$JWT_SECRET"
echo ""

echo "2. 数据库密码 (强随机密码):"
DB_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-24)
echo "   DATABASE_PASSWORD=$DB_PASSWORD"
echo ""

echo "3. 管理员密码 (强随机密码):"
ADMIN_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)
echo "   ADMIN_PASSWORD=$ADMIN_PASSWORD"
echo ""

echo "4. 微信支付 API V3 密钥 (32字符):"
WECHAT_KEY=$(openssl rand -hex 16)
echo "   WECHAT_PAY_API_V3_KEY=$WECHAT_KEY"
echo ""

echo "⚠️  请将以上密钥保存到安全的地方！"
echo "⚠️  不要将这些密钥提交到 Git 仓库！"
echo ""
echo "📝 建议："
echo "   1. 复制以上密钥到 .env.production 文件"
echo "   2. 或配置到云服务商的环境变量管理中"
echo "   3. 删除本地的 .env.production 文件（不要提交）"
