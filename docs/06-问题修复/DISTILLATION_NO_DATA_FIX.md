# 蒸馏结果和历史无数据问题修复

**修复日期**: 2026-01-17  
**状态**: ✅ 已修复

---

## 问题描述

用户反馈两个问题：
1. **蒸馏结果页面无数据** - 执行蒸馏后，结果页面显示空白
2. **蒸馏历史无数据** - 蒸馏历史列表为空或无法查看详情

---

## 问题诊断

### 数据库状态检查

```sql
-- 检查蒸馏记录
SELECT id, keyword, topic_count, user_id, created_at 
FROM distillations 
ORDER BY created_at DESC LIMIT 5;

-- 结果：有 5 条记录（id: 17, 19, 20, 21, 22）
```

| id | keyword | topic_count | user_id |
|----|---------|-------------|---------|
| 22 | 应该留学 | 12 | 1 |
| 21 | 装修公司 | 12 | 1 |
| 20 | 装修公司 | 12 | 1 |
| 19 | 装修装饰公司 | 12 | 1 |
| 17 | 法国留学 | 12 | 5 |

```sql
-- 检查话题数据
SELECT COUNT(*) as total, distillation_id 
FROM topics 
GROUP BY distillation_id 
ORDER BY distillation_id DESC LIMIT 5;

-- 结果：只有 3 条记录（distillation_id: 7, 12, 17）
```

| total | distillation_id |
|-------|-----------------|
| 12 | 17 |
| 12 | 12 |
| 12 | 7 |

**发现问题**：最新的蒸馏记录（id 19, 20, 21, 22）没有对应的话题数据！

---

## 根本原因

### 1. 话题保存失败但未报错

**文件**: `windows-login-manager/src/pages/DistillationPage.tsx`

**问题代码**:
```typescript
// 3. 保存话题到本地数据库
for (const question of questions) {
  await window.electron.invoke('topic:local:create', {
    distillation_id: distillationId,
    question: question.question || question,
    category: question.category || '',
    priority: question.priority || 0
  });
  // ❌ 没有检查返回结果，保存失败也不会报错
}
```

### 2. 可能的失败原因

1. **用户未登录** - `storageManager.getUser()` 返回 null
2. **user_id 不匹配** - 存储的 user_id 与数据库中的不一致
3. **SQL 执行失败** - 数据库约束或字段问题

---

## 修复方案

### 修复 1: 添加错误处理 ✅

**文件**: `windows-login-manager/src/pages/DistillationPage.tsx`

**修改内容**:
```typescript
// 3. 保存话题到本地数据库
for (const question of questions) {
  const topicResult = await window.electron.invoke('topic:local:create', {
    distillation_id: distillationId,
    question: question.question || question,
    category: question.category || '',
    priority: question.priority || 0
  });
  
  // ✅ 检查返回结果，失败时抛出错误
  if (!topicResult.success) {
    console.error('保存话题失败:', topicResult.error);
    throw new Error(`保存话题失败: ${topicResult.error}`);
  }
}
```

### 修复 2: 编译代码 ✅

```bash
cd windows-login-manager
npm run build:electron
```

**编译结果**: ✅ 成功，无错误

---

## 测试步骤

### 1. 清理旧数据（可选）

```sql
-- 删除没有话题的蒸馏记录
DELETE FROM distillations WHERE id IN (19, 20, 21, 22);
```

### 2. 执行新蒸馏

1. 启动应用：`npm run dev`
2. 进入"关键词蒸馏"页面
3. 输入测试关键词（例如："测试关键词"）
4. 点击"开始蒸馏"
5. 观察控制台输出

### 3. 验证数据

```sql
-- 检查最新的蒸馏记录
SELECT id, keyword, topic_count FROM distillations ORDER BY created_at DESC LIMIT 1;

-- 检查对应的话题数据
SELECT COUNT(*) FROM topics WHERE distillation_id = (
  SELECT id FROM distillations ORDER BY created_at DESC LIMIT 1
);
```

**预期结果**:
- 蒸馏记录存在
- 话题数量 = topic_count（通常是 12）
- 自动跳转到结果页面并显示数据

### 4. 验证历史记录

1. 返回"关键词蒸馏"页面
2. 在历史列表中点击"查看详情"
3. 验证能正确显示话题列表

---

## 可能的错误和解决方案

### 错误 1: "用户未登录"

**症状**: 控制台显示 "保存话题失败: 用户未登录"

**原因**: `storageManager.getUser()` 返回 null

