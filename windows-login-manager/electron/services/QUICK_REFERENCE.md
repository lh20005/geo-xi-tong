# PostgreSQL Services 快速参考

## 🚀 快速开始

### 1. 创建新的 Service 类

```typescript
import { BaseServicePostgres } from './BaseServicePostgres';

export interface YourModel {
  id: number;
  user_id: number;
  // 其他字段...
  created_at: Date;
  updated_at: Date;
}

export class YourServicePostgres extends BaseServicePostgres<YourModel> {
  constructor() {
    super('your_table_name', 'YourService');
  }

  // 添加业务方法
  async createYourModel(data: any): Promise<YourModel> {
    return await this.create(data);
  }
}
```

### 2. 在 IPC 处理器中使用

```typescript
import { ipcMain } from 'electron';
import { YourServicePostgres } from '../services/YourServicePostgres';

const service = new YourServicePostgres();

ipcMain.handle('your:create', async (event, data) => {
  return await service.createYourModel(data);
});

ipcMain.handle('your:findAll', async (event) => {
  return await service.findAll();
});
```

---

## 📚 BaseServicePostgres 常用方法

### 创建记录
```typescript
const record = await service.create({
  name: '测试',
  description: '描述'
});
// user_id 自动添加
```

### 查询记录
```typescript
// 根据 ID 查询
const record = await service.findById(1);

// 查询所有
const records = await service.findAll();

// 条件查询
const records = await service.findAll({ status: 'active' });

// 分页查询
const result = await service.findPaginated({
  page: 1,
  pageSize: 20,
  search: '关键词',
  sortField: 'created_at',
  sortOrder: 'desc'
}, ['name', 'description']);
```

### 更新记录
```typescript
const updated = await service.update(1, {
  name: '新名称'
});
// updated_at 自动更新
```

### 删除记录
```typescript
await service.delete(1);

// 批量删除
const count = await service.deleteMany([1, 2, 3]);
```

### 统计和检查
```typescript
// 统计数量
const count = await service.count();
const count = await service.count({ status: 'active' });

// 检查存在
const exists = await service.exists(1);
```

### 事务
```typescript
await service.transaction(async (client) => {
  await client.query('DELETE FROM table1 WHERE id = $1', [id]);
  await client.query('DELETE FROM table2 WHERE id = $1', [id]);
});
```

---

## ⚠️ 重要注意事项

### ❌ 不要这样做

```typescript
// ❌ 手动设置 user_id
await service.create({
  user_id: 123,  // 错误！
  name: '测试'
});

// ❌ 忘记 await
const record = service.findById(1);  // 返回 Promise

// ❌ 不使用 try-catch
const record = await service.findById(1);  // 可能抛出错误
```

### ✅ 正确做法

```typescript
// ✅ 让 BaseService 自动添加 user_id
await service.create({
  name: '测试'
});

// ✅ 使用 await
const record = await service.findById(1);

// ✅ 使用 try-catch
try {
  const record = await service.findById(1);
} catch (error) {
  console.error('查询失败:', error);
}
```

---

## 🔧 常见模式

### 模式 1: 级联删除

```typescript
async deleteWithRelated(id: number): Promise<void> {
  await this.transaction(async (client) => {
    // 先删除子记录
    await client.query(
      'DELETE FROM child_table WHERE parent_id = $1 AND user_id = $2',
      [id, this.userId]
    );
    
    // 再删除父记录
    await client.query(
      'DELETE FROM parent_table WHERE id = $1 AND user_id = $2',
      [id, this.userId]
    );
  });
}
```

### 模式 2: 关联查询

```typescript
async getWithRelated(id: number): Promise<any> {
  this.validateUserId();
  
  const result = await this.pool.query(
    `SELECT p.*, COUNT(c.id) as child_count
     FROM parent_table p
     LEFT JOIN child_table c ON c.parent_id = p.id
     WHERE p.id = $1 AND p.user_id = $2
     GROUP BY p.id`,
    [id, this.userId]
  );
  
  return result.rows[0];
}
```

### 模式 3: 批量操作

```typescript
async batchCreate(items: any[]): Promise<any[]> {
  this.validateUserId();
  
  return await this.transaction(async (client) => {
    const results = [];
    for (const item of items) {
      const result = await client.query(
        'INSERT INTO table (user_id, name) VALUES ($1, $2) RETURNING *',
        [this.userId, item.name]
      );
      results.push(result.rows[0]);
    }
    return results;
  });
}
```

### 模式 4: 更新计数

```typescript
async updateCount(parentId: number): Promise<void> {
  this.validateUserId();
  
  await this.pool.query(
    `UPDATE parent_table 
     SET child_count = (
       SELECT COUNT(*) FROM child_table 
       WHERE parent_id = $1 AND user_id = $2
     )
     WHERE id = $1 AND user_id = $2`,
    [parentId, this.userId]
  );
}
```

---

## 📊 已实现的 Service 类

| Service 类 | 表名 | 功能 |
|-----------|------|------|
| BaseServicePostgres | - | 基础类，提供通用 CRUD |
| UserServicePostgres | users | 级联删除 |
| ArticleServicePostgres | articles | 文章管理，task_id 处理 |
| AlbumServicePostgres | albums | 相册管理 |
| ImageServicePostgres | images | 图片管理，引用计数 |
| KnowledgeBaseServicePostgres | knowledge_bases | 知识库管理 |
| PlatformAccountServicePostgres | platform_accounts | 平台账号管理 |
| PublishingTaskServicePostgres | publishing_tasks | 发布任务，task_id 处理 |
| DistillationServicePostgres | distillations | 蒸馏管理 |

---

## 🔗 相关文档

- [完整使用指南](./README_POSTGRES_SERVICES.md)
- [实施清单](../../../docs/07-开发文档/外键约束替代实施清单.md)
- [技术方案](../../../docs/07-开发文档/外键约束功能替代方案.md)
- [完成报告](../../../docs/07-开发文档/外键约束替代实施完成报告.md)

---

**版本**: 1.0  
**更新日期**: 2026-01-16
