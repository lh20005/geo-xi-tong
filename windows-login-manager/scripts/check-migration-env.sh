#!/bin/bash

# PostgreSQL 迁移环境检查脚本
# 用于验证环境是否正确配置

echo "🔍 PostgreSQL 迁移环境检查"
echo "================================"
echo ""

# 检查 PostgreSQL 是否运行
echo "1. 检查 PostgreSQL 服务..."
if pg_isready -q; then
    echo "   ✅ PostgreSQL 服务正在运行"
else
    echo "   ❌ PostgreSQL 服务未运行"
    echo "   请启动 PostgreSQL: brew services start postgresql@14"
    exit 1
fi

# 检查数据库是否存在
echo ""
echo "2. 检查数据库..."
if psql -U geo_user -d geo_windows -c "SELECT 1" > /dev/null 2>&1; then
    echo "   ✅ 数据库 geo_windows 存在"
else
    echo "   ❌ 数据库 geo_windows 不存在"
    echo "   请运行初始化脚本: npm run init-db"
    exit 1
fi

# 检查表是否存在
echo ""
echo "3. 检查数据表..."
TABLE_COUNT=$(psql -U geo_user -d geo_windows -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'" 2>/dev/null | tr -d ' ')

if [ "$TABLE_COUNT" -ge 17 ]; then
    echo "   ✅ 找到 $TABLE_COUNT 个数据表"
else
    echo "   ❌ 数据表不完整（找到 $TABLE_COUNT 个，预期至少 17 个）"
    echo "   请运行初始化脚本: npm run init-db"
    exit 1
fi

# 检查数据是否存在
echo ""
echo "4. 检查数据..."
USER_COUNT=$(psql -U geo_user -d geo_windows -t -c "SELECT COUNT(*) FROM users" 2>/dev/null | tr -d ' ')

if [ "$USER_COUNT" -gt 0 ]; then
    echo "   ✅ 找到 $USER_COUNT 个用户"
else
    echo "   ⚠️  没有用户数据"
    echo "   如果需要导入数据，请运行: npm run import-data"
fi

# 检查环境变量
echo ""
echo "5. 检查环境变量..."
if [ -f ".env" ]; then
    echo "   ✅ .env 文件存在"
    
    if grep -q "DB_HOST" .env; then
        echo "   ✅ 数据库配置存在"
    else
        echo "   ❌ 数据库配置缺失"
        echo "   请检查 .env 文件中的 DB_* 配置"
        exit 1
    fi
else
    echo "   ❌ .env 文件不存在"
    echo "   请复制 .env.example 并配置"
    exit 1
fi

# 检查 Node.js 依赖
echo ""
echo "6. 检查 Node.js 依赖..."
if [ -d "node_modules" ]; then
    echo "   ✅ node_modules 存在"
else
    echo "   ❌ node_modules 不存在"
    echo "   请运行: npm install"
    exit 1
fi

echo ""
echo "================================"
echo "✅ 环境检查完成！"
echo ""
echo "📝 下一步："
echo "   1. 启动应用: npm run dev"
echo "   2. 登录测试账号"
echo "   3. 运行测试脚本或手动测试"
echo ""