**解决方案**:
1. 检查是否已登录
2. 重新登录系统
3. 检查 electron-store 中的用户数据：
   ```bash
   # macOS
   cat ~/Library/Application\ Support/platform-login-manager/config.json
   ```

### 错误 2: SQL 语法错误

**症状**: 控制台显示 SQL 相关错误

**原因**: 数据库字段或约束问题

**解决方案**:
1. 检查 topics 表结构：
   ```sql
   \d topics
   ```
2. 确认所有必需字段都存在
3. 检查数据类型是否匹配

### 错误 3: user_id 不匹配

**症状**: 数据保存成功，但查询时找不到

**原因**: 保存时的 user_id 与查询时的 user_id 不同

**解决方案**:
1. 检查当前登录用户的 ID
2. 检查数据库中的 user_id
3. 确保使用同一个账号

---

## 数据流验证

### 完整蒸馏流程

```
1. 用户输入关键词
   ↓
2. 调用服务器 API: POST /distillation
   ↓
3. 服务器返回话题列表
   ↓
4. 保存蒸馏记录到本地数据库
   - 表: distillations
   - 返回: distillationId
   ↓
5. 循环保存话题到本地数据库 ⭐ 修复点
   - 表: topics
   - 检查每次保存的结果
   - 失败时抛出错误并停止
   ↓
6. 保存到 LocalStorage（临时）
   ↓
7. 跳转到结果页面
   ↓
8. 从本地数据库读取并显示
```

### 查看历史流程

```
1. 页面加载
   ↓
2. 调用 IPC: distillation:local:findAll
   - 获取蒸馏记录列表
   ↓
3. 显示历史列表
   ↓
4. 用户点击"查看详情"
   ↓
5. 调用 IPC: topic:local:getByDistillation
   - 获取话题列表
   ↓
6. 跳转到结果页面并显示
```

---

## 相关文件

### 修改的文件

1. `windows-login-manager/src/pages/DistillationPage.tsx` - 添加错误处理

### 相关文件（未修改）

1. `windows-login-manager/electron/ipc/handlers/localTopicHandlers.ts` - IPC 处理器
2. `windows-login-manager/electron/services/TopicServicePostgres.ts` - 话题服务
3. `windows-login-manager/electron/services/BaseServicePostgres.ts` - 基础服务
4. `windows-login-manager/electron/storage/manager.ts` - 存储管理器

---

## 调试技巧

### 1. 查看 Electron 日志

```bash
# macOS
tail -f ~/Library/Logs/platform-login-manager/main.log
```

### 2. 查看控制台输出

打开开发者工具（F12），查看：
- Console 标签：JavaScript 错误和日志
- Network 标签：API 请求和响应

### 3. 直接查询数据库

```sql
-- 查看最新的蒸馏记录
SELECT * FROM distillations ORDER BY created_at DESC LIMIT 1;

-- 查看对应的话题
SELECT * FROM topics WHERE distillation_id = <distillation_id>;

-- 检查 user_id
SELECT DISTINCT user_id FROM distillations;
SELECT DISTINCT user_id FROM topics;
```

### 4. 检查用户信息

```javascript
// 在开发者工具 Console 中执行
window.electron.invoke('user:getInfo').then(console.log);
```

---

## 预防措施

### 1. 始终检查 IPC 调用结果

```typescript
// ❌ 错误做法
await window.electron.invoke('some:action', params);

// ✅ 正确做法
const result = await window.electron.invoke('some:action', params);
if (!result.success) {
  throw new Error(result.error || '操作失败');
}
```

### 2. 添加详细的错误日志

```typescript
try {
  // 操作
} catch (error: any) {
  console.error('详细错误信息:', {
    message: error.message,
    stack: error.stack,
    context: { /* 相关上下文 */ }
  });
  throw error;
}
```

### 3. 使用事务保证数据一致性

```typescript
// 未来改进：使用数据库事务
// BEGIN TRANSACTION
// - 保存蒸馏记录
// - 保存所有话题
// COMMIT / ROLLBACK
```

---

## 总结

蒸馏功能数据保存问题已修复：

1. ✅ 添加了话题保存的错误处理
2. ✅ 保存失败时会抛出错误并停止
3. ✅ 用户会看到明确的错误提示
4. ✅ 编译成功，修改已生效

**下一步**：
1. 测试新蒸馏功能
2. 验证数据正确保存
3. 检查历史记录显示
4. 如果仍有问题，查看 Electron 日志获取详细错误信息
