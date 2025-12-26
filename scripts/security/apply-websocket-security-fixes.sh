#!/bin/bash

# WebSocket 安全认证修复脚本
# 此脚本帮助应用所有必要的代码修改

echo "🔒 WebSocket 安全认证修复脚本"
echo "================================"
echo ""

# 1. 配置环境变量
echo "📝 步骤 1: 配置环境变量"
echo "-------------------"

if [ ! -f "server/.env" ]; then
  echo "❌ 错误: server/.env 文件不存在"
  exit 1
fi

# 检查是否已有APP_SECRET
if grep -q "APP_SECRET=" server/.env; then
  echo "✅ APP_SECRET 已存在"
else
  echo "⚠️  APP_SECRET 不存在，正在生成..."
  APP_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  echo "" >> server/.env
  echo "# 应用密钥（用于Windows端认证）" >> server/.env
  echo "APP_SECRET=$APP_SECRET" >> server/.env
  echo "✅ APP_SECRET 已生成并添加到 .env"
fi

echo ""

# 2. 检查后端修改
echo "📝 步骤 2: 检查后端修改"
echo "-------------------"

if grep -q "type: 'user' | 'app' | 'anonymous'" server/src/services/WebSocketService.ts; then
  echo "✅ 后端 WebSocketService 已更新"
else
  echo "❌ 后端 WebSocketService 需要更新"
  echo "   请查看 dev-docs/WEBSOCKET_SECURITY_IMPLEMENTATION_SUMMARY.md"
fi

echo ""

# 3. 检查Windows端修改
echo "📝 步骤 3: 检查Windows端修改"
echo "-------------------"

if grep -q "getOrGenerateAppSecret" windows-login-manager/electron/storage/manager.ts; then
  echo "✅ StorageManager 已更新"
else
  echo "❌ StorageManager 需要更新"
fi

if grep -q "connectAsApp" windows-login-manager/electron/websocket/client.ts; then
  echo "✅ WebSocketClient 已部分更新"
  echo "⚠️  需要手动更新 authenticate() 方法"
  echo "   请查看 dev-docs/WEBSOCKET_SECURITY_IMPLEMENTATION_SUMMARY.md"
else
  echo "❌ WebSocketClient 需要更新"
fi

echo ""

# 4. 提供下一步指引
echo "📝 下一步操作"
echo "-------------------"
echo "1. 查看详细文档:"
echo "   cat dev-docs/WEBSOCKET_SECURITY_IMPLEMENTATION_SUMMARY.md"
echo ""
echo "2. 查看设计文档:"
echo "   cat dev-docs/WEBSOCKET_SECURITY_DESIGN.md"
echo ""
echo "3. 重启服务:"
echo "   # 停止所有进程"
echo "   # 重新启动后端: cd server && npm run dev"
echo "   # 重新启动Windows端: cd windows-login-manager && npm run electron:dev"
echo ""
echo "4. 测试认证:"
echo "   # 查看后端日志，应该看到: ✅ 应用认证成功: windows-login-manager"
echo "   # 查看Windows端日志，应该看到: WebSocket authentication successful"
echo ""
echo "5. 测试实时同步:"
echo "   # 在Windows端删除账号，观察网页端是否自动更新"
echo "   # 在网页端创建账号，观察Windows端是否自动更新"
echo ""

echo "✅ 检查完成！"
