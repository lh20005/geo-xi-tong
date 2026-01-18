# 蒸馏结果筛选功能修复

## 问题描述

用户报告了两个蒸馏结果页面的筛选问题：

1. **筛选框显示无数据的关键词**：虽然筛选框中有很多关键词选项，但实际上这些关键词下没有任何话题数据
2. **删除话题后筛选框仍显示该关键词**：删除某个关键词的所有话题后，筛选框中仍然显示该关键词

## 根本原因

### 数据库状态分析

```sql
-- 检查 distillations 和 topics 的关系
SELECT d.id, d.keyword, d.topic_count, COUNT(t.id) as actual_topics 
FROM distillations d 
LEFT JOIN topics t ON d.id = t.distillation_id 
WHERE d.user_id = 1 
GROUP BY d.id;

-- 结果显示：
-- 12 个 distillations 记录，topic_count = 12
-- 但 actual_topics = 0（没有实际的 topics 数据）
```

### 问题原因

1. **筛选框数据源错误**：
   - 筛选框从 `distillations` 表获取关键词列表
   - 但实际话题数据在 `topics` 表中
   - 两个表之间存在数据不一致

2. **删除逻辑不完整**：
   - 删除话题时只删除 `topics` 表的记录
   - 没有清理对应的 `distillations` 记录
   - 导致孤立的 distillations 记录残留

## 修复方案

### 1. 修改筛选框数据源

**文件**: `windows-login-manager/electron/ipc/handlers/localDistillationHandlers.ts`

**修改**: `distillation:local:getKeywords` 方法

```typescript
// 修改前：从 distillations 表获取所有关键词
const query = `
  SELECT DISTINCT keyword
  FROM distillations
  WHERE user_id = $1
  ORDER BY keyword ASC
`;

// 修改后：只返回有话题的关键词
const query = `
  SELECT DISTINCT d.keyword
  FROM distillations d
  INNER JOIN topics t ON d.id = t.distillation_id
  WHERE d.user_id = $1
  ORDER BY d.keyword ASC
`;
```

### 2. 修改删除逻辑

**文件**: `windows-login-manager/electron/ipc/handlers/localDistillationHandlers.ts`

**修改**: `distillation:local:deleteTopicsByKeyword` 方法

```typescript
// 使用事务确保数据一致性
const client = await pool.connect();
try {
  await client.query('BEGIN');

  // 1. 删除话题
  const deleteTopicsQuery = `
    DELETE FROM topics t
    USING distillations d
    WHERE t.distillation_id = d.id
      AND d.keyword = $1
      AND t.user_id = $2
    RETURNING t.id
  `;
  const deleteResult = await client.query(deleteTopicsQuery, [keyword, user.id]);

  // 2. 删除没有话题的 distillations 记录
  const deleteDistillationsQuery = `
    DELETE FROM distillations d
    WHERE d.keyword = $1
      AND d.user_id = $2
      AND NOT EXISTS (
        SELECT 1 FROM topics t WHERE t.distillation_id = d.id
      )
    RETURNING d.id
  `;
  const distillationResult = await client.query(deleteDistillationsQuery, [keyword, user.id]);

  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

## 修复步骤

### 1. 修改代码

✅ 已完成：修改 `localDistillationHandlers.ts` 中的两个方法

### 2. 编译代码

```bash
cd windows-login-manager
npm run build:electron
```

✅ 编译成功，验证结果：
```bash
grep -n "只返回有话题的关键词" dist-electron/ipc/handlers/localDistillationHandlers.js
# 316:    // 获取所有唯一关键词列表（只返回有话题的关键词）

grep -n "同时清理空的 distillations 记录" dist-electron/ipc/handlers/localDistillationHandlers.js
# 381:    // 按关键词删除所有话题（同时清理空的 distillations 记录）
```

### 3. 清理现有数据库

清理孤立的 distillations 记录：

```sql
DELETE FROM distillations 
WHERE id IN (
  SELECT d.id 
  FROM distillations d 
  LEFT JOIN topics t ON d.id = t.distillation_id 
  WHERE t.id IS NULL
) 
RETURNING id, keyword;

-- 删除了 12 条孤立记录
```

验证清理结果：

```sql
SELECT d.id, d.keyword, d.topic_count, COUNT(t.id) as actual_topics 
FROM distillations d 
LEFT JOIN topics t ON d.id = t.distillation_id 
WHERE d.user_id = 1 
GROUP BY d.id;

