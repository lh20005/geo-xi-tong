#!/bin/bash

# 文件整理验证脚本
# 用于验证项目文件是否按照规划整理完成

echo "======================================"
echo "   文件整理验证脚本"
echo "======================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 验证计数
PASS=0
FAIL=0

# 1. 检查根目录
echo "1. 检查根目录清理情况..."
ROOT_FILES=$(ls -1 | grep -v "^node_modules$" | grep -v "^client$" | grep -v "^server$" | grep -v "^landing$" | grep -v "^docs$" | grep -v "^scripts$" | grep -v "^config$" | grep -v "^dev-docs$" | grep -v "^windows-login-manager$" | grep -v "^\.git$" | grep -v "^\.kiro$" | grep -v "^\.vscode$" | wc -l)

if [ "$ROOT_FILES" -le 6 ]; then
    echo -e "${GREEN}✅ 根目录已清理干净（$ROOT_FILES 个文件）${NC}"
    PASS=$((PASS+1))
else
    echo -e "${RED}❌ 根目录文件过多（$ROOT_FILES 个文件，应该 ≤ 6）${NC}"
    FAIL=$((FAIL+1))
fi

# 2. 检查必要文件是否存在
echo ""
echo "2. 检查必要文件..."
REQUIRED_FILES=("README.md" "package.json" "package-lock.json" ".env.example" ".gitignore")
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file 存在${NC}"
        PASS=$((PASS+1))
    else
        echo -e "${RED}❌ $file 缺失${NC}"
        FAIL=$((FAIL+1))
    fi
done

# 3. 检查 docs 目录结构
echo ""
echo "3. 检查 docs/ 目录结构..."
DOCS_DIRS=("01-快速开始" "02-功能说明" "03-部署指南" "04-安全指南" "05-测试指南" "06-问题修复" "07-开发文档" "08-用户界面文档" "09-安全评估")
for dir in "${DOCS_DIRS[@]}"; do
    if [ -d "docs/$dir" ]; then
        FILE_COUNT=$(ls -1 "docs/$dir" 2>/dev/null | wc -l)
        echo -e "${GREEN}✅ docs/$dir 存在（$FILE_COUNT 个文件）${NC}"
        PASS=$((PASS+1))
    else
        echo -e "${RED}❌ docs/$dir 缺失${NC}"
        FAIL=$((FAIL+1))
    fi
done

# 4. 检查 config 目录
echo ""
echo "4. 检查 config/ 目录..."
if [ -d "config/nginx" ]; then
    NGINX_COUNT=$(ls -1 config/nginx/*.conf* 2>/dev/null | wc -l)
    if [ "$NGINX_COUNT" -ge 2 ]; then
        echo -e "${GREEN}✅ config/nginx/ 存在（$NGINX_COUNT 个配置文件）${NC}"
        PASS=$((PASS+1))
    else
        echo -e "${YELLOW}⚠️  config/nginx/ 配置文件不足（$NGINX_COUNT 个，应该 ≥ 2）${NC}"
        FAIL=$((FAIL+1))
    fi
else
    echo -e "${RED}❌ config/nginx/ 缺失${NC}"
    FAIL=$((FAIL+1))
fi

# 5. 检查 dev-docs 目录
echo ""
echo "5. 检查 dev-docs/ 目录..."
if [ -d "dev-docs/tests/server" ]; then
    TEST_COUNT=$(find dev-docs/tests/server -type f 2>/dev/null | wc -l)
    echo -e "${GREEN}✅ dev-docs/tests/server/ 存在（$TEST_COUNT 个测试文件）${NC}"
    PASS=$((PASS+1))
else
    echo -e "${YELLOW}⚠️  dev-docs/tests/server/ 不存在${NC}"
    FAIL=$((FAIL+1))
fi

# 6. 检查 server 目录是否干净
echo ""
echo "6. 检查 server/ 目录..."
SERVER_TEST_COUNT=$(find server/src -type f \( -name "*.test.ts" -o -name "*.spec.ts" \) 2>/dev/null | wc -l)
if [ "$SERVER_TEST_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✅ server/src/ 已清理干净（无测试文件）${NC}"
    PASS=$((PASS+1))
else
    echo -e "${RED}❌ server/src/ 仍有 $SERVER_TEST_COUNT 个测试文件${NC}"
    FAIL=$((FAIL+1))
fi

# 7. 检查 client 目录是否干净
echo ""
echo "7. 检查 client/ 目录..."
CLIENT_TEST_COUNT=$(find client/src -type f \( -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" \) 2>/dev/null | wc -l)
if [ "$CLIENT_TEST_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✅ client/src/ 已清理干净（无测试文件）${NC}"
    PASS=$((PASS+1))
else
    echo -e "${RED}❌ client/src/ 仍有 $CLIENT_TEST_COUNT 个测试文件${NC}"
    FAIL=$((FAIL+1))
fi

# 8. 检查临时文件
echo ""
echo "8. 检查临时文件..."
TEMP_FILES=$(find . -maxdepth 1 -name ".DS_Store" -o -name "*.backup.*" -o -name "organize-files.sh" 2>/dev/null | wc -l)
if [ "$TEMP_FILES" -eq 0 ]; then
    echo -e "${GREEN}✅ 无临时文件${NC}"
    PASS=$((PASS+1))
else
    echo -e "${YELLOW}⚠️  发现 $TEMP_FILES 个临时文件${NC}"
    FAIL=$((FAIL+1))
fi

# 总结
echo ""
echo "======================================"
echo "   验证结果"
echo "======================================"
echo -e "${GREEN}通过: $PASS${NC}"
echo -e "${RED}失败: $FAIL${NC}"
echo ""

if [ "$FAIL" -eq 0 ]; then
    echo -e "${GREEN}🎉 文件整理验证通过！${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  发现 $FAIL 个问题，请检查${NC}"
    exit 1
fi
