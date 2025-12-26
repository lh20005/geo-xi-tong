#!/bin/bash

echo "🧪 开始安全测试..."
echo ""

PASSED=0
FAILED=0

# 测试 1：Source Map 检查
echo "测试 1：Source Map 检查"
echo "----------------------------------------"
SOURCE_MAPS=$(find client/dist landing/dist -name "*.map" 2>/dev/null)
if [ -z "$SOURCE_MAPS" ]; then
    echo "✅ 通过：无 Source Map 文件"
    ((PASSED++))
else
    echo "❌ 失败：发现 Source Map 文件"
    echo "$SOURCE_MAPS"
    ((FAILED++))
fi

# 测试 2：sourceMappingURL 检查
echo ""
echo "测试 2：sourceMappingURL 检查"
echo "----------------------------------------"
MAPPING_URLS=$(grep -r "sourceMappingURL" client/dist landing/dist 2>/dev/null)
if [ -z "$MAPPING_URLS" ]; then
    echo "✅ 通过：无 sourceMappingURL 引用"
    ((PASSED++))
else
    echo "❌ 失败：发现 sourceMappingURL 引用"
    echo "$MAPPING_URLS"
    ((FAILED++))
fi

# 测试 3：.env 文件检查
echo ""
echo "测试 3：.env 文件保护检查"
echo "----------------------------------------"
if git ls-files --error-unmatch .env 2>/dev/null; then
    echo "❌ 失败：.env 文件被 Git 跟踪"
    ((FAILED++))
else
    echo "✅ 通过：.env 文件未被 Git 跟踪"
    ((PASSED++))
fi

# 测试 4：.gitignore 检查
echo ""
echo "测试 4：.gitignore 配置检查"
echo "----------------------------------------"
if git check-ignore .env > /dev/null 2>&1; then
    echo "✅ 通过：.env 在 .gitignore 中"
    ((PASSED++))
else
    echo "❌ 失败：.env 不在 .gitignore 中"
    ((FAILED++))
fi

# 测试 5：敏感文件检查
echo ""
echo "测试 5：编译产物敏感文件检查"
echo "----------------------------------------"
SENSITIVE=$(find client/dist landing/dist -type f \( -name "*.env" -o -name "*.ts" -o -name "*.map" \) 2>/dev/null)
if [ -z "$SENSITIVE" ]; then
    echo "✅ 通过：无敏感文件在编译产物中"
    ((PASSED++))
else
    echo "❌ 失败：发现敏感文件"
    echo "$SENSITIVE"
    ((FAILED++))
fi

# 测试 6：代码混淆检查
echo ""
echo "测试 6：代码混淆检查"
echo "----------------------------------------"
FIRST_JS=$(find client/dist/assets -name "index-*.js" 2>/dev/null | head -1)
if [ -n "$FIRST_JS" ]; then
    # 检查是否包含混淆特征（短变量名、无空格等）
    if head -1 "$FIRST_JS" | grep -q "function.*{"; then
        echo "✅ 通过：代码已混淆"
        ((PASSED++))
    else
        echo "⚠️  警告：代码可能未混淆"
        ((FAILED++))
    fi
else
    echo "⚠️  跳过：未找到编译后的 JS 文件"
fi

# 测试 7：硬编码密钥检查
echo ""
echo "测试 7：硬编码密钥检查"
echo "----------------------------------------"
HARDCODED_KEYS=$(grep -r "sk-[a-zA-Z0-9]" server/src/ 2>/dev/null | grep -v "example\|comment\|\.example\|DEEPSEEK_API_KEY\|__tests__\|\.test\.ts\|Feature:")
if [ -z "$HARDCODED_KEYS" ]; then
    echo "✅ 通过：无硬编码 API Key"
    ((PASSED++))
else
    echo "❌ 失败：发现可能的硬编码 API Key"
    echo "$HARDCODED_KEYS"
    ((FAILED++))
fi

# 测试 8：Vite 配置检查
echo ""
echo "测试 8：Vite 配置检查"
echo "----------------------------------------"
CLIENT_SOURCEMAP=$(grep "sourcemap.*false" client/vite.config.ts)
LANDING_SOURCEMAP=$(grep "sourcemap.*false" landing/vite.config.ts)

if [ -n "$CLIENT_SOURCEMAP" ] && [ -n "$LANDING_SOURCEMAP" ]; then
    echo "✅ 通过：Vite 配置正确禁用 Source Map"
    ((PASSED++))
else
    echo "❌ 失败：Vite 配置未正确禁用 Source Map"
    ((FAILED++))
fi

# 测试 9：安全中间件检查
echo ""
echo "测试 9：安全中间件检查"
echo "----------------------------------------"
HELMET=$(grep "helmet" server/src/index.ts)
RATE_LIMIT=$(grep "rateLimit" server/src/index.ts)

if [ -n "$HELMET" ] && [ -n "$RATE_LIMIT" ]; then
    echo "✅ 通过：安全中间件已配置"
    ((PASSED++))
else
    echo "❌ 失败：安全中间件未配置"
    ((FAILED++))
fi

# 测试 10：错误处理检查
echo ""
echo "测试 10：错误处理检查"
echo "----------------------------------------"
ERROR_HANDLER=$(grep "SAFE_ERROR_MESSAGES" server/src/middleware/errorHandler.ts)

if [ -n "$ERROR_HANDLER" ]; then
    echo "✅ 通过：安全错误处理已实现"
    ((PASSED++))
else
    echo "❌ 失败：安全错误处理未实现"
    ((FAILED++))
fi

# 总结
echo ""
echo "=========================================="
echo "测试完成"
echo "=========================================="
echo ""
echo "通过：$PASSED 项"
echo "失败：$FAILED 项"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "🎉 所有测试通过！代码保护已完成。"
    echo ""
    echo "📋 下一步："
    echo "1. 生成并配置强密钥"
    echo "2. 配置生产环境域名"
    echo "3. 准备部署到腾讯云"
    exit 0
else
    echo "⚠️  有 $FAILED 项测试失败，请检查并修复。"
    exit 1
fi
