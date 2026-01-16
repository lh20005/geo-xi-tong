# PostgreSQL Services 使用指南

## 📋 概述

本目录包含 PostgreSQL 版本的 Service 类，用于替代原有的 SQLite Service 类。

**核心特点**:
- ✅ 异步操作（async/await）
- ✅ 自动管理 user_id（从 JWT 获取）
- ✅ 数据隔离（只能访问自己的数据）
- ✅ 事务支持
- ✅ 完整的错误处理

---

## 🏗️ 架构

```
BaseServicePostgres (基类)
    ↓ 继承
    ├── UserServicePostgres (用户服务)
    ├── ArticleServicePostgres (文章服务)
    ├── AlbumServicePostgres (相册服务)
    ├── ImageServicePostgres (图片服务)
    └── ... (其他服务)
```

---

## 🚀 快速开始

### 1. 创建新的 Service 类

```typescript
// AlbumServicePostgres.ts
import { BaseServicePostgres } from './BaseServicePostgres';

export interface Album {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

export class AlbumServicePostgres extends BaseServicePostgres<Album> {
  constructor() {
    super('albums', 'AlbumService');
  }

  // 添加特定的业务方法
  async createAlbum(name: string, description?: string): Promise<Album> {
    return await this.create({
      name,
      description
    });
  }

  async findByName(name: string): Promise<Album[]> {
    this.validateUserId();

    const result = await this.pool.query(
      'SELECT * FROM albums WHERE user_id = $1 AND name = $2',
      [this.userId, name]
    );

    return result.rows as Album[];
  }
}
```

### 2. 在 IPC 处理器中使用

```typescript
// albumHandlers.ts
import { ipcMain } from 'electron';
import { AlbumServicePostgres } from '../services/AlbumServicePostgres';

const albumService = new AlbumServicePostgres();

// 注意：必须使用 async/await
ipcMain.handle('album:create', async (event, name, description) => {
  try {
    return await albumService.createAlbum(name, description);
  } catch (error) {
    console.error('创建相册失败:', error);
    throw error;
  }
});

ipcMain.handle('album:findAll', async (event) => {
  try {
    return await albumService.findAll();
  } catch (error) {
    console.error('查询相册失败:', error);
    throw error;
  }
});

ipcMain.handle('album:findById', async (event, id) => {
  try {
    return await albumService.findById(id);
  } catch (error) {
    console.error('查询相册失败:', error);
    throw error;
  }
});

ipcMain.handle('album:update', async (event, id, data) => {
  try {
    return await albumService.update(id, data);
  } catch (error) {
    console.error('更新相册失败:', error);
    throw error;
  }
});

ipcMain.handle('album:delete', async (event, id) => {
  try {
    await albumService.delete(id);
    return { success: true };
  } catch (error) {
    console.error('删除相册失败:', error);
    throw error;
  }
});
```

---

## 📚 BaseServicePostgres API

### 核心方法

#### `getCurrentUserId(): number`
从 JWT token 获取当前用户 ID。

**注意**: 这是唯一的 user_id 来源，保证数据安全。

```typescript
const userId = this.getCurrentUserId();
console.log('当前用户 ID:', userId);
```

---

#### `validateUserId(): void`
验证 user_id 是否有效。

**自动调用**: 所有 CRUD 方法都会自动调用此方法。

```typescript
this.validateUserId(); // 如果无效会抛出错误
```

---

#### `create(data: Partial<T>): Promise<T>`
创建记录，自动添加 user_id。

**特点**:
- ✅ 自动添加 user_id
- ✅ 自动添加 created_at 和 updated_at
- ✅ 返回创建的记录

```typescript
const album = await this.create({
  name: '我的相册',
  description: '这是一个测试相册'
});
// album.user_id 会自动设置为当前用户 ID
```

---

#### `findById(id: string | number): Promise<T | null>`
根据 ID 查找记录，自动添加 user_id 过滤。

**特点**:
- ✅ 自动添加 WHERE user_id = $1
- ✅ 只能查询自己的记录
- ✅ 返回 null 如果不存在

```typescript
const album = await this.findById(1);
if (album) {
  console.log('找到相册:', album.name);
} else {
  console.log('相册不存在或无权限访问');
}
```

---

#### `findAll(conditions?: Partial<T>): Promise<T[]>`
查找所有记录，自动添加 user_id 过滤。

**特点**:
- ✅ 自动添加 WHERE user_id = $1
- ✅ 只返回当前用户的记录
- ✅ 可以添加额外的查询条件

```typescript
// 查询所有相册
const albums = await this.findAll();

// 查询特定条件的相册
const albums = await this.findAll({ name: '我的相册' });
```

---

#### `findPaginated(params, searchFields?): Promise<PaginatedResult<T>>`
分页查询，自动添加 user_id 过滤。

**参数**:
- `page`: 页码（默认 1）
- `pageSize`: 每页数量（默认 20）
- `sortField`: 排序字段（默认 'created_at'）
- `sortOrder`: 排序方向（'asc' 或 'desc'，默认 'desc'）
- `search`: 搜索关键词
- `searchFields`: 搜索字段数组

```typescript
const result = await this.findPaginated(
  {
    page: 1,
    pageSize: 10,
    sortField: 'created_at',
    sortOrder: 'desc',
    search: '测试'
  },
  ['name', 'description']
);

console.log('总数:', result.total);
console.log('当前页:', result.page);
console.log('总页数:', result.totalPages);
console.log('数据:', result.data);
```

---

#### `update(id: string | number, data: Partial<T>): Promise<T>`
更新记录，自动添加 user_id 过滤。

