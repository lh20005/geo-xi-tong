# 批次发布按任务间隔修复

## 问题描述

用户需要的批次发布逻辑是：**每个任务之间都有固定间隔**。

### 用户需求示例

选择 **3篇文章** × **3个平台**，间隔 **10分钟**

**期望执行顺序：**
```
文章1 → 平台A
  ↓ 等待 10 分钟
文章1 → 平台B
  ↓ 等待 10 分钟
文章1 → 平台C
  ↓ 等待 10 分钟
文章2 → 平台A
  ↓ 等待 10 分钟
文章2 → 平台B
  ↓ 等待 10 分钟
文章2 → 平台C
  ↓ 等待 10 分钟
文章3 → 平台A
  ↓ 等待 10 分钟
文章3 → 平台B
  ↓ 等待 10 分钟
文章3 → 平台C
  ✅ 完成
```

**总耗时：** (9-1) × 10 = **80 分钟**

---

## 修复方案

修改前端批次任务创建逻辑，**每个任务都设置间隔**（除了最后一个任务）。

### 核心逻辑

```typescript
for (let i = 0; i < articleIds.length; i++) {
  const articleId = articleIds[i];
  
  for (let j = 0; j < accountIds.length; j++) {
    const accountId = accountIds[j];
    
    // 判断是否是最后一个任务
    const isLastTask = (i === articleIds.length - 1) && (j === accountIds.length - 1);
    
    // 除了最后一个任务，其他任务都设置间隔
    const intervalMinutes = isLastTask ? 0 : publishInterval;
    
    createTask({
      article_id: articleId,
      account_id: accountId,
      batch_order: batchOrder++,
      interval_minutes: intervalMinutes  // 关键：每个任务都有间隔
    });
  }
}
```

### 间隔设置规则

1. **所有任务**：`interval_minutes = publishInterval`（等待后执行下一个）
2. **最后一个任务**：`interval_minutes = 0`（不需要等待）

---

## 修改内容

### 文件：`client/src/pages/PublishingTasksPage.tsx`

#### 1. 修改时间计算逻辑

```typescript
// 计算总耗时：每个任务之间都等待（除了最后一个）
const totalWaitTimes = totalTasks - 1;  // 任务数 - 1
const totalMinutes = totalWaitTimes * publishInterval;
```

#### 2. 修改确认对话框提示

```typescript
⚠️ 发布逻辑：每个任务完成后，等待 {publishInterval} 分钟，再发布下一个任务
例如：文章1-平台A → 等待 → 文章1-平台B → 等待 → 文章1-平台C → 等待 → 文章2-平台A → ...
```

#### 3. 修改任务创建逻辑

```typescript
// 按文章 × 平台的顺序创建任务
for (let i = 0; i < articleIds.length; i++) {
  for (let j = 0; j < accountIds.length; j++) {
    // 判断是否是最后一个任务
    const isLastTask = (i === articleIds.length - 1) && (j === accountIds.length - 1);
    
    // 除了最后一个任务，其他任务都设置间隔
    const intervalMinutes = isLastTask ? 0 : publishInterval;
    
    createTask({
      interval_minutes: intervalMinutes
    });
  }
}
```

---

## 示例场景

### 场景1：3篇文章 × 2个平台，间隔5分钟

**任务顺序：**
```
1. 文章1 → 头条 (interval=5)  ← 等待5分钟
2. 文章1 → 抖音 (interval=5)  ← 等待5分钟
3. 文章2 → 头条 (interval=5)  ← 等待5分钟
4. 文章2 → 抖音 (interval=5)  ← 等待5分钟
5. 文章3 → 头条 (interval=5)  ← 等待5分钟
6. 文章3 → 抖音 (interval=0)  ← 立即完成（最后一个）
```

**总耗时：** (6-1) × 5 = **25 分钟**

---

### 场景2：2篇文章 × 3个平台，间隔10分钟

**任务顺序：**
```
1. 文章1 → 头条 (interval=10)   ← 等待10分钟
2. 文章1 → 抖音 (interval=10)   ← 等待10分钟
3. 文章1 → 小红书 (interval=10) ← 等待10分钟
4. 文章2 → 头条 (interval=10)   ← 等待10分钟
5. 文章2 → 抖音 (interval=10)   ← 等待10分钟
6. 文章2 → 小红书 (interval=0) ← 立即完成（最后一个）
```

**总耗时：** (6-1) × 10 = **50 分钟**

---

## 时间计算公式

```
总耗时 = (总任务数 - 1) × 间隔时间
总任务数 = 文章数 × 平台数
```

### 时间对比表

| 场景 | 总任务数 | 等待次数 | 总耗时 |
|------|---------|---------|--------|
| 2篇文章 × 2平台，间隔5分钟 | 4 | 3 | (4-1)×5 = **15分钟** |
| 3篇文章 × 2平台，间隔10分钟 | 6 | 5 | (6-1)×10 = **50分钟** |
| 3篇文章 × 3平台，间隔10分钟 | 9 | 8 | (9-1)×10 = **80分钟** |
| 5篇文章 × 3平台，间隔10分钟 | 15 | 14 | (15-1)×10 = **140分钟** |
| 10篇文章 × 4平台，间隔15分钟 | 40 | 39 | (40-1)×15 = **585分钟** |

---

## 预期效果

- ✅ 每个任务之间都有固定间隔
- ✅ 最后一个任务不需要等待
- ✅ 总耗时 = (总任务数 - 1) × 间隔时间
- ✅ 发布逻辑简单、直观
- ✅ 符合用户预期

---

## 后端兼容性

后端的 `BatchExecutor.ts` 已经支持这种逻辑：
- 读取每个任务的 `interval_minutes` 字段
- 如果为 0，立即执行下一个任务
- 如果大于 0，等待指定时间后执行下一个任务

**无需修改后端代码**，只需修改前端的任务创建逻辑。

---

## 部署步骤

1. 停止前端开发服务器（如果正在运行）
2. 拉取最新代码
3. 编译前端：`cd client && npm run build`
4. 重启前端服务
5. 测试批次发布功能

---

## 测试建议

### 测试用例1：基本功能
- 选择2篇文章
- 选择2个平台（头条、抖音）
- 设置间隔5分钟
- 验证执行顺序：
  - 文章1-头条 → 等待5分钟
  - 文章1-抖音 → 等待5分钟
  - 文章2-头条 → 等待5分钟
  - 文章2-抖音 → 完成

### 测试用例2：多平台
- 选择1篇文章
- 选择3个平台
- 设置间隔10分钟
- 验证：
  - 平台A → 等待10分钟
  - 平台B → 等待10分钟
  - 平台C → 完成

### 测试用例3：多文章
- 选择3篇文章
- 选择1个平台
- 设置间隔5分钟
- 验证：
  - 文章1 → 等待5分钟
  - 文章2 → 等待5分钟
  - 文章3 → 完成

---

## 相关文件

- `client/src/pages/PublishingTasksPage.tsx` - 前端任务创建页面（已修复）
- `server/src/services/BatchExecutor.ts` - 后端批次执行器（无需修改）

---

## 注意事项

1. 这个修改只影响**批次发布**功能
2. 单个任务发布不受影响
3. 定时发布功能不受影响
4. 向后兼容，不影响已创建的批次任务

