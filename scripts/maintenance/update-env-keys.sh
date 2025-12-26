#!/bin/bash

echo "🔑 更新 .env 文件中的强密钥"
echo ""

# 检查 .env 文件是否存在
if [ ! -f .env ]; then
    echo "❌ 错误：.env 文件不存在"
    echo "请先创建 .env 文件"
    exit 1
fi

# 备份当前 .env 文件
echo "📦 备份当前 .env 文件..."
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ 已备份到 .env.backup.$(date +%Y%m%d_%H%M%S)"
echo ""

# 显示当前密钥
echo "📋 当前密钥："
echo "----------------------------------------"
grep "JWT_SECRET=" .env
grep "ADMIN_PASSWORD=" .env
echo "----------------------------------------"
echo ""

# 询问是否更新
read -p "是否要更新为强密钥？(y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 已取消"
    exit 0
fi

# 生成的强密钥
JWT_SECRET="eeca6b8fd34cc378411cee4d5d9e405ba2470f34f31f65ca42a3b2ec6c44a144"
JWT_REFRESH_SECRET="fcb44972cd8b6833229122d109cf7bca8254332045fef7a683de973fd84ec392"
ADMIN_PASSWORD="jehI2oBuNMMJehMM"

echo ""
echo "🔄 更新密钥..."

# 更新 JWT_SECRET
if grep -q "^JWT_SECRET=" .env; then
    # 使用 sed 替换（macOS 兼容）
    sed -i.tmp "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
    rm -f .env.tmp
    echo "✅ 已更新 JWT_SECRET"
else
    echo "JWT_SECRET=$JWT_SECRET" >> .env
    echo "✅ 已添加 JWT_SECRET"
fi

# 添加 JWT_REFRESH_SECRET（如果不存在）
if grep -q "^JWT_REFRESH_SECRET=" .env; then
    sed -i.tmp "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET|" .env
    rm -f .env.tmp
    echo "✅ 已更新 JWT_REFRESH_SECRET"
else
    echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET" >> .env
    echo "✅ 已添加 JWT_REFRESH_SECRET"
fi

# 更新 ADMIN_PASSWORD
if grep -q "^ADMIN_PASSWORD=" .env; then
    sed -i.tmp "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=$ADMIN_PASSWORD|" .env
    rm -f .env.tmp
    echo "✅ 已更新 ADMIN_PASSWORD"
else
    echo "ADMIN_PASSWORD=$ADMIN_PASSWORD" >> .env
    echo "✅ 已添加 ADMIN_PASSWORD"
fi

echo ""
echo "=========================================="
echo "✅ 密钥更新完成！"
echo "=========================================="
echo ""
echo "📋 新密钥："
echo "----------------------------------------"
echo "JWT_SECRET=$JWT_SECRET"
echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
echo "ADMIN_PASSWORD=$ADMIN_PASSWORD"
echo "----------------------------------------"
echo ""
echo "⚠️  重要提醒："
echo "1. 请妥善保管这些密钥"
echo "2. 管理员密码：$ADMIN_PASSWORD"
echo "3. 所有用户需要重新登录"
echo "4. 请重启服务器使配置生效"
echo ""
echo "🔄 重启服务器："
echo "cd server && npm run dev"
echo ""