**特点**:
- ✅ 自动添加 WHERE user_id = $1
- ✅ 只能修改自己的记录
- ✅ 自动更新 updated_at
- ✅ 返回更新后的记录

```typescript
const album = await this.update(1, {
  name: '新名称',
  description: '新描述'
});
// 如果记录不存在或无权限，会抛出错误
```

---

#### `delete(id: string | number): Promise<void>`
删除记录，自动添加 user_id 过滤。

**特点**:
- ✅ 自动添加 WHERE user_id = $1
- ✅ 只能删除自己的记录
- ✅ 如果不存在或无权限，会抛出错误

```typescript
await this.delete(1);
// 如果记录不存在或无权限，会抛出错误
```

---

#### `deleteMany(ids: (string | number)[]): Promise<number>`
批量删除记录，自动添加 user_id 过滤。

**返回**: 删除的记录数

```typescript
const count = await this.deleteMany([1, 2, 3]);
console.log('删除了', count, '条记录');
```

---

#### `count(conditions?: Partial<T>): Promise<number>`
统计记录数，自动添加 user_id 过滤。

```typescript
const total = await this.count();
console.log('总共有', total, '条记录');

const count = await this.count({ name: '测试' });
console.log('名称为"测试"的记录有', count, '条');
```

---

#### `exists(id: string | number): Promise<boolean>`
检查记录是否存在，自动添加 user_id 过滤。

```typescript
const exists = await this.exists(1);
if (exists) {
  console.log('记录存在');
} else {
  console.log('记录不存在或无权限访问');
}
```

---

#### `transaction<R>(fn: (client: PoolClient) => Promise<R>): Promise<R>`
执行事务。

**用途**: 需要原子性的操作（如级联删除）

```typescript
await this.transaction(async (client) => {
  // 在事务中执行多个操作
  await client.query('DELETE FROM table1 WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM table2 WHERE user_id = $1', [userId]);
  // 如果任何操作失败，会自动回滚
});
```

---

## ⚠️ 重要注意事项

### 1. user_id 管理

**不要手动设置 user_id**:
```typescript
// ❌ 错误：手动设置 user_id
await this.create({
  user_id: 123,  // 不要这样做！
  name: '测试'
});

// ✅ 正确：让 BaseService 自动添加
await this.create({
  name: '测试'
});
```

**原因**: user_id 必须从 JWT token 获取，保证数据安全。

---

### 2. 异步操作

**所有方法都是异步的**:
```typescript
// ❌ 错误：忘记 await
const album = this.findById(1);  // 返回 Promise，不是 Album

// ✅ 正确：使用 await
const album = await this.findById(1);
```

---

### 3. 错误处理

**始终使用 try-catch**:
```typescript
try {
  const album = await albumService.findById(1);
  // 处理结果
} catch (error) {
  console.error('查询失败:', error);
  // 处理错误
}
```

---

### 4. 事务使用

**需要原子性时使用事务**:
```typescript
// 示例：删除相册及其所有图片
async deleteAlbumWithImages(albumId: number): Promise<void> {
  await this.transaction(async (client) => {
    // 先删除图片
    await client.query(
      'DELETE FROM images WHERE album_id = $1 AND user_id = $2',
      [albumId, this.userId]
    );

    // 再删除相册
    await client.query(
      'DELETE FROM albums WHERE id = $1 AND user_id = $2',
      [albumId, this.userId]
    );
  });
}
```

---

## 📝 常见问题

### Q1: 如何获取 user_id？

**A**: 不需要手动获取，BaseService 会自动从 JWT token 获取。

```typescript
// 不需要这样做
const userId = getUserIdFromSomewhere();

// BaseService 会自动处理
const albums = await albumService.findAll();
```

---

### Q2: 如何查询其他用户的数据？

**A**: 不能。这是设计的安全特性，防止数据泄露。

如果确实需要查询其他用户的数据（如管理员功能），需要：
1. 创建专门的管理员 Service 类
2. 不继承 BaseServicePostgres
3. 手动实现权限检查

---

### Q3: 如何处理级联删除？

**A**: 参考 `UserServicePostgres.deleteAccount()` 方法：

```typescript
async deleteWithRelated(id: number): Promise<void> {
  await this.transaction(async (client) => {
    // 按依赖顺序删除
    await client.query('DELETE FROM child_table WHERE parent_id = $1 AND user_id = $2', [id, this.userId]);
    await client.query('DELETE FROM parent_table WHERE id = $1 AND user_id = $2', [id, this.userId]);
  });
}
```

---

### Q4: 如何添加自定义查询？

**A**: 在子类中添加方法：

```typescript
export class AlbumServicePostgres extends BaseServicePostgres<Album> {
  async findByNamePattern(pattern: string): Promise<Album[]> {
    this.validateUserId();  // 必须调用

    const result = await this.pool.query(
      'SELECT * FROM albums WHERE user_id = $1 AND name ILIKE $2',
      [this.userId, `%${pattern}%`]
    );

    return result.rows as Album[];
  }
}
```

---

## 🔗 相关文档

- [外键约束替代实施清单](../../../docs/07-开发文档/外键约束替代实施清单.md)
- [外键约束功能替代方案](../../../docs/07-开发文档/外键约束功能替代方案.md)
- [外键约束替代实施完成报告](../../../docs/07-开发文档/外键约束替代实施完成报告.md)
- [PostgreSQL 迁移完整计划](../../../docs/07-开发文档/PostgreSQL迁移完整计划.md)

---

**文档版本**: 1.0  
**创建日期**: 2026-01-16  
**最后更新**: 2026-01-16
