# 事务使用指南

## Task 13.3: 数据库事务隔离级别配置

本文档说明如何在项目中使用配置好的事务隔离级别。

## 配置文件

**位置**: `server/src/db/transactionConfig.ts`

提供了以下功能：
- 事务隔离级别枚举
- 开始/提交/回滚事务的辅助函数
- 自动处理事务的包装函数
- 死锁重试机制

## 使用方法

### 方法1：手动控制事务（当前使用）

```typescript
import { pool } from '../db/database';

const client = await pool.connect();
try {
  await client.query('BEGIN');
  
  // 执行数据库操作
  await client.query('INSERT INTO ...');
  await client.query('UPDATE distillations SET usage_count = usage_count + 1 WHERE id = $1', [id]);
  
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

**特点**:
- ✅ 简单直接
- ✅ 使用PostgreSQL默认隔离级别（READ COMMITTED）
- ✅ 适合大多数场景

### 方法2：使用事务配置（推荐用于新代码）

```typescript
import { pool } from '../db/database';
import { executeTransaction, IsolationLevel } from '../db/transactionConfig';

const client = await pool.connect();
try {
  const result = await executeTransaction(client, async () => {
    // 执行数据库操作
    await client.query('INSERT INTO ...');
    await client.query('UPDATE distillations SET usage_count = usage_count + 1 WHERE id = $1', [id]);
    
    return someValue;
  }, IsolationLevel.READ_COMMITTED);
  
  return result;
} finally {
  client.release();
}
```

**特点**:
- ✅ 自动处理提交/回滚
- ✅ 明确指定隔离级别
- ✅ 代码更简洁

### 方法3：带死锁重试（高并发场景）

```typescript
import { pool } from '../db/database';
import { executeTransactionWithRetry, IsolationLevel } from '../db/transactionConfig';

const client = await pool.connect();
try {
  const result = await executeTransactionWithRetry(
    client,
    async () => {
      // 执行数据库操作
      await client.query('UPDATE distillations SET usage_count = usage_count + 1 WHERE id = $1', [id]);
      return someValue;
    },
    3, // 最大重试次数
    IsolationLevel.READ_COMMITTED
  );
  
  return result;
} finally {
  client.release();
}
```

**特点**:
- ✅ 自动处理死锁重试
- ✅ 适合高并发场景
- ✅ 提高系统可靠性

## 隔离级别选择

### READ COMMITTED（默认，推荐）

**适用场景**:
- ✅ usage_count的原子更新
- ✅ 大多数CRUD操作
- ✅ 高并发场景

**优点**:
- 性能最好
- 避免脏读
- 配合原子操作确保并发安全

**示例**:
```typescript
await executeTransaction(client, async () => {
  await client.query('UPDATE distillations SET usage_count = usage_count + 1 WHERE id = $1', [id]);
}, IsolationLevel.READ_COMMITTED);
```

### REPEATABLE READ

**适用场景**:
- 需要在事务中多次读取同一数据
- 要求读取的数据在事务期间保持一致

**示例**:
```typescript
await executeTransaction(client, async () => {
  const result1 = await client.query('SELECT * FROM distillations WHERE id = $1', [id]);
  // ... 其他操作 ...
  const result2 = await client.query('SELECT * FROM distillations WHERE id = $1', [id]);
  // result1 和 result2 的数据保证一致
}, IsolationLevel.REPEATABLE_READ);
```

### SERIALIZABLE

**适用场景**:
- 对数据一致性要求极高
- 可以接受较低的并发性能

**注意**: 通常不需要使用此级别，READ COMMITTED + 原子操作已经足够安全。

## 当前项目中的使用

### ArticleGenerationService.saveArticleWithUsageTracking()

**当前实现**:
```typescript
await client.query('BEGIN');
try {
  // 1. 保存文章
  // 2. 创建使用记录
  // 3. 更新usage_count（原子操作）
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
}
```

**隔离级别**: READ COMMITTED（PostgreSQL默认）

**为什么足够安全**:
1. ✅ 使用原子操作 `UPDATE ... SET usage_count = usage_count + 1`
2. ✅ 所有操作在同一事务中
3. ✅ 失败自动回滚
4. ✅ READ COMMITTED避免脏读

### DistillationService.decrementUsageCount()

**当前实现**:
```typescript
await pool.query(
  'UPDATE distillations SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = $1',
  [distillationId]
);
```

**特点**:
- ✅ 单条SQL语句，原子性保证
- ✅ 不需要显式事务
- ✅ 使用GREATEST确保不会小于0

## 并发安全性保证

### 1. 原子操作

```sql
-- ✅ 正确：原子操作
UPDATE distillations SET usage_count = usage_count + 1 WHERE id = $1;

-- ❌ 错误：读-修改-写（存在竞态条件）
SELECT usage_count FROM distillations WHERE id = $1;
-- 计算 newCount = usage_count + 1
UPDATE distillations SET usage_count = $2 WHERE id = $1;
```

### 2. 事务隔离

```typescript
// READ COMMITTED 确保：
// - 只读取已提交的数据
// - 避免脏读
// - 配合原子操作避免竞态条件
```

### 3. 死锁处理

```typescript
// 使用 executeTransactionWithRetry 自动重试
// PostgreSQL会自动检测死锁并回滚其中一个事务
// 我们的代码会自动重试被回滚的事务
```

## 性能考虑

### READ COMMITTED vs SERIALIZABLE

| 隔离级别 | 并发性能 | 数据一致性 | 适用场景 |
|---------|---------|-----------|---------|
| READ COMMITTED | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 大多数场景 |
| REPEATABLE READ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 需要可重复读 |
| SERIALIZABLE | ⭐⭐ | ⭐⭐⭐⭐⭐ | 极高一致性要求 |

### 推荐配置

对于usage_count更新：
- ✅ 使用 READ COMMITTED
- ✅ 使用原子操作
- ✅ 在事务中执行多步操作
- ✅ 高并发场景考虑死锁重试

## 测试验证

### Property 15: 并发安全性

**位置**: `server/src/services/__tests__/articleGenerationService.property.test.ts`

```typescript
it('should maintain correct usage_count under concurrent article generation', async () => {
  // 模拟多个并发文章生成
  // 验证最终usage_count正确
  // 确保没有丢失更新
});
```

## 总结

✅ **当前配置已经足够安全**
- 使用READ COMMITTED隔离级别（PostgreSQL默认）
- 所有usage_count更新使用原子操作
- 多步操作包装在事务中
- 失败自动回滚

✅ **新的事务配置提供了更多选项**
- 明确指定隔离级别
- 自动处理提交/回滚
- 死锁重试机制
- 适合未来扩展

**验证: 需求 6.5**

---

**文档日期**: 2024-12-15
**状态**: ✅ 已配置并验证
