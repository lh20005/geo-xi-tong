# 批次发布最终逻辑说明

## 用户需求

**每个任务之间都有固定间隔**

### 示例

选择 **3篇文章** × **3个平台**，间隔 **10分钟**

```
任务1: 文章1 → 平台A
  ↓ 等待 10 分钟
任务2: 文章1 → 平台B
  ↓ 等待 10 分钟
任务3: 文章1 → 平台C
  ↓ 等待 10 分钟
任务4: 文章2 → 平台A
  ↓ 等待 10 分钟
任务5: 文章2 → 平台B
  ↓ 等待 10 分钟
任务6: 文章2 → 平台C
  ↓ 等待 10 分钟
任务7: 文章3 → 平台A
  ↓ 等待 10 分钟
任务8: 文章3 → 平台B
  ↓ 等待 10 分钟
任务9: 文章3 → 平台C
  ✅ 完成
```

**总耗时：** (9-1) × 10 = **80 分钟**

---

## 实现逻辑

### 任务创建顺序

```typescript
// 外层循环：文章
for (let i = 0; i < articleIds.length; i++) {
  const articleId = articleIds[i];
  
  // 内层循环：平台
  for (let j = 0; j < accountIds.length; j++) {
    const accountId = accountIds[j];
    
    // 判断是否是最后一个任务
    const isLastTask = (i === articleIds.length - 1) && (j === accountIds.length - 1);
    
    // 除了最后一个任务，其他任务都设置间隔
    const intervalMinutes = isLastTask ? 0 : publishInterval;
    
    // 创建任务
    createTask({
      article_id: articleId,
      account_id: accountId,
      batch_order: batchOrder++,
      interval_minutes: intervalMinutes
    });
  }
}
```

### interval_minutes 设置规则

| 任务 | 条件 | interval_minutes | 说明 |
|------|------|------------------|------|
| 任务1-8 | 不是最后一个任务 | publishInterval | 等待指定时间 |
| 任务9 | 最后一个任务 | 0 | 不需要等待 |

---

## 时间计算

### 公式

```
总耗时 = (总任务数 - 1) × 间隔时间
总任务数 = 文章数 × 平台数
```

### 示例计算

| 文章数 | 平台数 | 间隔(分钟) | 总任务数 | 等待次数 | 总耗时 |
|--------|--------|-----------|---------|---------|--------|
| 2 | 2 | 5 | 4 | 3 | 15分钟 |
| 3 | 2 | 10 | 6 | 5 | 50分钟 |
| 3 | 3 | 10 | 9 | 8 | 80分钟 |
| 5 | 3 | 10 | 15 | 14 | 140分钟 |
| 10 | 4 | 15 | 40 | 39 | 585分钟 |

---

## 用户界面

### 确认对话框

```
确认创建发布任务

将为 3 篇文章创建 9 个发布任务
发布间隔：10 分钟
预计完成时间：约 1小时20分钟

⚠️ 发布逻辑：每个任务完成后，等待 10 分钟，再发布下一个任务
例如：文章1-平台A → 等待 → 文章1-平台B → 等待 → 文章1-平台C → 等待 → 文章2-平台A → ...

[取消] [确定]
```

---

## 数据库结构

### publishing_tasks 表

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| id | int | 任务ID | 1, 2, 3... |
| article_id | int | 文章ID | 101, 101, 101, 102... |
| account_id | int | 账号ID | 1, 2, 3, 1... |
| batch_id | string | 批次ID | batch_1234567890_abc |
| batch_order | int | 批次顺序 | 0, 1, 2, 3... |
| interval_minutes | int | 间隔时间 | 10, 10, 10, 10, 10, 10, 10, 10, 0 |
| status | string | 任务状态 | pending, running, success... |

### 示例数据

