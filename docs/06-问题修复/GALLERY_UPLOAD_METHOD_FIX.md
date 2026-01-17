# 图库上传图片方法调用错误修复

**修复日期**: 2026-01-17  
**问题**: 上传图片后数据库中没有记录  
**根本原因**: IPC 处理器调用了错误的 Service 方法

---

## 问题分析

### 症状
- 用户上传图片后，界面显示"0 张图片"
- 数据库查询确认：相册存在，但没有图片记录
- 文件已复制到相册目录，但数据库中没有对应记录

### 数据库验证
```sql
-- 相册存在
SELECT id, name FROM albums WHERE id = 11;
-- 结果：id=11, name='1'

-- 但没有图片
SELECT COUNT(*) FROM images WHERE album_id = 11;
-- 结果：0
```

### 根本原因
IPC 处理器调用了 `imageService.create()` 方法，但 `ImageServicePostgres` 类中正确的方法名是 `createImage()`。

`create()` 是基类 `BaseServicePostgres` 的方法，它不会自动添加必需的默认字段（`usage_count`, `is_orphan`, `reference_count`），导致插入失败。

---

## 代码对比

### ImageServicePostgres 类定义

```typescript
export class ImageServicePostgres extends BaseServicePostgres<Image> {
  /**
   * 创建图片 - 正确的方法
   */
  async createImage(input: CreateImageInput): Promise<Image> {
    return await this.create({
      ...input,
      usage_count: 0,        // ✅ 添加默认值
      is_orphan: false,      // ✅ 添加默认值
      reference_count: 0     // ✅ 添加默认值
    });
  }
}
```

### IPC 处理器错误调用

**修改前**（错误）：
```typescript
// ❌ 错误：直接调用基类方法，缺少默认字段
const image = await imageService.create({
  album_id: albumId,
  filename: file.name,
  filepath: destPath,
  mime_type: file.type,
  size: content.length
});
```

**修改后**（正确）：
```typescript
// ✅ 正确：调用包装方法，自动添加默认字段
const image = await imageService.createImage({
  album_id: albumId,
  filename: file.name,
  filepath: destPath,
  mime_type: file.type,
  size: content.length
});
```

---

## 修复内容

### 文件修改

**文件**: `windows-login-manager/electron/ipc/handlers/localGalleryHandlers.ts`

**位置**: `gallery:uploadImage` IPC 处理器

**修改**:
```diff
- const image = await imageService.create({
+ const image = await imageService.createImage({
    album_id: albumId,
    filename: file.name,
    filepath: destPath,
    mime_type: file.type,
    size: content.length
  });
```

---

## 为什么会出错？

### 1. 基类方法 vs 包装方法

`BaseServicePostgres.create()` 是通用方法，直接插入传入的数据：
```typescript
async create(data: Partial<T>): Promise<T> {
  // 直接插入 data，不添加任何默认值
  const result = await this.pool.query(
    `INSERT INTO ${this.tableName} (...) VALUES (...) RETURNING *`,
    [...]
  );
  return result.rows[0];
}
```

`ImageServicePostgres.createImage()` 是包装方法，添加必需的默认值：
```typescript
async createImage(input: CreateImageInput): Promise<Image> {
  return await this.create({
    ...input,
    usage_count: 0,        // 必需字段
    is_orphan: false,      // 必需字段
    reference_count: 0     // 必需字段
  });
}
```

### 2. 数据库约束

虽然数据库表定义中这些字段有默认值：
```sql
usage_count     | integer | default 0
is_orphan       | boolean | default false
reference_count | integer | default 0
```

但如果 INSERT 语句中显式传递了 `undefined` 或 `null`，数据库默认值不会生效，导致插入失败或数据不完整。

---

## 测试验证

### 编译测试
```bash
cd windows-login-manager
npm run build:electron
```
✅ 编译成功

### 功能测试步骤

1. 启动 Windows 客户端
2. 进入企业图库
3. 创建新相册
4. 上传图片
5. **验证**：图片立即显示在列表中
6. **数据库验证**：
   ```sql
   SELECT * FROM images WHERE album_id = <新相册ID>;
   ```
   应该看到新插入的图片记录

---

## 相关问题

这个问题暴露了一个设计模式问题：

### ❌ 不推荐：直接调用基类方法
```typescript
await imageService.create({ ... });  // 可能缺少必需字段
```

### ✅ 推荐：调用包装方法
```typescript
await imageService.createImage({ ... });  // 自动添加默认值
```

### 其他 Service 类的类似方法

检查其他 Service 类是否也有类似的包装方法：

- `ArticleServicePostgres.createArticle()` ✅
- `KnowledgeBaseServicePostgres.createKnowledgeBase()` ✅
- `AlbumServicePostgres.createAlbum()` ✅
- `PlatformAccountServicePostgres.createAccount()` ✅

**规则**：始终使用 Service 类提供的包装方法，而不是直接调用基类的 `create()`。

---

## 经验教训

1. **方法命名一致性**：Service 类应该提供明确命名的方法（如 `createImage`），而不是依赖基类的通用方法
2. **类型安全**：TypeScript 类型检查无法捕获这种错误，因为 `create()` 方法也是合法的
3. **代码审查**：需要检查所有 IPC 处理器，确保调用了正确的 Service 方法
4. **测试覆盖**：端到端测试应该验证数据是否真的插入到数据库

---

## 后续行动

1. ✅ 修复图库上传方法调用
2. ⏳ 用户测试验证上传功能
3. ⏳ 审查其他 IPC 处理器，确保使用正确的 Service 方法
4. ⏳ 添加端到端测试，验证数据库插入

---

## 相关文档

- [图库上传图片后无法显示问题修复](./GALLERY_IMAGE_DISPLAY_FIX.md)
- [企业图库删除功能修复](./GALLERY_DELETE_TYPE_FIX.md)
- [PostgreSQL 迁移 - 阶段 6 完成总结](../07-开发文档/PostgreSQL迁移-阶段6完整总结.md)
