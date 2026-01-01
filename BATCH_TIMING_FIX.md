# 批次定时发布时间计算修复

## 问题描述

定时发布时，没有按照定时时间发布。第一个任务发布完后，应该按照**第二个任务的定时时间**等待，而不是按照**批次开始的时间**计算。

### 错误行为
- 第一个任务在 16:00 完成
- 第二个任务定时时间是 17:00
- **错误**：立即执行第二个任务（因为从批次开始时间 15:00 计算，已经过了1小时）
- **正确**：应该等待到 17:00 再执行第二个任务

## 根本原因

在 `server/src/services/BatchExecutor.ts` 第 229 行，代码使用的是**当前任务的 `interval_minutes`**，而不是**下一个任务的 `scheduled_at`**。

```typescript
// 错误的代码
const intervalMinutes = task.interval_minutes || 0;  // 使用当前任务的间隔
```

这导致：
1. 如果使用固定间隔（`interval_minutes`），时间计算是正确的
2. 但如果使用定时发布（`scheduled_at`），时间计算是错误的

## 修复方案

修改 `BatchExecutor.ts` 的等待逻辑：

1. **优先使用下一个任务的定时时间**（`scheduled_at`）
2. 计算**当前时间**到**下一个任务定时时间**的差值
3. 等待这个差值的时间
4. 如果没有定时时间，才使用固定间隔（`interval_minutes`）

### 修复后的代码逻辑

```typescript
// 如果不是最后一个任务，等待间隔时间
if (i < tasks.length - 1) {
  const nextTask = tasks[i + 1];  // 获取下一个任务
  
  // 优先使用下一个任务的定时时间（scheduled_at）
  if (nextTask.scheduled_at) {
    const now = Date.now();
    const scheduledTime = new Date(nextTask.scheduled_at).getTime();
    const waitMs = scheduledTime - now;
    
    if (waitMs > 0) {
      const waitMinutes = Math.ceil(waitMs / 60000);
      console.log(`⏰ 下一个任务定时发布时间: ${new Date(nextTask.scheduled_at).toLocaleString('zh-CN')}`);
      console.log(`⏳ 需要等待 ${waitMinutes} 分钟（从任务完成时间计算）`);
      await this.waitWithStopCheck(batchId, waitMinutes);
    } else {
      console.log(`⏭️  下一个任务的定时时间已到，立即执行\n`);
    }
  } else {
    // 如果没有定时时间，使用 interval_minutes
    const intervalMinutes = task.interval_minutes || 0;
    
    if (intervalMinutes > 0) {
      console.log(`⏳ 使用固定间隔: ${intervalMinutes} 分钟（从任务完成时间计算）`);
      await this.waitWithStopCheck(batchId, intervalMinutes);
    }
  }
}
```

## 测试验证

### 场景1：使用定时发布时间
1. 创建2个任务：
   - 任务1：立即发布
   - 任务2：定时 17:00 发布
2. 任务1在 16:30 完成
3. **预期**：等待30分钟，在 17:00 执行任务2
4. **日志**：
   ```
   ⏰ 下一个任务定时发布时间: 2025/12/30 17:00:00
   ⏳ 需要等待 30 分钟（从任务完成时间计算）
   ```

### 场景2：使用固定间隔
1. 创建2个任务，间隔10分钟
2. 任务1在 16:30 完成
3. **预期**：等待10分钟，在 16:40 执行任务2
4. **日志**：
   ```
   ⏳ 使用固定间隔: 10 分钟（从任务完成时间计算）
   ```

## 影响范围

- ✅ 修复了定时发布的时间计算错误
- ✅ 保持了固定间隔的功能不变
- ✅ 增加了详细的日志输出，便于调试
- ✅ 不影响其他功能

## 部署步骤

1. 停止服务器
2. 拉取最新代码
3. 编译：`cd server && npm run build`
4. 启动服务器
5. 测试批次定时发布功能

## 相关文件

- `server/src/services/BatchExecutor.ts` - 批次执行器（已修复）
- `server/src/services/PublishingService.ts` - 发布服务
- `client/src/pages/PublishingTasksPage.tsx` - 前端任务创建页面
