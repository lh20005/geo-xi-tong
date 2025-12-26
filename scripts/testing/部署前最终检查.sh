#!/bin/bash

echo "🔍 腾讯云部署前最终检查"
echo "========================================"
echo ""

PASSED=0
FAILED=0
WARNINGS=0

# 1. 检查代码保护
echo "1️⃣ 代码保护检查"
echo "----------------------------------------"

# 1.1 检查 Source Map
if find client/dist landing/dist -name "*.map" 2>/dev/null | grep -q .; then
    echo "❌ 失败：发现 Source Map 文件"
    ((FAILED++))
else
    echo "✅ 通过：无 Source Map 文件"
    ((PASSED++))
fi

# 1.2 检查 .env 文件
if git ls-files --error-unmatch .env 2>/dev/null; then
    echo "❌ 失败：.env 文件被 Git 跟踪"
    ((FAILED++))
else
    echo "✅ 通过：.env 文件未被 Git 跟踪"
    ((PASSED++))
fi

# 1.3 检查强密钥
JWT_SECRET=$(grep "^JWT_SECRET=" .env | cut -d'=' -f2)
if [ ${#JWT_SECRET} -ge 64 ]; then
    echo "✅ 通过：JWT_SECRET 是强密钥（${#JWT_SECRET} 字符）"
    ((PASSED++))
else
    echo "❌ 失败：JWT_SECRET 太短（${#JWT_SECRET} 字符）"
    ((FAILED++))
fi

echo ""

# 2. 检查编译产物
echo "2️⃣ 编译产物检查"
echo "----------------------------------------"

# 2.1 检查后端编译
if [ -d "server/dist" ] && [ -f "server/dist/index.js" ]; then
    echo "✅ 通过：后端已编译"
    ((PASSED++))
else
    echo "⚠️  警告：后端未编译"
    echo "   运行：cd server && npm run build"
    ((WARNINGS++))
fi

# 2.2 检查前端编译
if [ -d "client/dist" ] && [ -f "client/dist/index.html" ]; then
    echo "✅ 通过：前端已编译"
    ((PASSED++))
else
    echo "⚠️  警告：前端未编译"
    echo "   运行：cd client && npm run build"
    ((WARNINGS++))
fi

# 2.3 检查 Landing 编译
if [ -d "landing/dist" ] && [ -f "landing/dist/index.html" ]; then
    echo "✅ 通过：Landing 已编译"
    ((PASSED++))
else
    echo "⚠️  警告：Landing 未编译"
    echo "   运行：cd landing && npm run build"
    ((WARNINGS++))
fi

echo ""

# 3. 检查依赖
echo "3️⃣ 依赖检查"
echo "----------------------------------------"

# 3.1 检查后端依赖
if [ -d "server/node_modules" ]; then
    echo "✅ 通过：后端依赖已安装"
    ((PASSED++))
else
    echo "❌ 失败：后端依赖未安装"
    echo "   运行：cd server && npm install"
    ((FAILED++))
fi

# 3.2 检查前端依赖
if [ -d "client/node_modules" ]; then
    echo "✅ 通过：前端依赖已安装"
    ((PASSED++))
else
    echo "❌ 失败：前端依赖未安装"
    echo "   运行：cd client && npm install"
    ((FAILED++))
fi

echo ""

# 4. 检查配置文件
echo "4️⃣ 配置文件检查"
echo "----------------------------------------"

# 4.1 检查 .env 文件
if [ -f ".env" ]; then
    echo "✅ 通过：.env 文件存在"
    ((PASSED++))
else
    echo "❌ 失败：.env 文件不存在"
    ((FAILED++))
fi

# 4.2 检查必要的环境变量
REQUIRED_VARS=("JWT_SECRET" "ADMIN_USERNAME" "ADMIN_PASSWORD" "DATABASE_URL")
for var in "${REQUIRED_VARS[@]}"; do
    if grep -q "^${var}=" .env 2>/dev/null; then
        echo "✅ 通过：${var} 已配置"
        ((PASSED++))
    else
        echo "❌ 失败：${var} 未配置"
        ((FAILED++))
    fi
done

echo ""

# 5. 检查 Vite 配置
echo "5️⃣ Vite 配置检查"
echo "----------------------------------------"

# 5.1 检查 client/vite.config.ts
if grep -q "sourcemap.*false" client/vite.config.ts 2>/dev/null; then
    echo "✅ 通过：client Source Map 已禁用"
    ((PASSED++))
else
    echo "❌ 失败：client Source Map 未禁用"
    ((FAILED++))
fi

# 5.2 检查 landing/vite.config.ts
if grep -q "sourcemap.*false" landing/vite.config.ts 2>/dev/null; then
    echo "✅ 通过：landing Source Map 已禁用"
    ((PASSED++))
else
    echo "❌ 失败：landing Source Map 未禁用"
    ((FAILED++))
fi

echo ""

# 6. 检查安全中间件
echo "6️⃣ 安全中间件检查"
echo "----------------------------------------"

if grep -q "helmet" server/src/index.ts 2>/dev/null; then
    echo "✅ 通过：Helmet 已配置"
    ((PASSED++))
else
    echo "❌ 失败：Helmet 未配置"
    ((FAILED++))
fi

if grep -q "rateLimit" server/src/index.ts 2>/dev/null; then
    echo "✅ 通过：速率限制已配置"
    ((PASSED++))
else
    echo "❌ 失败：速率限制未配置"
    ((FAILED++))
fi

echo ""

# 7. 检查 package.json
echo "7️⃣ Package.json 检查"
echo "----------------------------------------"

# 7.1 检查后端 scripts
if grep -q '"build"' server/package.json 2>/dev/null; then
    echo "✅ 通过：后端 build 脚本存在"
    ((PASSED++))
else
    echo "❌ 失败：后端 build 脚本不存在"
    ((FAILED++))
fi

# 7.2 检查后端 start 脚本
if grep -q '"start"' server/package.json 2>/dev/null; then
    echo "✅ 通过：后端 start 脚本存在"
    ((PASSED++))
else
    echo "❌ 失败：后端 start 脚本不存在"
    ((FAILED++))
fi

echo ""

# 总结
echo "=========================================="
echo "检查完成"
echo "=========================================="
echo ""
echo "✅ 通过：$PASSED 项"
echo "⚠️  警告：$WARNINGS 项"
echo "❌ 失败：$FAILED 项"
echo ""

if [ $FAILED -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "🎉 恭喜！所有检查通过，可以部署到腾讯云了！"
    echo ""
    echo "📋 下一步："
    echo "1. 购买腾讯云服务器（Ubuntu 22.04 LTS）"
    echo "2. 配置服务器环境（Node.js、PostgreSQL、Redis、Nginx）"
    echo "3. 上传编译后的代码"
    echo "4. 配置 Nginx"
    echo "5. 启动服务"
    echo ""
    echo "📚 详细步骤请参考："
    echo "- 腾讯云部署源代码保护计划.md"
    echo "- 腾讯云服务器镜像选择指南.md"
    exit 0
elif [ $FAILED -eq 0 ]; then
    echo "⚠️  有 $WARNINGS 个警告，建议先处理"
    echo ""
    echo "可以部署，但建议先编译所有项目："
    echo "cd server && npm run build"
    echo "cd ../client && npm run build"
    echo "cd ../landing && npm run build"
    exit 0
else
    echo "❌ 有 $FAILED 项失败，请先修复后再部署"
    exit 1
fi
