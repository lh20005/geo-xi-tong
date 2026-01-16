#!/bin/bash

# 快速修复编译错误脚本
# 这个脚本会注释掉所有导致编译错误的代码，让应用能够启动

echo "🔧 开始快速修复编译错误..."

# 修复 main.ts 的 handleAppQuit 方法
echo "修复 main.ts..."
sed -i '' 's/handleAppQuit(): void {/async handleAppQuit(): Promise<void> {/' electron/main.ts

# 修复 ArticleServicePostgres.ts 的字段名
echo "修复 ArticleServicePostgres.ts..."
sed -i '' 's/isPublished: true,/is_published: true,/' electron/services/ArticleServicePostgres.ts

# 修复 handler.ts 的回调参数类型
echo "修复 handler.ts..."
sed -i '' 's/publishingExecutor.setLogCallback((tid, level, message, details)/publishingExecutor.setLogCallback((tid: string, level: string, message: string, details?: any)/' electron/ipc/handler.ts

# 修复 localAccountHandlers.ts 的 is_default 比较
echo "修复 localAccountHandlers.ts..."
sed -i '' 's/isDefault: account.is_default === 1 || account.is_default === true,/isDefault: Boolean(account.is_default),/g' electron/ipc/handlers/localAccountHandlers.ts

echo "✅ 快速修复完成！"
echo ""
echo "⚠️  注意：这只是临时修复，让应用能够启动。"
echo "   还有很多缺少的方法需要实现，部分功能可能无法使用。"
echo ""
echo "现在可以运行: npm run dev"
