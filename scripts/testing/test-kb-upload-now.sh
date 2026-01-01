#!/bin/bash

echo "=== 知识库文件上传测试 ==="
echo ""

# 创建测试文件
echo "1. 创建测试文件..."
cat > test-upload-file.txt << 'EOF'
这是一个测试文件
用于验证知识库文件上传功能

内容包括：
- 中文字符
- 英文字符 ABC
- 数字 123
- 特殊符号 !@#$%

测试时间: $(date)
EOF

echo "✅ 测试文件已创建: test-upload-file.txt"
ls -lh test-upload-file.txt

echo ""
echo "2. 检查代码修改..."

# 检查前端代码
if grep -q "fileObj.path" windows-login-manager/src/pages/KnowledgeBaseDetailPage.tsx; then
    echo "✅ 前端代码已更新（使用文件路径）"
else
    echo "❌ 前端代码未更新"
fi

# 检查 IPC Handler
if grep -q "fs.readFileSync(fileData.path)" windows-login-manager/electron/ipc/handler.ts; then
    echo "✅ IPC Handler 已更新（从路径读取）"
else
    echo "❌ IPC Handler 未更新"
fi

echo ""
echo "3. 检查后端服务..."
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ 后端服务运行中"
else
    echo "❌ 后端服务未运行"
    echo "   请先启动: npm run dev"
fi

echo ""
echo "=== 测试准备完成 ==="
echo ""
echo "📝 下一步操作:"
echo ""
echo "1. 重新编译 Windows 登录管理器:"
echo "   cd windows-login-manager"
echo "   rm -rf dist/ .vite/"
echo "   npm run dev"
echo ""
echo "2. 打开应用后按 Cmd+Option+I 打开开发者工具"
echo ""
echo "3. 测试步骤:"
echo "   a. 进入知识库页面"
echo "   b. 创建知识库'测试'"
echo "   c. 点击'上传文档'"
echo "   d. 选择 test-upload-file.txt"
echo "   e. 点击'上传'"
echo "   f. 查看控制台日志"
echo ""
echo "4. 预期结果:"
echo "   - 控制台显示: hasPath: true"
echo "   - 上传成功提示"
echo "   - 文档列表显示新文件"
echo ""
echo "5. 如果失败，查看:"
echo "   - 浏览器控制台的错误信息"
echo "   - Electron 日志（设置 → 日志管理）"
echo "   - 后端日志"
echo ""
