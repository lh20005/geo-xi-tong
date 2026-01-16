#!/bin/bash

# PostgreSQL 迁移完整性验证脚本
# 验证所有 IPC 处理器和 Service 类是否完整

echo "🔍 PostgreSQL 迁移完整性验证"
echo "================================"
echo ""

# 统计 IPC 处理器数量
echo "📊 统计 IPC 处理器..."
echo ""

# 文章模块
ARTICLE_COUNT=$(grep -c "ipcMain.handle('article:" windows-login-manager/electron/ipc/handlers/articleHandlers.ts)
echo "✅ 文章模块: $ARTICLE_COUNT 个处理器（预期 12）"

# 图库模块
GALLERY_COUNT=$(grep -c "ipcMain.handle('gallery:" windows-login-manager/electron/ipc/handlers/localGalleryHandlers.ts)
echo "✅ 图库模块: $GALLERY_COUNT 个处理器（预期 13）"

# 知识库模块
KNOWLEDGE_COUNT=$(grep -c "ipcMain.handle('knowledge:" windows-login-manager/electron/ipc/handlers/localKnowledgeHandlers.ts)
echo "✅ 知识库模块: $KNOWLEDGE_COUNT 个处理器（预期 12）"

# 平台账号模块
ACCOUNT_COUNT=$(grep -c "ipcMain.handle('account:" windows-login-manager/electron/ipc/handlers/localAccountHandlers.ts)
echo "✅ 平台账号模块: $ACCOUNT_COUNT 个处理器（预期 13）"

# 发布任务模块
TASK_COUNT=$(grep -c "ipcMain.handle('task:" windows-login-manager/electron/ipc/handlers/taskHandlers.ts)
echo "✅ 发布任务模块: $TASK_COUNT 个处理器（预期 15）"

# 蒸馏模块
DISTILLATION_COUNT=$(grep -c "ipcMain.handle('distillation:" windows-login-manager/electron/ipc/handlers/localDistillationHandlers.ts)
echo "✅ 蒸馏模块: $DISTILLATION_COUNT 个处理器（预期 11）"

# 话题模块
TOPIC_COUNT=$(grep -c "ipcMain.handle('topic:" windows-login-manager/electron/ipc/handlers/localTopicHandlers.ts)
echo "✅ 话题模块: $TOPIC_COUNT 个处理器（预期 12）"

# 转化目标模块
CONVERSION_COUNT=$(grep -c "ipcMain.handle('conversionTarget:" windows-login-manager/electron/ipc/handlers/localConversionTargetHandlers.ts)
echo "✅ 转化目标模块: $CONVERSION_COUNT 个处理器（预期 13）"

# 文章设置模块
SETTING_COUNT=$(grep -c "ipcMain.handle('articleSetting:" windows-login-manager/electron/ipc/handlers/localArticleSettingHandlers.ts)
echo "✅ 文章设置模块: $SETTING_COUNT 个处理器（预期 11）"

# 计算总数
TOTAL=$((ARTICLE_COUNT + GALLERY_COUNT + KNOWLEDGE_COUNT + ACCOUNT_COUNT + TASK_COUNT + DISTILLATION_COUNT + TOPIC_COUNT + CONVERSION_COUNT + SETTING_COUNT))

echo ""
echo "📈 总计: $TOTAL 个处理器（预期 112）"
echo ""

# 验证 Service 类
echo "📊 验证 Service 类..."
echo ""

SERVICE_FILES=(
  "ArticleServicePostgres.ts"
  "AlbumServicePostgres.ts"
  "ImageServicePostgres.ts"
  "KnowledgeBaseServicePostgres.ts"
  "PlatformAccountServicePostgres.ts"
  "PublishingTaskServicePostgres.ts"
  "PublishingRecordServicePostgres.ts"
  "DistillationServicePostgres.ts"
  "TopicServicePostgres.ts"
  "ConversionTargetServicePostgres.ts"
  "ArticleSettingServicePostgres.ts"
  "UserServicePostgres.ts"
)

SERVICE_COUNT=0
for file in "${SERVICE_FILES[@]}"; do
  if [ -f "windows-login-manager/electron/services/$file" ]; then
    echo "✅ $file"
    SERVICE_COUNT=$((SERVICE_COUNT + 1))
  else
    echo "❌ $file 缺失"
  fi
done

echo ""
echo "📈 Service 类总计: $SERVICE_COUNT/12"
echo ""

# 验证 ServiceFactory
echo "📊 验证 ServiceFactory..."
if [ -f "windows-login-manager/electron/services/ServiceFactory.ts" ]; then
  echo "✅ ServiceFactory.ts 存在"
  
  # 检查是否包含所有 Service 的 getter 方法
  GETTER_COUNT=$(grep -c "get.*Service():" windows-login-manager/electron/services/ServiceFactory.ts)
  echo "✅ ServiceFactory 包含 $GETTER_COUNT 个 getter 方法（预期 12）"
else
  echo "❌ ServiceFactory.ts 缺失"
fi

echo ""
echo "================================"

# 判断是否完整
if [ $TOTAL -eq 112 ] && [ $SERVICE_COUNT -eq 12 ]; then
  echo "✅ 迁移完整性验证通过！"
  echo ""
  echo "📝 下一步："
  echo "   1. 启动应用: npm run dev"
  echo "   2. 登录测试账号"
  echo "   3. 运行功能测试"
  exit 0
else
  echo "❌ 迁移不完整，请检查缺失的部分"
  exit 1
fi
