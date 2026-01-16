# PostgreSQL 迁移 - 编译错误修复清单

**创建时间**: 2026-01-16  
**状态**: 🔧 待修复  
**错误数量**: 56 个

---

## 📋 错误分类

### 1. 数据库连接导出问题 (5 个错误)

**文件**: 
- `electron/services/BaseServicePostgres.ts`
- `electron/main.ts`

**问题**: `postgres.ts` 使用类模式，但代码期望函数导出

**修复方案**: 在 `postgres.ts` 中添加函数导出

```typescript
// electron/database/postgres.ts 末尾添加

// 导出便捷函数
let dbInstance: PostgresDatabase | null = null;

export async function initializePostgres(config?: PostgresConfig): Promise<void> {
  dbInstance = PostgresDatabase.getInstance();
  await dbInstance.initialize(config);
}

export function getPool(): Pool {
  if (!dbInstance) {
    throw new Error('数据库未初始化');
  }
  return dbInstance.getPool();
}

export async function closePostgres(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
  }
}
```

---

### 2. Service 类方法访问权限问题 (10 个错误)

**问题**: `create` 方法是 `protected`，但在 IPC 处理器中被调用

**受影响的处理器**:
- articleHandlers.ts
- localAccountHandlers.ts
- localArticleSettingHandlers.ts
- localConversionTargetHandlers.ts
- localDistillationHandlers.ts
- localGalleryHandlers.ts
- localKnowledgeHandlers.ts
- localTopicHandlers.ts
- taskHandlers.ts

**修复方案**: 将 `BaseServicePostgres` 中的 `create` 方法改为 `public`

```typescript
// electron/services/BaseServicePostgres.ts

// 修改前
protected async create(input: Partial<T>): Promise<T> {

// 修改后
public async create(input: Partial<T>): Promise<T> {
```

---

### 3. 缺少的 Service 方法 (35 个错误)

#### ArticleServicePostgres 缺少的方法:
- `getKeywordStats()`
- `markAsPublished(id, publishedAt)`
- `findUnpublished()`

#### PlatformAccountServicePostgres 缺少的方法:
- `findByPlatform(platformId)`
- `updateCookies(id, cookies)`
- `getDecrypted(id)`
- `existsByPlatform(platformId, platformUserId)`

#### DistillationServicePostgres 缺少的方法:
- `search(searchTerm)`
- `findRecent(limit)`

#### AlbumServicePostgres 缺少的方法:
- `findAllWithStats()`
- `findByIdWithStats(albumId)`

#### ImageServicePostgres 缺少的方法:
- `findByAlbum(albumId)`

#### KnowledgeBaseServicePostgres 缺少的方法:
- `findAllWithDocumentCount()`
- `uploadDocument(params)`
- `findDocumentById(docId)`
- `deleteDocument(docId)`
- `searchDocuments(query, kbId)`

#### TopicServicePostgres 缺少的方法:
- `findByDistillation(distillationId)`
- `search(searchTerm)`
- `findUnused(limit)`
- `findRecent(limit)`

#### PublishingTaskServicePostgres 缺少的方法:
- `updateStatus(id, status, errorMessage)`
- `findPendingTasks()`
- `findByBatchId(batchId)`
- `cancelBatch(batchId)`
- `deleteBatch(batchId)`
- `getBatchStats(batchId)`

#### PublishingRecordServicePostgres 缺少的方法:
- `findByTaskId(taskId)`

**修复方案**: 为每个 Service 类添加缺少的方法

---

### 4. 其他类型错误 (6 个错误)

#### 错误 1: handler.ts 回调参数类型

```typescript
// electron/ipc/handler.ts:1613

// 修改前
publishingExecutor.setLogCallback((tid, level, message, details) => {

// 修改后
publishingExecutor.setLogCallback((tid: string, level: string, message: string, details?: any) => {
```

#### 错误 2: is_default 类型比较

```typescript
// electron/ipc/handlers/localAccountHandlers.ts

// 修改前
isDefault: account.is_default === 1 || account.is_default === true,

// 修改后
isDefault: Boolean(account.is_default),
```

#### 错误 3: ArticleServicePostgres 字段名

```typescript
// electron/services/ArticleServicePostgres.ts:347

// 修改前
isPublished: true,

// 修改后
is_published: true,
```

#### 错误 4: BaseServicePostgres rowCount 检查

```typescript
// electron/services/BaseServicePostgres.ts:514

// 修改前
return result.rowCount > 0;

// 修改后
return (result.rowCount ?? 0) > 0;
```

#### 错误 5: UserServicePostgres API 调用

```typescript
// electron/services/UserServicePostgres.ts:254

// 需要检查 apiClient 是否有 delete 方法
// 或者使用其他方式实现
```

#### 错误 6: main.ts handleAppQuit

```typescript
// electron/main.ts:349

// 修改前
handleAppQuit(): void {
  await closePostgres();
}

// 修改后
async handleAppQuit(): Promise<void> {
  await closePostgres();
}
```

---

## 🎯 快速修复优先级

### 优先级 1（必须修复）

1. **数据库连接导出** - 5 个错误
   - 添加 `initializePostgres`, `getPool`, `closePostgres` 函数

2. **create 方法访问权限** - 10 个错误
   - 将 `protected` 改为 `public`

### 优先级 2（重要）

3. **缺少的 Service 方法** - 35 个错误
   - 为每个 Service 类添加缺少的方法
   - 这些方法在原 SQLite 版本中存在

### 优先级 3（次要）

4. **类型错误** - 6 个错误
   - 修复类型注解
   - 修复字段名
   - 修复 null 检查

---

## 📝 建议的修复顺序

1. **先修复优先级 1** - 这样至少可以编译通过
2. **然后修复优先级 2** - 恢复完整功能
3. **最后修复优先级 3** - 提高代码质量

---

## 🚀 临时解决方案

如果你想快速测试，可以：

1. **跳过编译，直接运行开发模式**:
   ```bash
   npm run dev
   ```
   Vite 会在运行时编译，可能会忽略一些 TypeScript 错误

2. **使用 SQLite 版本测试**:
   - 暂时不使用 PostgreSQL
   - 等修复完成后再切换

---

## 📚 相关文档

- [PostgreSQL 迁移 - 阶段 6 最终完成报告](./PostgreSQL迁移-阶段6最终完成报告.md)
- [Service 类使用指南](../../windows-login-manager/electron/services/README_POSTGRES_SERVICES.md)

---

**文档版本**: 1.0  
**最后更新**: 2026-01-16  
**状态**: 🔧 待修复
