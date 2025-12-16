# 删除话题同步清理distillation记录说明

## 问题描述

在蒸馏结果页面删除关键词后，关键词蒸馏页面仍然显示被删除的关键词。

### 原因分析

数据库有两个相关表：
- `distillations`表：存储关键词蒸馏记录
- `topics`表：存储具体的蒸馏结果（话题）

之前的删除逻辑只删除了`topics`表中的记录，但没有清理`distillations`表中没有话题的记录，导致：
1. 关键词蒸馏页面仍显示该关键词（从`distillations`表查询）
2. 但该关键词下已经没有任何话题了

## 解决方案

修改删除逻辑，在删除话题后，自动清理没有话题的`distillations`记录。

### 修改的函数

#### 1. deleteTopicsByIds（批量删除话题）
**文件**：`server/src/db/database.ts`

**修改内容**：
```typescript
// 删除话题后，清理没有话题的distillation记录
await client.query(
  `DELETE FROM distillations 
   WHERE id = ANY($1::int[]) 
   AND NOT EXISTS (
     SELECT 1 FROM topics WHERE distillation_id = distillations.id
   )`,
  [distillationIds]
);
```

**影响范围**：
- 单个删除（表格行的删除按钮）
- 批量删除选中

#### 2. deleteTopicsByKeyword（按关键词删除）
**文件**：`server/src/services/distillationService.ts`

**修改内容**：
```typescript
// 删除话题后，清理没有话题的distillation记录
await client.query(
  `DELETE FROM distillations 
   WHERE id = ANY($1::int[]) 
   AND NOT EXISTS (
     SELECT 1 FROM topics WHERE distillation_id = distillations.id
   )`,
  [distillationIds]
);
```

**影响范围**：
- 删除当前关键词

## 执行流程

### 场景1：批量删除选中话题

```
1. 用户勾选3条话题并删除
   ↓
2. 查询这3条话题关联的distillation IDs
   ↓
3. 删除这3条话题
   ↓
4. 检查这些distillation记录是否还有其他话题
   ↓
5. 如果没有话题了，删除对应的distillation记录
   ↓
6. 提交事务
```

### 场景2：删除当前关键词

```
1. 用户选择关键词"产品设计"并点击删除
   ↓
2. 查询"产品设计"关键词的所有distillation IDs
   ↓
3. 查询这些distillation下的所有话题IDs
   ↓
4. 删除所有话题
   ↓
5. 删除没有话题的distillation记录
   ↓
6. 提交事务
```

## SQL逻辑

### 清理没有话题的distillation记录

```sql
DELETE FROM distillations 
WHERE id = ANY($1::int[])  -- 只检查相关的distillation记录
AND NOT EXISTS (            -- 确保没有关联的话题
  SELECT 1 
  FROM topics 
  WHERE distillation_id = distillations.id
)
```

### 为什么使用NOT EXISTS？

- **性能优化**：NOT EXISTS在找到第一条匹配记录时就停止查询
- **准确性**：确保只删除真正没有话题的记录
- **安全性**：不会误删有话题的distillation记录

## 数据一致性保证

### 事务处理
所有删除操作都在事务中执行：
```typescript
await client.query('BEGIN');
try {
  // 删除话题
  // 清理distillation记录
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
}
```

### 级联关系
数据库表结构：
```sql
CREATE TABLE topics (
  id SERIAL PRIMARY KEY,
  distillation_id INTEGER REFERENCES distillations(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

虽然有`ON DELETE CASCADE`，但我们不直接删除distillation记录，而是：
1. 先删除topics
2. 再清理没有topics的distillation记录

这样更安全，避免误删。

## 测试验证

### 测试场景1：删除部分话题
```
初始状态：
- 关键词"产品设计"有3条话题

操作：
- 删除其中2条话题

预期结果：
- 2条话题被删除
- "产品设计"的distillation记录保留（还有1条话题）
- 关键词蒸馏页面仍显示"产品设计"
```

### 测试场景2：删除所有话题
```
初始状态：
- 关键词"产品设计"有3条话题

操作：
- 删除所有3条话题

预期结果：
- 3条话题被删除
- "产品设计"的distillation记录被删除
- 关键词蒸馏页面不再显示"产品设计"
```

### 测试场景3：删除当前关键词
```
初始状态：
- 关键词"测试"有5条话题

操作：
- 选择关键词"测试"
- 点击"删除当前关键词"

预期结果：
- 5条话题被删除
- "测试"的distillation记录被删除
- 关键词蒸馏页面不再显示"测试"
- 蒸馏结果页面的关键词下拉列表不再显示"测试"
```

## 影响的页面

### 1. 蒸馏结果页面
- 删除话题后，如果关键词下没有话题了，关键词下拉列表会自动更新
- 不再显示已删除的关键词

### 2. 关键词蒸馏页面
- 蒸馏历史列表会自动更新
- 不再显示没有话题的关键词记录

### 3. 文章生成页面
- 关键词下拉列表会自动更新
- 不再显示已删除的关键词

## 性能影响

### 额外的数据库操作
每次删除话题时，增加了：
1. 查询distillation IDs（1次查询）
2. 删除没有话题的distillation记录（1次删除）

### 性能优化
- 使用`ANY($1::int[])`批量操作，避免循环查询
- 使用`NOT EXISTS`子查询，性能优于`LEFT JOIN`
- 在事务中执行，确保原子性

### 预期性能
- 删除10条话题：增加约10-20ms
- 删除100条话题：增加约50-100ms
- 对用户体验影响可忽略

## 回滚方案

如果发现问题，可以回滚到之前的版本：

### 回滚database.ts
```typescript
// 恢复原来的简单删除逻辑
export async function deleteTopicsByIds(topicIds: number[]): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'DELETE FROM topics WHERE id = ANY($1::int[])',
      [topicIds]
    );
    await client.query('COMMIT');
    return result.rowCount || 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### 手动清理孤立记录
如果需要手动清理没有话题的distillation记录：
```sql
DELETE FROM distillations 
WHERE NOT EXISTS (
  SELECT 1 FROM topics WHERE distillation_id = distillations.id
);
```

## 注意事项

1. **数据一致性**：所有操作都在事务中执行，确保数据一致性
2. **性能影响**：增加的查询和删除操作对性能影响很小
3. **向后兼容**：不影响现有功能，只是增强了数据清理
4. **安全性**：使用NOT EXISTS确保不会误删有话题的记录

## 总结

通过修改删除逻辑，实现了：
- ✅ 删除话题后自动清理没有话题的distillation记录
- ✅ 关键词蒸馏页面不再显示已删除的关键词
- ✅ 蒸馏结果页面的关键词列表自动更新
- ✅ 数据一致性得到保证
- ✅ 性能影响可忽略

这样就解决了删除话题后关键词仍然显示的问题。
