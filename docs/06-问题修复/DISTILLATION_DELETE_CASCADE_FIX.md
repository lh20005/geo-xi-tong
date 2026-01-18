# 蒸馏删除级联清理修复

## 问题描述

**问题**：删除蒸馏记录后，筛选器中仍然显示已删除的关键词

**现象**：
- 用户删除了"英国留学"蒸馏记录
- 但在蒸馏结果页面的筛选器中，"英国留学"仍然可以选择
- 实际上该蒸馏已被删除，但相关的话题（topics）没有被清理

**影响用户**：aizhiruan（user_id = 1）

## 根本原因

### 数据库层面

虽然 `topics` 表有外键约束：
```sql
FOREIGN KEY (distillation_id) REFERENCES distillations(id) ON DELETE SET NULL
```

但这个约束只是将 `topics.distillation_id` 设置为 NULL，并不会删除 topics 记录。

### 代码层面

`DistillationServicePostgres.deleteDistillation()` 方法只删除了 distillations 表的记录，没有清理相关的 topics：

```typescript
// ❌ 原有代码（错误）
async deleteDistillation(id: number): Promise<void> {
  await this.delete(id);  // 只删除 distillations 记录
}
```

## 修复步骤

### 1. 清理服务器上的孤立数据

删除 aizhiruan 用户的孤立话题（distillation_id 指向已删除的蒸馏）：

```bash
# 删除"英国留学"相关的孤立话题
sudo -u postgres psql -d geo_system -c "DELETE FROM topics WHERE user_id = 1 AND distillation_id IN (52, 53);"
# 结果：DELETE 24
```

**验证**：
```bash
sudo -u postgres psql -d geo_system -c "SELECT keyword, COUNT(*) FROM topics WHERE user_id = 1 GROUP BY keyword ORDER BY keyword;"
```

结果显示"英国留学"已从话题列表中消失 ✅

### 2. 修改 Windows 端代码

**文件**：`windows-login-manager/electron/services/DistillationServicePostgres.ts`

**修改内容**：

```typescript
/**
 * 删除蒸馏（同时删除相关话题）
 */
async deleteDistillation(id: number): Promise<void> {
  this.validateUserId();

  try {
    // 先删除相关的话题
    await this.pool.query(
      'DELETE FROM topics WHERE distillation_id = $1 AND user_id = $2',
      [id, this.userId]
    );

    // 再删除蒸馏记录
    await this.delete(id);

    log.info(`DistillationService: 删除蒸馏及相关话题成功, ID: ${id}`);
  } catch (error) {
    log.error('DistillationService: deleteDistillation 失败:', error);
    throw error;
  }
}

/**
 * 批量删除蒸馏（同时删除相关话题）
 */
async deleteMany(ids: number[]): Promise<number> {
  this.validateUserId();

  try {
    if (ids.length === 0) return 0;

    // 先删除相关的话题
    const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
    await this.pool.query(
      `DELETE FROM topics WHERE distillation_id IN (${placeholders}) AND user_id = $1`,
      [this.userId, ...ids]
    );

    // 再批量删除蒸馏记录
    const count = await super.deleteMany(ids);

    log.info(`DistillationService: 批量删除蒸馏及相关话题成功, 删除 ${count} 条记录`);

    return count;
  } catch (error) {
    log.error('DistillationService: deleteMany 失败:', error);
    throw error;
  }
}
```

### 3. 编译代码

```bash
cd windows-login-manager
npm run build:electron
```

**验证编译结果**：
```bash
grep -n "删除相关的话题" dist-electron/services/DistillationServicePostgres.js
# 输出：
# 47:            // 先删除相关的话题
# 66:            // 先删除相关的话题
```

✅ 编译成功，修改已生效

## 修复效果

### 修复前

1. 删除蒸馏记录
2. topics 表中的 `distillation_id` 被设置为 NULL
3. 话题记录仍然存在
4. 筛选器中仍然显示已删除的关键词

### 修复后

1. 删除蒸馏记录
2. **先删除所有相关的话题记录**
3. 再删除蒸馏记录
4. 筛选器中不再显示已删除的关键词 ✅

## 数据验证

### 修复前的数据

```sql
-- distillations 表
id | keyword  | topic_count
52 | 英国留学 | 0
53 | 英国留学 | 0

-- topics 表（24 条记录）
id  | distillation_id | keyword
589 | 52              | 英国留学
590 | 52              | 英国留学
...
612 | 53              | 英国留学
```

### 修复后的数据

```sql
-- distillations 表
-- id=52 和 53 已删除

-- topics 表
-- 24 条"英国留学"话题已删除

-- 剩余话题
keyword         | count
如何蒸馏        | 12
应该留学        | 36
法国留学        | 24
法国留学哪里好  | 12
澳大利用留学    | 12
装修公司        | 24
装修装饰公司    | 12
```

## 技术要点

### 为什么不使用 ON DELETE CASCADE？

虽然可以修改外键约束为 `ON DELETE CASCADE`，但我们选择在应用层实现级联删除：

**优点**：
1. **更好的控制**：可以记录日志、触发事件
2. **更灵活**：可以添加额外的业务逻辑
3. **更安全**：避免意外的级联删除
4. **一致性**：与 GEO 系统的设计原则一致（应用层验证）

### 删除顺序

**必须先删除 topics，再删除 distillations**：

```typescript
// ✅ 正确顺序
await pool.query('DELETE FROM topics WHERE distillation_id = $1', [id]);
await pool.query('DELETE FROM distillations WHERE id = $1', [id]);

// ❌ 错误顺序（会导致外键约束错误）
await pool.query('DELETE FROM distillations WHERE id = $1', [id]);
await pool.query('DELETE FROM topics WHERE distillation_id = $1', [id]);
```

## 测试建议

### 测试场景 1：单个删除

1. 创建一个蒸馏记录
2. 生成一些话题
3. 删除蒸馏记录
4. 验证话题也被删除
5. 验证筛选器中不再显示该关键词

### 测试场景 2：批量删除

1. 创建多个蒸馏记录
2. 为每个蒸馏生成话题
3. 批量删除蒸馏记录
4. 验证所有相关话题都被删除
5. 验证筛选器中不再显示这些关键词

### 测试场景 3：数据隔离

1. 用户 A 创建蒸馏和话题
2. 用户 B 尝试删除用户 A 的蒸馏
3. 验证删除失败（权限检查）
4. 验证用户 A 的数据未受影响

## 相关文件

- `windows-login-manager/electron/services/DistillationServicePostgres.ts` - 蒸馏服务
- `windows-login-manager/electron/ipc/handlers/localDistillationHandlers.ts` - IPC 处理器
- `windows-login-manager/electron/services/BaseServicePostgres.ts` - 基础服务类

## 修复日期

2026-01-18

## 修复状态

✅ 已完成
- [x] 清理服务器孤立数据
- [x] 修改 Windows 端代码
- [x] 编译并验证
- [x] 创建修复文档

## 注意事项

1. **编译必须**：修改 Electron 主进程代码后必须重新编译
2. **测试验证**：建议在测试环境验证修复效果
3. **用户通知**：如果有其他用户遇到类似问题，需要手动清理孤立数据
