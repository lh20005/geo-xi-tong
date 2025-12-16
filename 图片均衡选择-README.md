# 图片均衡选择功能

## 📋 功能说明

在生成文章时，系统会从用户选择的相册中**均衡调用**图片，避免同一张图片被反复使用。

## ✅ 实现状态

- ✅ 数据库迁移已完成
- ✅ ImageSelectionService 服务已创建
- ✅ ArticleGenerationService 已更新
- ✅ 测试脚本已创建
- ✅ 文档已完成
- ✅ 功能可以投入使用

## 🚀 快速开始

### 1. 验证安装

```bash
./verify-image-selection-implementation.sh
```

### 2. 启动服务

```bash
npm run dev
```

### 3. 测试功能

```bash
cd server
npm run test-image-selection
```

## 📚 文档

- **[图片均衡选择实现总结.md](./图片均衡选择实现总结.md)** - 技术实现总结
- **[图片均衡选择功能实现说明.md](./图片均衡选择功能实现说明.md)** - 详细实现说明
- **[图片均衡选择快速测试指南.md](./图片均衡选择快速测试指南.md)** - 测试指南

## 🔧 核心实现

### 选择策略

```typescript
// 优先选择使用次数最少的图片
SELECT id, filepath, usage_count
FROM images
WHERE album_id = $1
ORDER BY usage_count ASC, created_at ASC
LIMIT 1
```

### 使用记录

```typescript
// 在事务中更新图片使用次数
UPDATE images 
SET usage_count = COALESCE(usage_count, 0) + 1 
WHERE id = $1;

// 记录使用历史
INSERT INTO image_usage (image_id, article_id)
VALUES ($1, $2);
```

## 📊 测试验证

### 查看图片使用统计

```bash
cd server
npm run test-image-selection
```

### 预期结果

假设相册有6张图片，生成6篇文章后：

| 图片ID | 使用次数 |
|--------|----------|
| 12     | 1        |
| 13     | 1        |
| 14     | 1        |
| 15     | 1        |
| 16     | 1        |
| 17     | 1        |

## 🎯 使用场景

### 场景1：生成多篇文章

1. 进入"生成文章"页面
2. 选择蒸馏结果、相册、知识库、文章设置
3. 设置生成数量（如10篇）
4. 点击"生成文章"
5. 观察每篇文章使用的图片是否不同

### 场景2：查看使用统计

```sql
SELECT 
  i.filename,
  i.usage_count,
  (SELECT COUNT(*) FROM image_usage WHERE image_id = i.id) as usage_records
FROM images i
WHERE i.album_id = 3
ORDER BY i.usage_count ASC;
```

## 🔍 监控和维护

### 实时监控

```bash
# 每5秒刷新一次统计
watch -n 5 "cd server && npm run test-image-selection"
```

### 重置使用计数

```typescript
const imageService = new ImageSelectionService();
await imageService.resetAlbumUsageCount(albumId);
```

## 📦 文件清单

### 新增文件

- `server/src/db/migrate-image-usage-tracking.ts` - 数据库迁移
- `server/src/services/imageSelectionService.ts` - 图片选择服务
- `server/src/scripts/test-image-balanced-selection.ts` - 测试脚本

### 修改文件

- `server/src/services/articleGenerationService.ts` - 更新文章生成逻辑
- `server/src/db/schema.sql` - 更新数据库schema
- `server/package.json` - 添加脚本命令

## 🎉 总结

功能已完成并可以投入使用。系统会自动：

✅ 优先选择使用次数最少的图片  
✅ 记录每张图片的使用历史  
✅ 确保图片使用的均衡性  
✅ 提供完整的监控和统计工具  

如有问题，请查看详细文档或运行测试脚本。