-- 结果：只剩 1 条有话题的记录
-- id | keyword  | topic_count | actual_topics 
-- 31 | 测试话题 |          12 |            12
```

## 测试验证

### 测试场景 1：筛选框只显示有话题的关键词

1. 打开蒸馏结果页面
2. 点击"按关键词筛选"下拉框
3. **预期结果**：只显示有话题的关键词（如"测试话题"）
4. **不应显示**：没有话题的关键词

### 测试场景 2：删除话题后自动清理关键词

1. 在筛选框中选择某个关键词
2. 点击"删除该关键词下的所有话题"
3. **预期结果**：
   - 话题被删除
   - 对应的 distillations 记录也被删除
   - 筛选框中不再显示该关键词

### 测试场景 3：新蒸馏流程

1. 执行关键词蒸馏
2. 检查数据库：
   - `distillations` 表应该有新记录
   - `topics` 表应该有对应的话题记录
3. 在蒸馏结果页面应该能看到新话题
4. 筛选框应该显示新关键词

## 下一步检查

用户报告"关键词蒸馏后，无法在蒸馏结果页面显示"，需要检查：

1. **数据库连接**：确认 Windows 端是否正确连接到本地 PostgreSQL
2. **数据同步**：确认蒸馏后服务器返回的话题是否正确保存到本地数据库

让我检查蒸馏流程的数据保存逻辑...

## 相关文件

- `windows-login-manager/electron/ipc/handlers/localDistillationHandlers.ts` - 蒸馏 IPC 处理器
- `windows-login-manager/src/pages/DistillationPage.tsx` - 蒸馏页面
- `windows-login-manager/src/pages/DistillationResultsPage.tsx` - 蒸馏结果页面
- `windows-login-manager/src/api/localDistillationResultsApi.ts` - 本地蒸馏结果 API

## 修复状态

- [x] 修改代码（筛选功能）
- [x] 编译代码
- [x] 验证编译结果
- [x] 清理数据库（孤立记录）
- [x] 创建诊断文档
- [ ] 用户测试筛选功能
- [ ] 用户测试蒸馏流程

## 用户操作指南

### 步骤 1：重启应用

确保使用最新编译的代码：
1. 完全退出 Windows 管理器应用
2. 重新启动应用

### 步骤 2：测试筛选功能

1. 打开"蒸馏结果"页面
2. 点击"按关键词筛选"下拉框
3. **验证**：只应该显示有话题的关键词（如"测试话题"）
4. 选择一个关键词，点击"删除该关键词下的所有话题"
5. **验证**：删除后，该关键词应该从筛选框中消失

### 步骤 3：测试蒸馏流程

1. 打开"关键词蒸馏"页面
2. 输入一个新关键词（如"测试蒸馏2"）
3. 点击"开始蒸馏"
4. **打开开发者工具（F12）**，查看 Console 日志
5. **验证日志**：应该看到类似以下的日志：
   ```
   [蒸馏] 开始调用服务器 API
   [蒸馏] 服务器返回话题数量: 12
   [蒸馏] 开始保存蒸馏记录
   [蒸馏] 蒸馏记录已保存, ID: 32
   [蒸馏] 开始保存话题，数量: 12
   [蒸馏] 保存话题 1/12: ...
   [蒸馏] 话题 1 保存结果: { success: true, ... }
   ...
   [蒸馏] 所有话题保存完成
   ```
6. 自动跳转到"蒸馏结果"页面
7. **验证**：应该能看到新生成的话题

### 步骤 4：如果蒸馏后无法显示

请参考 `DISTILLATION_SAVE_DIAGNOSIS.md` 文档进行诊断：

1. 检查数据库连接
2. 检查蒸馏流程日志
3. 检查数据库数据
4. 检查用户登录状态

## 技术细节

### 修复 1：筛选框只显示有话题的关键词

**修改文件**：`windows-login-manager/electron/ipc/handlers/localDistillationHandlers.ts`

**修改内容**：
```typescript
// 修改前：从 distillations 表获取所有关键词
SELECT DISTINCT keyword FROM distillations WHERE user_id = $1

// 修改后：只返回有话题的关键词（使用 INNER JOIN）
SELECT DISTINCT d.keyword
FROM distillations d
INNER JOIN topics t ON d.id = t.distillation_id
WHERE d.user_id = $1
```

### 修复 2：删除话题时同时清理 distillations 记录

**修改文件**：`windows-login-manager/electron/ipc/handlers/localDistillationHandlers.ts`

**修改内容**：使用事务确保数据一致性
```typescript
// 1. 删除话题
DELETE FROM topics t
USING distillations d
WHERE t.distillation_id = d.id
  AND d.keyword = $1
  AND t.user_id = $2

// 2. 删除没有话题的 distillations 记录
DELETE FROM distillations d
WHERE d.keyword = $1
  AND d.user_id = $2
  AND NOT EXISTS (
    SELECT 1 FROM topics t WHERE t.distillation_id = d.id
  )
```

### 数据库清理

已清理 12 条孤立的 distillations 记录（有 topic_count 但没有实际 topics）。

## 相关文档

- `DISTILLATION_SAVE_DIAGNOSIS.md` - 蒸馏结果无法显示的诊断指南
- `DISTILLATION_TOPIC_SAVE_COMPLETE.md` - 之前的话题保存修复文档
- `DISTILLATION_LOCAL_DB_COMPLETE.md` - 本地数据库迁移文档
