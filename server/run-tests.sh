#!/bin/bash

echo "🧪 运行文章生成模块测试..."
echo ""

# 设置测试环境变量
export NODE_ENV=test

# 运行所有测试
echo "📋 运行所有测试..."
npm test -- --verbose

# 检查测试结果
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 所有测试通过！"
    echo ""
    echo "📊 生成测试覆盖率报告..."
    npm test -- --coverage
else
    echo ""
    echo "❌ 测试失败，请检查错误信息"
    exit 1
fi
