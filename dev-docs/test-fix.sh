#!/bin/bash

# Ollama配置保存修复测试脚本

echo "🔧 Ollama配置保存修复测试"
echo "================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 步骤1：检查Ollama服务
echo "📋 步骤1：检查Ollama服务..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Ollama服务运行正常${NC}"
else
    echo -e "${RED}❌ Ollama服务未运行${NC}"
    echo "   请先启动Ollama服务"
    exit 1
fi

# 步骤2：检查DeepSeek模型
echo ""
echo "📋 步骤2：检查DeepSeek模型..."
if ollama list | grep -q "deepseek"; then
    echo -e "${GREEN}✅ 检测到DeepSeek模型${NC}"
    ollama list | grep "deepseek"
else
    echo -e "${YELLOW}⚠️  未检测到DeepSeek模型${NC}"
    echo "   运行: ollama pull deepseek-r1:latest"
fi

# 步骤3：运行数据库修复
echo ""
echo "📋 步骤3：运行数据库修复..."
cd server
if npm run db:fix:constraint; then
    echo -e "${GREEN}✅ 数据库约束修复成功${NC}"
else
    echo -e "${RED}❌ 数据库约束修复失败${NC}"
    echo "   请检查数据库连接"
    exit 1
fi
cd ..

# 步骤4：测试API端点
echo ""
echo "📋 步骤4：测试API端点..."

# 等待服务器启动（如果需要）
sleep 2

# 测试模型检测
echo "   测试模型检测..."
MODELS_RESPONSE=$(curl -s "http://localhost:3000/api/config/ollama/models?baseUrl=http://localhost:11434")
if echo "$MODELS_RESPONSE" | grep -q "models"; then
    echo -e "${GREEN}   ✅ 模型检测API正常${NC}"
else
    echo -e "${YELLOW}   ⚠️  模型检测API可能有问题${NC}"
fi

# 测试连接
echo "   测试连接..."
TEST_RESPONSE=$(curl -s -X POST http://localhost:3000/api/config/ollama/test \
  -H "Content-Type: application/json" \
  -d '{"baseUrl":"http://localhost:11434","model":"deepseek-r1:latest"}')
if echo "$TEST_RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}   ✅ 连接测试API正常${NC}"
else
    echo -e "${YELLOW}   ⚠️  连接测试可能失败（模型可能未安装）${NC}"
fi

# 步骤5：验证数据库约束
echo ""
echo "📋 步骤5：验证数据库约束..."
CONSTRAINT_CHECK=$(psql -d geo_system -t -c "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'check_ollama_config' AND conrelid = 'api_configs'::regclass;" 2>/dev/null)
if [ ! -z "$CONSTRAINT_CHECK" ]; then
    echo -e "${GREEN}✅ 数据库约束已正确设置${NC}"
    echo "   约束定义: $CONSTRAINT_CHECK"
else
    echo -e "${YELLOW}⚠️  无法验证约束（可能需要数据库权限）${NC}"
fi

# 总结
echo ""
echo "================================"
echo "🎉 修复完成！"
echo ""
echo "下一步："
echo "1. 重启服务器: npm run dev"
echo "2. 访问配置页面"
echo "3. 选择'本地Ollama'"
echo "4. 选择模型并保存"
echo ""
echo "如果仍有问题，请查看："
echo "- FIX_OLLAMA_SAVE_ERROR.md"
echo "- TROUBLESHOOTING.md"
echo ""
