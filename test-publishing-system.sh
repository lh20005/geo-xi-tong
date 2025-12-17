#!/bin/bash

echo "🧪 测试多平台发布系统"
echo "======================="
echo ""

# 测试数据库连接
echo "1️⃣  测试数据库连接..."
psql $DATABASE_URL -c "SELECT COUNT(*) FROM platforms_config;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ 数据库连接成功"
else
    echo "❌ 数据库连接失败"
    exit 1
fi

# 检查平台配置
echo ""
echo "2️⃣  检查平台配置..."
PLATFORM_COUNT=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM platforms_config;")
echo "   已配置平台数: $PLATFORM_COUNT"
if [ "$PLATFORM_COUNT" -eq "12" ]; then
    echo "✅ 平台配置正确"
else
    echo "⚠️  平台配置数量不正确"
fi

# 检查加密密钥
echo ""
echo "3️⃣  检查加密密钥..."
KEY_COUNT=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM encryption_keys WHERE key_name='publishing_master_key';")
if [ "$KEY_COUNT" -gt "0" ]; then
    echo "✅ 加密密钥已生成"
else
    echo "⚠️  加密密钥未生成"
fi

# 运行后端测试
echo ""
echo "4️⃣  运行后端测试..."
cd server
npm test -- --passWithNoTests 2>&1 | grep -E "(PASS|FAIL|Tests:)"
cd ..

echo ""
echo "======================="
echo "✅ 系统测试完成"
echo ""
echo "📋 下一步操作："
echo "   1. 启动服务器: cd server && npm run dev"
echo "   2. 启动前端: cd client && npm run dev"
echo "   3. 访问: http://localhost:5173/platform-management"
echo ""
