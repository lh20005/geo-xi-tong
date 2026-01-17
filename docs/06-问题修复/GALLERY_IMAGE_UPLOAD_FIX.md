# 图库图片上传失败修复

**日期**: 2026-01-17  
**问题**: aizhiruan 用户上传图片后，相册显示 0 张图片  
**状态**: ✅ 已修复

---

## 问题分析

### 症状

1. 用户创建相册并上传图片
2. 相册创建成功，但图片数量显示为 0
3. 数据库查询确认：`images` 表中没有插入任何记录

### 根本原因

**前端文件路径提取失败**

在 `GalleryPage.tsx` 中，代码尝试从 `file.originFileObj.path` 获取文件路径：

```typescript
const fileObj = file.originFileObj as any;
const filePath = fileObj.path;
if (filePath) {
  filesData.push({ name, type, size, path: filePath });
}
```

**问题**：
- 在 Electron 渲染进程中，通过 `<Upload>` 组件选择的文件对象可能没有 `path` 属性
- 如果 `filePath` 为 `undefined`，文件不会被添加到 `filesData` 数组
- 结果：`filesData.length === 0`，`uploadImages()` 不会被调用
- 即使被调用，IPC handler 也无法读取文件（因为 path 为空）

### 数据库验证

```sql
-- 查询相册 12 的图片
SELECT id, album_id, filename, created_at 
FROM images 
WHERE album_id = 12;

-- 结果：0 rows（确认没有插入）
```

---

## 解决方案

### 1. 前端：支持 Buffer 数据传输

修改 `windows-login-manager/src/pages/GalleryPage.tsx`：

```typescript
// 如果没有 path 属性，使用 arrayBuffer 读取文件内容
if (!filePath) {
  const arrayBuffer = await fileObj.arrayBuffer();
  const buffer = Array.from(new Uint8Array(arrayBuffer));
  
  filesData.push({
    name: file.name,
    type: file.type || 'image/jpeg',
    size: file.size,
    path: '', // 空路径
    buffer: buffer // 添加 buffer 数据
  });
}
```

**关键改进**：
- 尝试从 `file.originFileObj.path` 获取路径（Electron 原生文件选择）
- 如果失败，使用 `arrayBuffer()` 读取文件内容
- 将 buffer 转换为数组并传递给 IPC handler
- 添加 `console.log` 用于调试
- 上传成功后调用 `fetchAlbums()` 刷新相册列表

### 2. IPC Handler：支持 Buffer 和 Path 两种方式

修改 `windows-login-manager/electron/ipc/handlers/localGalleryHandlers.ts`：

```typescript
ipcMain.handle('gallery:uploadImage', async (_event, albumId: number, files: Array<{
  name: string;
  path: string;
  type: string;
  buffer?: number[]; // 新增：可选的 buffer 数据
}>) => {
  for (const file of files) {
    let content: Buffer;
    
    // 优先使用 buffer，其次使用 path
    if (file.buffer && file.buffer.length > 0) {
      content = Buffer.from(file.buffer);
      log.info(`Using buffer data for ${file.name}`);
    } else if (file.path && fs.existsSync(file.path)) {
      content = fs.readFileSync(file.path);
      log.info(`Reading from path ${file.path}`);
    } else {
      log.error(`No valid data source for ${file.name}`);
      continue;
    }
    
    // 保存文件并创建数据库记录
    // ...
  }
});
```

**关键改进**：
- 支持两种数据源：`buffer` 或 `path`
- 添加详细的日志记录
- 优雅处理失败情况（跳过无效文件，继续处理其他文件）

---

## 测试步骤

### 1. 重新编译

```bash
cd windows-login-manager
npm run build:electron
```

### 2. 启动应用

```bash
npm run dev
```

### 3. 测试上传

1. 登录 aizhiruan 账户
2. 进入企业图库
3. 点击"创建相册"
4. 输入相册名称
5. 点击"上传"按钮，选择 1-3 张图片
6. 点击"创建"

### 4. 验证结果

**前端验证**：
- 打开浏览器 DevTools Console
- 查看日志：`准备上传文件: X 个`
- 相册列表应显示正确的图片数量

**数据库验证**：
```bash
psql -U lzc -d geo_windows -c "SELECT id, album_id, filename FROM images ORDER BY created_at DESC LIMIT 5;"
```

**文件系统验证**：
```bash
ls -la ~/Library/Application\ Support/windows-login-manager/gallery/<album_id>/
```

**日志验证**：
```bash
tail -f ~/Library/Logs/ai-geo-system/main.log
```

应该看到：
```
[info] IPC: gallery:uploadImage - Album: X, files: Y
[info] Using buffer data for image.jpg, size: XXXXX
[info] Saved image to /path/to/image.jpg
[info] Created image record: Z
[info] Upload complete: Y images uploaded
```

---

## 相关文件

- `windows-login-manager/src/pages/GalleryPage.tsx` - 前端上传逻辑
- `windows-login-manager/electron/ipc/handlers/localGalleryHandlers.ts` - IPC handler
- `windows-login-manager/electron/services/ImageServicePostgres.ts` - 图片服务
- `windows-login-manager/src/stores/galleryStore.ts` - 状态管理

---

## 后续优化建议

### 1. 使用 Electron Dialog API

更可靠的方式是使用 Electron 的原生文件选择对话框：

```typescript
// 在主进程中
ipcMain.handle('dialog:selectImages', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }]
  });
  return result.filePaths; // 返回完整的文件路径
});
```

### 2. 进度反馈

对于大文件或多文件上传，添加进度条：

```typescript
for (let i = 0; i < files.length; i++) {
  const progress = ((i + 1) / files.length) * 100;
  event.sender.send('upload:progress', { progress, current: i + 1, total: files.length });
}
```

### 3. 错误处理增强

- 显示具体的失败文件列表
- 支持重试失败的文件
- 添加文件大小和格式验证

---

## 总结

这个问题的核心是 **Electron 渲染进程中的文件对象可能没有 `path` 属性**。解决方案是：

1. ✅ 前端：使用 `arrayBuffer()` 读取文件内容作为备选方案
2. ✅ 后端：支持 buffer 和 path 两种数据源
3. ✅ 添加详细日志用于调试
4. ✅ 上传后刷新相册列表

修复后，用户可以正常上传图片，相册会显示正确的图片数量。