```sql
-- 3篇文章 × 3个平台，间隔10分钟
INSERT INTO publishing_tasks VALUES
(1, 101, 1, 'batch_xxx', 0, 10, 'pending'),  -- 文章1-平台A
(2, 101, 2, 'batch_xxx', 1, 10, 'pending'),  -- 文章1-平台B
(3, 101, 3, 'batch_xxx', 2, 10, 'pending'),  -- 文章1-平台C
(4, 102, 1, 'batch_xxx', 3, 10, 'pending'),  -- 文章2-平台A
(5, 102, 2, 'batch_xxx', 4, 10, 'pending'),  -- 文章2-平台B
(6, 102, 3, 'batch_xxx', 5, 10, 'pending'),  -- 文章2-平台C
(7, 103, 1, 'batch_xxx', 6, 10, 'pending'),  -- 文章3-平台A
(8, 103, 2, 'batch_xxx', 7, 10, 'pending'),  -- 文章3-平台B
(9, 103, 3, 'batch_xxx', 8, 0,  'pending');  -- 文章3-平台C (最后一个)
```

---

## 执行流程

### BatchExecutor 执行逻辑

```typescript
// 1. 获取批次中的所有任务（按 batch_order 排序）
const tasks = await getBatchTasks(batchId);

// 2. 按顺序执行每个任务
for (let i = 0; i < tasks.length; i++) {
  const task = tasks[i];
  
  // 执行任务
  await executeTask(task.id);
  
  // 如果不是最后一个任务，等待间隔时间
  if (i < tasks.length - 1) {
    const intervalMinutes = task.interval_minutes || 0;
    
    if (intervalMinutes > 0) {
      console.log(`⏳ 等待 ${intervalMinutes} 分钟后执行下一个任务`);
      await waitWithStopCheck(batchId, intervalMinutes);
    }
  }
}
```

### 日志输出示例

```
🚀 开始执行批次 batch_xxx
📋 批次 batch_xxx 共有 9 个任务

📝 [批次 batch_xxx] 执行第 1/9 个任务 #1
   文章ID: 101, 平台: toutiao
✅ [批次 batch_xxx] 任务 #1 执行成功

⏸️  [批次 batch_xxx] 任务 1 完成，准备等待间隔...
⏳ 使用固定间隔: 10 分钟（从任务完成时间计算）
⏳ 等待 10 分钟后执行下一个任务...
✅ [批次 batch_xxx] 间隔等待完成，准备执行下一个任务

📝 [批次 batch_xxx] 执行第 2/9 个任务 #2
   文章ID: 101, 平台: douyin
✅ [批次 batch_xxx] 任务 #2 执行成功

⏸️  [批次 batch_xxx] 任务 2 完成，准备等待间隔...
⏳ 使用固定间隔: 10 分钟（从任务完成时间计算）
...

📝 [批次 batch_xxx] 执行第 9/9 个任务 #9
   文章ID: 103, 平台: xiaohongshu
✅ [批次 batch_xxx] 任务 #9 执行成功

🎉 批次 batch_xxx 执行完成！
```

---

## 优势

1. **逻辑简单**
   - 每个任务之间都有固定间隔
   - 容易理解和预测

2. **时间可控**
   - 总耗时 = (任务数 - 1) × 间隔时间
   - 精确计算完成时间

3. **灵活性高**
   - 可以自由调整间隔时间
   - 适用于各种发布场景

4. **用户友好**
   - 符合用户的直觉预期
   - 清晰的提示和说明

---

## 测试验证

### 测试步骤

1. 选择3篇文章
2. 选择3个平台（头条、抖音、小红书）
3. 设置间隔10分钟
4. 点击创建任务

### 验证点

- ✅ 确认对话框显示正确的任务数和耗时
- ✅ 任务按照正确的顺序创建
- ✅ 每个任务的 `interval_minutes` 设置正确
- ✅ 最后一个任务的 `interval_minutes` 为 0
- ✅ 任务按顺序执行，每个任务之间等待10分钟
- ✅ 总耗时约为 80 分钟

---

## 总结

这个批次发布逻辑实现了：
- ✅ 每个任务之间都有固定间隔
- ✅ 最后一个任务不需要等待
- ✅ 总耗时可精确计算
- ✅ 符合用户预期
- ✅ 代码简洁清晰
