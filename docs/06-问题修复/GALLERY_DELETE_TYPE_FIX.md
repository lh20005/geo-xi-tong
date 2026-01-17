# 企业图库删除功能修复

**修复日期**: 2026-01-17  
**问题**: 无法删除企业图库相册  
**根本原因**: IPC 处理器参数类型错误（string vs number）

---

## 问题分析

### 症状
用户报告无法删除企业图库中的相册。

### 根本原因
在 PostgreSQL 迁移后，所有 ID 字段都改为 `SERIAL`（自增整数）类型，但 IPC 处理器中的参数类型仍然是 `string`，导致类型不匹配。

### 受影响的 IPC 处理器

文件：`windows-login-manager/electron/ipc/handlers/localGalleryHandlers.ts`

| IPC 通道 | 错误参数类型 | 正确参数类型 |
|---------|------------|------------|
| `gallery:getAlbum` | `albumId: string` | `albumId: number` |
| `gallery:updateAlbum` | `albumId: string` | `albumId: number` |
| `gallery:deleteAlbum` | `albumId: string` | `albumId: number` |
| `gallery:uploadImage` | `albumId: string` | `albumId: number` |
| `gallery:findImages` | `albumId: string` | `albumId: number` |
| `gallery:getImage` | `imageId: string` | `imageId: number` |
| `gallery:deleteImage` | `imageId: string` | `imageId: number` |
| `gallery:deleteImages` | `imageIds: string[]` | `imageIds: number[]` |
| `gallery:moveImage` | `imageId: string, targetAlbumId: string` | `imageId: number, targetAlbumId: number` |
| `gallery:readImageFile` | `imageId: string` | `imageId: number` |

---

## 修复内容

### 1. 修复 IPC 处理器参数类型

**修改前**：
```typescript
ipcMain.handle('gallery:deleteAlbum', async (_event, albumId: string) => {
  // ...
  await albumService.delete(albumId);  // 类型错误！
});
```

**修改后**：
```typescript
ipcMain.handle('gallery:deleteAlbum', async (_event, albumId: number) => {
  // ...
  await albumService.delete(albumId);  // 类型正确
});
```

### 2. 修复文件路径拼接

在需要使用 ID 拼接文件路径的地方，添加 `String()` 转换：

**修改前**：
```typescript
const albumPath = path.join(userDataPath, 'gallery', albumId);
```

**修改后**：
```typescript
const albumPath = path.join(userDataPath, 'gallery', String(albumId));
```

### 3. 移除不必要的 parseInt()

**修改前**：
```typescript
const images = await imageService.findByAlbum(parseInt(albumId));
```

**修改后**：
```typescript
const images = await imageService.findByAlbum(albumId);
```

---

## 修复的文件

1. `windows-login-manager/electron/ipc/handlers/localGalleryHandlers.ts`
   - 修复了 10 个 IPC 处理器的参数类型
   - 修复了文件路径拼接逻辑

---

## 测试验证

### 编译测试
```bash
cd windows-login-manager
npm run build
```
✅ 编译成功，无类型错误

### 功能测试清单

- [ ] 创建相册
- [ ] 查看相册列表
- [ ] 查看相册详情
- [ ] 更新相册信息
- [ ] **删除相册**（主要修复）
- [ ] 上传图片到相册
- [ ] 查看相册图片列表
- [ ] 查看图片详情
- [ ] 删除单张图片
- [ ] 批量删除图片
- [ ] 移动图片到其他相册
- [ ] 读取图片文件

---

## 相关问题

这个问题是 PostgreSQL 迁移的遗留问题，类似的类型错误可能存在于其他模块：

### 已修复的类似问题
- ✅ 文章管理 IPC 处理器
- ✅ 知识库 IPC 处理器
- ✅ 平台账号 IPC 处理器
- ✅ 发布任务 IPC 处理器
- ✅ **图库管理 IPC 处理器**（本次修复）

### 检查清单
所有 IPC 处理器中涉及数据库 ID 的参数都应该使用 `number` 类型，而不是 `string`。

---

## 经验教训

1. **类型一致性**：数据库 ID 类型（SERIAL）必须与代码中的类型（number）保持一致
2. **全面测试**：迁移后需要测试所有 CRUD 操作，不仅仅是读取
3. **类型检查**：TypeScript 的类型检查可以帮助发现这类问题，但需要正确配置
4. **文档更新**：迁移文档应该明确说明 ID 类型的变化

---

## 后续行动

1. ✅ 修复图库 IPC 处理器类型错误
2. ⏳ 用户测试验证删除功能
3. ⏳ 检查是否还有其他模块存在类似问题
4. ⏳ 更新 PostgreSQL 迁移文档，强调类型一致性

---

## 参考文档

- [PostgreSQL 迁移 - 阶段 6 完成总结](../07-开发文档/PostgreSQL迁移-阶段6完整总结.md)
- [UUID 到 SERIAL 类型修复清单](../07-开发文档/UUID到SERIAL类型修复-完整清单.md)
- [PostgreSQL 配置规范](.kiro/steering/postgresql.md)
