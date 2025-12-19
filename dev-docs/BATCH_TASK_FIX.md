# 批次任务和状态刷新修复

## 修复日期
2024-12-19

## 问题描述

### 问题1：批次任务第二条总是头条号Cookie登录失败
**现象**：
- 批次任务的第一条可以正常发布
- 第二条任务总是在"头条号 Cookie登录失败"这个步骤失败
- 第三条及后续任务也会失败

**根本原因**：
1. 浏览器实例在第一个任务完成后10秒自动关闭
2. 批次任务之间有间隔时间（默认5分钟）
3. 当第二个任务开始时（5分钟后），浏览器已经关闭
4. 第二个任务尝试使用已关闭的浏览器实例，导致Cookie登录失败

**代码位置**：
- `server/src/services/PublishingExecutor.ts` - `closeBrowserAsync` 方法

### 问题2：任务状态需要手动刷新页面才能看到更新
**现象**：
- 任务状态变化后，前端页面不会自动更新
- 需要手动点击刷新按钮或刷新整个页面才能看到最新状态

**根本原因**：
- 前端没有实现自动轮询机制
- 虽然后端有LogBroadcaster用于实时推送日志，但前端没有定时刷新任务列表

**代码位置**：
- `client/src/pages/PublishingTasksPage.tsx` - 缺少自动刷新逻辑

## 解决方案

### 修复1：每个任务使用独立浏览器实例

**修改文件**：`server/src/services/PublishingExecutor.ts`

**修改内容**：
```typescript
// 修改前：延迟10秒关闭浏览器
await new Promise(resolve => setTimeout(resolve, 10000));
await browserAutomationService.closeBrowser();

// 修改后：立即关闭浏览器
await browserAutomationService.closeBrowser();
```

**原理**：
- 每个任务完成后立即关闭浏览器
- 下一个任务启动时会创建新的浏览器实例
- 避免浏览器实例在任务之间共享，消除Cookie冲突

**优点**：
- 每个任务都有干净的浏览器环境
- 避免Cookie过期或冲突
- 更稳定可靠

**缺点**：
- 每个任务都需要重新启动浏览器（增加约2-3秒）
- 但对于批次任务（间隔5分钟），这个开销可以忽略

### 修复2：添加自动刷新机制

**修改文件**：`client/src/pages/PublishingTasksPage.tsx`

**修改内容**：
```typescript
// 添加自动刷新任务列表（每5秒刷新一次）
useEffect(() => {
  const intervalId = setInterval(() => {
    // 只在有任务时自动刷新
    if (tasks.length > 0) {
      const hasRunningTasks = tasks.some(t => t.status === 'running' || t.status === 'pending');
      if (hasRunningTasks) {
        console.log('🔄 自动刷新任务列表...');
        loadTasks();
      }
    }
  }, 5000); // 每5秒刷新一次

  return () => clearInterval(intervalId);
}, [tasks]);
```

**原理**：
- 使用`setInterval`每5秒检查一次
- 只在有运行中或待处理的任务时才刷新
- 避免不必要的API请求

**优点**：
- 用户无需手动刷新
- 实时看到任务状态变化
- 性能开销小（只在必要时刷新）

## 测试步骤

### 测试1：批次任务Cookie登录

1. 创建一个批次任务，包含3篇文章
2. 设置间隔时间为1分钟（测试用）
3. 观察任务执行情况：
   - 第一条任务应该成功
   - 第二条任务应该成功（不再Cookie登录失败）
   - 第三条任务应该成功

**预期结果**：
- 所有任务都应该成功
- 每个任务都使用独立的浏览器实例
- 日志中应该看到每个任务都有"浏览器启动成功"和"浏览器已关闭"

### 测试2：自动刷新状态

1. 创建一个发布任务
2. 不要手动刷新页面
3. 观察任务状态变化：
   - 任务状态应该自动从"等待中"变为"执行中"
   - 任务状态应该自动从"执行中"变为"成功"或"失败"

**预期结果**：
- 任务状态应该每5秒自动更新
- 无需手动刷新页面
- 浏览器控制台应该看到"🔄 自动刷新任务列表..."日志

## 性能影响

### 浏览器启动开销
- 每个任务增加约2-3秒的浏览器启动时间
- 对于批次任务（间隔5分钟），这个开销可以忽略
- 对于单个任务，影响也很小

### 前端刷新开销
- 每5秒一次API请求
- 只在有运行中任务时才刷新
- 对服务器压力很小

## 后续优化建议

### 1. WebSocket实时推送（可选）
- 使用WebSocket替代轮询
- 更实时，更节省资源
- 需要后端支持WebSocket

### 2. 浏览器实例池（可选）
- 维护一个浏览器实例池
- 任务从池中获取浏览器
- 任务完成后归还到池中
- 可以减少浏览器启动开销

### 3. 智能刷新间隔（可选）
- 根据任务状态动态调整刷新间隔
- 运行中任务：每3秒刷新
- 等待中任务：每10秒刷新
- 无活动任务：停止刷新

## 相关文件

- `server/src/services/PublishingExecutor.ts` - 发布执行器
- `server/src/services/BatchExecutor.ts` - 批次执行器
- `client/src/pages/PublishingTasksPage.tsx` - 发布任务页面
- `.kiro/specs/publishing-task-reliability/` - 发布任务可靠性规范

## 注意事项

1. **浏览器资源**：每个任务都会启动新的浏览器，确保服务器有足够的内存
2. **Cookie有效期**：确保账号Cookie有效期足够长
3. **网络稳定性**：批次任务执行时间较长，确保网络稳定
4. **日志监控**：观察日志中的浏览器启动和关闭信息

## 回滚方案

如果修复导致问题，可以回滚到之前的版本：

```bash
# 回滚PublishingExecutor.ts
git checkout HEAD~1 server/src/services/PublishingExecutor.ts

# 回滚PublishingTasksPage.tsx
git checkout HEAD~1 client/src/pages/PublishingTasksPage.tsx
```
