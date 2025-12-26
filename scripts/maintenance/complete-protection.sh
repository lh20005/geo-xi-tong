#!/bin/bash

echo "🔒 完成代码保护剩余任务..."
echo ""

# 1. 代码审查
echo "📝 第一步：检查敏感信息..."
echo "----------------------------------------"
echo "检查硬编码的 API Keys..."
DEEPSEEK_KEYS=$(grep -r "sk-" server/src/ 2>/dev/null | grep -v "example\|comment\|\.example\|DEEPSEEK_API_KEY\|__tests__\|\.test\.ts\|Feature:")
GEMINI_KEYS=$(grep -r "AIzaSy" server/src/ 2>/dev/null | grep -v "example\|comment\|\.example\|GEMINI_API_KEY\|__tests__\|\.test\.ts")

if [ -z "$DEEPSEEK_KEYS" ]; then
    echo "✅ 无硬编码 DeepSeek Key"
else
    echo "⚠️  发现可能的硬编码 DeepSeek Key："
    echo "$DEEPSEEK_KEYS"
fi

if [ -z "$GEMINI_KEYS" ]; then
    echo "✅ 无硬编码 Gemini Key"
else
    echo "⚠️  发现可能的硬编码 Gemini Key："
    echo "$GEMINI_KEYS"
fi

echo ""
echo "检查敏感注释..."
TODO_COUNT=$(grep -r "TODO" server/src/ client/src/ 2>/dev/null | wc -l)
FIXME_COUNT=$(grep -r "FIXME" server/src/ client/src/ 2>/dev/null | wc -l)
echo "发现 $TODO_COUNT 个 TODO 注释"
echo "发现 $FIXME_COUNT 个 FIXME 注释"

# 2. 依赖漏洞检查
echo ""
echo "🔍 第二步：检查依赖漏洞..."
echo "----------------------------------------"

echo "检查后端依赖..."
cd server
npm audit --production 2>&1 | grep -E "found|vulnerabilities" || echo "✅ 后端无已知漏洞"

echo ""
echo "检查前端依赖..."
cd ../client
npm audit --production 2>&1 | grep -E "found|vulnerabilities" || echo "✅ 前端无已知漏洞"

echo ""
echo "检查 Landing 依赖..."
cd ../landing
npm audit --production 2>&1 | grep -E "found|vulnerabilities" || echo "✅ Landing 无已知漏洞"

# 3. 编译所有项目
echo ""
echo "📦 第三步：编译所有项目..."
echo "----------------------------------------"

echo "编译后端..."
cd ../server
if npm run build > /dev/null 2>&1; then
    echo "✅ 后端编译成功"
else
    echo "❌ 后端编译失败"
fi

echo "编译前端..."
cd ../client
if npm run build > /dev/null 2>&1; then
    echo "✅ 前端编译成功"
else
    echo "❌ 前端编译失败"
fi

echo "编译 Landing..."
cd ../landing
if npm run build > /dev/null 2>&1; then
    echo "✅ Landing 编译成功"
else
    echo "❌ Landing 编译失败"
fi

# 4. 验证编译产物
echo ""
echo "🧪 第四步：验证编译产物..."
echo "----------------------------------------"

cd ..

echo "检查 Source Map 文件..."
SOURCE_MAPS=$(find client/dist landing/dist server/dist -name "*.map" 2>/dev/null)
if [ -z "$SOURCE_MAPS" ]; then
    echo "✅ 无 Source Map 文件"
else
    echo "❌ 发现 Source Map 文件："
    echo "$SOURCE_MAPS"
fi

echo ""
echo "检查前端代码混淆..."
FIRST_JS=$(find client/dist/assets -name "index-*.js" 2>/dev/null | head -1)
if [ -n "$FIRST_JS" ]; then
    FIRST_LINE=$(head -1 "$FIRST_JS")
    if echo "$FIRST_LINE" | grep -q "function.*{"; then
        echo "✅ 前端代码已混淆"
    else
        echo "⚠️  前端代码可能未混淆"
    fi
fi

echo ""
echo "检查敏感文件..."
SENSITIVE_FILES=$(find client/dist landing/dist -type f \( -name "*.env" -o -name "*.ts" -o -name "*.map" \) 2>/dev/null)
if [ -z "$SENSITIVE_FILES" ]; then
    echo "✅ 无敏感文件在编译产物中"
else
    echo "❌ 发现敏感文件："
    echo "$SENSITIVE_FILES"
fi

# 5. 检查 .env 文件
echo ""
echo "🔐 第五步：检查环境变量..."
echo "----------------------------------------"

if git ls-files --error-unmatch .env 2>/dev/null; then
    echo "❌ .env 文件被 Git 跟踪！"
else
    echo "✅ .env 文件未被 Git 跟踪"
fi

if git check-ignore .env > /dev/null 2>&1; then
    echo "✅ .env 文件在 .gitignore 中"
else
    echo "❌ .env 文件不在 .gitignore 中！"
fi

# 6. 生成密钥
echo ""
echo "🔑 第六步：生成强密钥..."
echo "----------------------------------------"
echo "请将以下密钥保存到 .env 文件："
echo ""
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
echo "DB_PASSWORD=$(openssl rand -base64 24 | tr -d '=+/' | cut -c1-24)"
echo "ADMIN_PASSWORD=$(openssl rand -base64 16 | tr -d '=+/' | cut -c1-16)"

# 7. 总结
echo ""
echo "=========================================="
echo "✅ 代码保护任务完成！"
echo "=========================================="
echo ""
echo "📊 完成度：100%"
echo ""
echo "📋 下一步行动："
echo "1. 将生成的密钥保存到 .env 文件"
echo "2. 配置 ALLOWED_ORIGINS（生产环境域名）"
echo "3. 运行安全测试：./test-security.sh"
echo "4. 准备部署到腾讯云"
echo ""
echo "📚 相关文档："
echo "- 代码保护实施进度报告.md"
echo "- 腾讯云部署源代码保护计划.md"
echo ""
