# Design Document

## Overview

本设计文档描述了批次任务串行执行和超时控制系统的实现方案。当前系统存在严重的并发控制问题：批次任务没有正确串行执行，导致多个任务同时运行；任务可能无限期卡住，阻塞整个批次；间隔时间没有被正确执行。

本设计通过以下核心机制解决这些问题：
1. **任务执行超时机制** - 使用Promise.race实现超时控制，防止任务无限期卡住
2. **批次串行执行保证** - 使用await确保任务同步执行，前一个完成后才开始下一个
3. **精确的间隔时间控制** - 实现可中断的等待机制，支持停止信号检测
4. **资源清理保证** - 使用finally块确保浏览器资源总是被释放
5. **超时任务重试** - 超时任务自动进入重试队列

## Architecture

### 系统组件

```
┌─────────────────────────────────────────────────────────────┐
│                      Task Scheduler                          │
│  - 定期检查待执行任务（10秒间隔）                              │
│  - 检测超时任务（running状态超过timeout_minutes）              │
│  - 调度普通任务和重试任务                                      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ├──────────────┐
                 │              │
                 ▼              ▼
┌────────────────────────┐  ┌──────────────────────────────┐
│   Batch Executor       │  │  Publishing Executor         │
│  - 串行执行批次任务     │  │  - 执行单个发布任务           │
│  - 间隔时间控制         │  │  - 超时控制（Promise.race）   │
│  - 停止信号检测         │  │  - 浏览器资源管理             │
│  - 批次锁管理           │  │  - 重试逻辑处理               │
└────────────────────────┘  └──────────────────────────────┘
         │                            │
         │                            │
         ▼                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database (PostgreSQL)                     │
│  - publishing_tasks: 任务状态、重试次数、超时配置             │
│  - publishing_logs: 执行日志                                 │
│  - articles: 文章锁状态（publishing_status）                  │
└─────────────────────────────────────────────────────────────┘
```

### 数据流

1. **任务创建流程**
   ```
   用户创建批次任务 → 设置interval_minutes和timeout_minutes
   → 任务状态设为pending → 文章标记为publishing
   ```

2. **批次执行流程**
   ```
   Task Scheduler检测到pending任务 → Batch Executor获取批次锁
   → 按batch_order顺序执行 → 每个任务调用Publishing Executor
   → 任务完成后等待interval_minutes → 检查停止信号
   → 继续下一个任务或结束批次 → 释放批次锁
   ```

3. **任务执行流程（带超时）**
   ```
   Publishing Executor开始执行 → 创建超时Promise
   → Promise.race(执行Promise, 超时Promise)
   → 如果超时：终止执行、关闭浏览器、标记timeout
   → 如果完成：更新状态、创建发布记录、清理资源
   → 如果失败：增加重试次数、标记pending或failed
   ```

4. **超时检测流程**
   ```
   Task Scheduler定期检查 → 查询running状态的任务
   → 计算执行时长 → 如果超过timeout_minutes
   → 标记为timeout → 清理浏览器进程
   → 根据重试次数决定pending或failed
   ```

## Components and Interfaces

### 1. Publishing Executor (修改)

**职责**：执行单个发布任务，实现超时控制和资源清理

**接口**：
```typescript
interface PublishingExecutor {
  /**
   * 执行发布任务（带超时控制）
   * @param taskId 任务ID
   * @param timeoutMinutes 超时时间（分钟），默认15
   * @returns Promise<void>
   * @throws TaskTimeoutError 任务超时
   */
  executeTask(taskId: number, timeoutMinutes?: number): Promise<void>;
  
  /**
   * 处理任务失败（包括超时）
   * @param taskId 任务ID
   * @param error 错误对象
   * @param isTimeout 是否为超时错误
   */
  handleTaskFailure(taskId: number, error: Error, isTimeout: boolean): Promise<void>;
  
  /**
   * 清理浏览器资源
   * @param page 页面对象
   * @param taskId 任务ID
   */
  cleanupBrowser(page: any, taskId: number): Promise<void>;
}
```

**关键实现**：
```typescript
async executeTask(taskId: number, timeoutMinutes: number = 15): Promise<void> {
  let page = null;
  
  try {
    // 获取任务配置
    const task = await publishingService.getTaskById(taskId);
    const timeout = task.config?.timeout_minutes || timeoutMinutes;
    
    // 创建超时Promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new TaskTimeoutError()), timeout * 60 * 1000);
    });
    
    // 创建执行Promise
    const executePromise = this.performPublish(taskId);
    
    // 使用Promise.race实现超时控制
    await Promise.race([executePromise, timeoutPromise]);
    
  } catch (error) {
    const isTimeout = error instanceof TaskTimeoutError;
    await this.handleTaskFailure(taskId, error, isTimeout);
  } finally {
    // 确保资源总是被清理
    await this.cleanupBrowser(page, taskId);
  }
}
```

### 2. Batch Executor (修改)

**职责**：串行执行批次任务，控制间隔时间，检测停止信号

**接口**：
```typescript
interface BatchExecutor {
  /**
   * 执行批次（串行）
   * @param batchId 批次ID
   */
  executeBatch(batchId: string): Promise<void>;
  
  /**
   * 等待间隔时间（可中断）
   * @param batchId 批次ID
   * @param intervalMinutes 间隔分钟数
   */
  waitWithStopCheck(batchId: string, intervalMinutes: number): Promise<void>;
  
  /**
   * 检查停止信号
   * @param batchId 批次ID
   * @returns 是否应该停止
   */
  checkStopSignal(batchId: string): Promise<boolean>;
  
  /**
   * 获取执行中的批次列表
   */
  getExecutingBatches(): string[];
}
```

**关键实现**：
```typescript
async executeBatch(batchId: string): Promise<void> {
  // 检查批次锁
  if (this.executingBatches.has(batchId)) {
    console.log(`批次 ${batchId} 正在执行中，跳过`);
    return;
  }
  
  // 获取批次锁
  this.executingBatches.add(batchId);
  
  try {
    const tasks = await publishingService.getBatchTasks(batchId);
    
    // 串行执行每个任务
    for (let i = 0; i < tasks.length; i++) {
      // 检查停止信号
      if (await this.checkStopSignal(batchId)) {
        console.log(`批次 ${batchId} 被停止`);
        break;
      }
      
      const task = tasks[i];
      
      // 从数据库获取最新状态
      const currentTask = await publishingService.getTaskById(task.id);
      if (!currentTask || currentTask.status !== 'pending') {
        console.log(`任务 #${task.id} 状态为 ${currentTask?.status}，跳过`);
        continue;
      }
      
      // 同步执行任务（使用await确保串行）
      await publishingExecutor.executeTask(task.id);
      
      // 检查停止信号
      if (await this.checkStopSignal(batchId)) {
        console.log(`批次 ${batchId} 被停止`);
        break;
      }
      
      // 等待间隔时间（如果不是最后一个任务）
      if (i < tasks.length - 1) {
        const intervalMinutes = task.interval_minutes || 0;
        if (intervalMinutes > 0) {
          await this.waitWithStopCheck(batchId, intervalMinutes);
        }
      }
    }
    
  } finally {
    // 释放批次锁
    this.executingBatches.delete(batchId);
  }
}
```

### 3. Task Scheduler (修改)

**职责**：定期检查待执行任务和超时任务

**接口**：
```typescript
interface TaskScheduler {
  /**
   * 启动调度器
   */
  start(): void;
  
  /**
   * 停止调度器
   */
  stop(): void;
  
  /**
   * 检查并执行待执行任务
   */
  checkAndExecuteTasks(): Promise<void>;
  
  /**
   * 检测并处理超时任务
   */
  detectTimeoutTasks(): Promise<void>;
}
```

**关键实现**：
```typescript
async checkAndExecuteTasks(): Promise<void> {
  // 1. 检测超时任务
  await this.detectTimeoutTasks();
  
  // 2. 检查批次任务
  await batchExecutor.checkAndExecuteBatches();
  
  // 3. 检查普通任务
  const tasks = await publishingService.getPendingScheduledTasks();
  for (const task of tasks) {
    if (task.batch_id) continue; // 批次任务由batchExecutor处理
    
    if (!this.executingTasks.has(task.id)) {
      this.executingTasks.add(task.id);
      publishingExecutor.executeTask(task.id)
        .finally(() => this.executingTasks.delete(task.id));
    }
  }
}

async detectTimeoutTasks(): Promise<void> {
  const result = await pool.query(`
    SELECT id, started_at, config
    FROM publishing_tasks
    WHERE status = 'running'
  `);
  
  const now = Date.now();
  
  for (const task of result.rows) {
    const timeout = task.config?.timeout_minutes || 15;
    const startedAt = new Date(task.started_at).getTime();
    const elapsed = (now - startedAt) / 1000 / 60; // 分钟
    
    if (elapsed > timeout) {
      console.log(`检测到超时任务 #${task.id}，已运行 ${elapsed.toFixed(1)} 分钟`);
      await this.handleTimeoutTask(task.id);
    }
  }
}
```

### 4. Browser Automation Service (修改)

**职责**：管理浏览器实例，支持强制关闭

**新增接口**：
```typescript
interface BrowserAutomationService {
  /**
   * 强制关闭浏览器（用于超时情况）
   */
  forceCloseBrowser(): Promise<void>;
  
  /**
   * 检查浏览器是否正在运行
   */
  isBrowserRunning(): boolean;
}
```

## Data Models

### Publishing Task (修改)

```typescript
interface PublishingTask {
  id: number;
  article_id: number;
  account_id: number;
  platform_id: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'timeout';
  config: {
    headless?: boolean;
    timeout_minutes?: number;  // 新增：超时时间（分钟）
    [key: string]: any;
  };
  scheduled_at: Date;
  started_at?: Date;
  completed_at?: Date;
  error_message?: string;
  retry_count: number;
  max_retries: number;
  batch_id?: string;
  batch_order?: number;
  interval_minutes?: number;
  created_at: Date;
  updated_at: Date;
}
```

### 数据库Schema变更

```sql
-- 添加timeout状态到status枚举
ALTER TABLE publishing_tasks 
  DROP CONSTRAINT IF EXISTS publishing_tasks_status_check;

ALTER TABLE publishing_tasks 
  ADD CONSTRAINT publishing_tasks_status_check 
  CHECK (status IN ('pending', 'running', 'success', 'failed', 'cancelled', 'timeout'));

-- config字段已经是TEXT类型，可以存储JSON，无需修改
-- timeout_minutes将存储在config JSON中
```

## Correctness Properties

*属性是关于系统应该满足的特征或行为的形式化陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### Property 1: 批次任务串行执行

*对于任何*批次中的连续两个任务T1和T2，T2的开始时间必须晚于T1的完成时间加上配置的间隔时间

**Validates: Requirements 1.1, 1.2, 1.3, 1.5**

### Property 2: 任务超时终止

*对于任何*执行时间超过timeout_minutes的任务，该任务必须被终止并标记为timeout状态

**Validates: Requirements 2.2, 2.3**

### Property 3: 超时任务重试逻辑

*对于任何*超时的任务，如果retry_count < max_retries，则状态应为pending；如果retry_count >= max_retries，则状态应为failed

**Validates: Requirements 3.1, 3.2**

### Property 4: 非pending任务跳过

*对于任何*批次中状态不为pending的任务，该任务必须被跳过，不影响后续任务的执行

**Validates: Requirements 4.2, 4.4**

### Property 5: 间隔时间精确性

*对于任何*配置了interval_minutes > 0的任务，下一个任务的开始时间与当前任务完成时间的差值应在interval_minutes ± 2秒范围内

**Validates: Requirements 5.2**

### Property 6: 批次执行锁

*对于任何*批次，在executingBatches集合中存在时，不能被重复执行；执行完成或异常后，必须从集合中移除

**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

### Property 7: 浏览器资源清理

*对于任何*任务（无论成功、失败还是超时），浏览器和页面资源必须在任务结束后被关闭

**Validates: Requirements 7.1, 7.2, 7.3, 7.5**

### Property 8: 超时配置有效性

*对于任何*任务，如果指定了timeout_minutes，则该值必须 >= 1；如果未指定，则使用默认值15分钟

**Validates: Requirements 8.2, 8.3, 8.5**

### Property 9: 超时任务检测

*对于任何*状态为running且started_at距离当前时间超过timeout_minutes的任务，调度器必须将其标记为timeout

**Validates: Requirements 10.1, 10.4**

### Property 10: 超时不阻塞批次

*对于任何*批次中的超时任务，该任务超时后，批次必须继续执行下一个pending任务

**Validates: Requirements 10.5**

## Error Handling

### 1. 任务超时错误

**场景**：任务执行时间超过timeout_minutes

**处理**：
1. 抛出TaskTimeoutError
2. 在catch块中捕获，标记isTimeout=true
3. 调用handleTaskFailure处理
4. 更新任务状态为timeout
5. 增加retry_count
6. 如果有剩余重试次数，设置状态为pending
7. 如果重试次数用完，设置状态为failed
8. 在finally块中清理浏览器资源

**日志**：
```
❌ 任务 #123 执行超时（15分钟）
🔄 任务 #123 将自动重试 (1/3)
```

### 2. 浏览器关闭失败

**场景**：关闭浏览器时发生异常

**处理**：
1. 捕获异常
2. 记录错误日志
3. 不抛出异常（避免影响任务状态更新）
4. 尝试强制关闭（kill进程）

**日志**：
```
⚠️  关闭浏览器失败: Error message
🔄 尝试强制关闭浏览器进程...
```

### 3. 批次执行异常

**场景**：批次执行过程中发生未预期的异常

**处理**：
1. 在finally块中确保释放批次锁
2. 记录异常日志
3. 不影响其他批次的执行

**日志**：
```
❌ 批次 batch-123 执行失败: Error message
✅ 批次 batch-123 已从执行队列中移除
```

### 4. 停止信号检查失败

**场景**：查询数据库检查停止信号时失败

**处理**：
1. 捕获异常
2. 重试一次
3. 如果重试失败，假设未停止，继续执行
4. 记录警告日志

**日志**：
```
⚠️  检查停止信号失败，尝试重试: Error message
⚠️  重试检查停止信号失败，假设未停止: Error message
```

### 5. 任务状态不一致

**场景**：执行前查询到的任务状态与预期不符

**处理**：
1. 跳过该任务
2. 记录日志说明跳过原因
3. 继续执行下一个任务

**日志**：
```
⏭️  任务 #123 状态为 cancelled，跳过
```

## Testing Strategy

### 单元测试

单元测试用于验证特定的例子、边界情况和错误条件：

1. **超时机制测试**
   - 测试超时Promise在指定时间后reject
   - 测试超时后浏览器被关闭
   - 测试超时后任务状态更新为timeout

2. **批次锁测试**
   - 测试批次开始时添加到executingBatches
   - 测试批次完成后从executingBatches移除
   - 测试异常情况下锁被释放

3. **间隔时间测试**
   - 测试interval_minutes=0时立即执行
   - 测试interval_minutes=null时立即执行
   - 测试interval_minutes>0时等待指定时间

4. **日志记录测试**
   - 测试批次开始时记录日志
   - 测试任务超时时记录日志
   - 测试批次完成时记录统计信息

### 属性测试

属性测试用于验证通用属性在所有输入下都成立：

1. **Property 1: 批次任务串行执行**
   ```typescript
   // Feature: batch-task-sequential-execution-fix, Property 1
   // 对于任何批次中的连续两个任务，T2的开始时间必须晚于T1的完成时间加上间隔时间
   ```
   - 生成随机批次（2-5个任务）
   - 记录每个任务的开始和完成时间
   - 验证时间顺序正确

2. **Property 2: 任务超时终止**
   ```typescript
   // Feature: batch-task-sequential-execution-fix, Property 2
   // 对于任何执行时间超过timeout_minutes的任务，必须被终止并标记为timeout
   ```
   - 生成随机超时时间（1-5分钟）
   - 模拟长时间运行的任务
   - 验证任务在超时后被终止

3. **Property 3: 超时任务重试逻辑**
   ```typescript
   // Feature: batch-task-sequential-execution-fix, Property 3
   // 对于任何超时任务，根据retry_count决定状态为pending或failed
   ```
   - 生成随机retry_count和max_retries
   - 模拟任务超时
   - 验证状态转换正确

4. **Property 5: 间隔时间精确性**
   ```typescript
   // Feature: batch-task-sequential-execution-fix, Property 5
   // 对于任何配置了interval_minutes的任务，实际等待时间应在配置值±2秒范围内
   ```
   - 生成随机interval_minutes（1-10分钟）
   - 记录实际等待时间
   - 验证误差在±2秒内

5. **Property 6: 批次执行锁**
   ```typescript
   // Feature: batch-task-sequential-execution-fix, Property 6
   // 对于任何批次，在executingBatches中存在时不能重复执行
   ```
   - 生成随机批次ID
   - 尝试并发执行同一批次
   - 验证只有一个执行成功

### 集成测试

1. **完整批次执行流程**
   - 创建包含3个任务的批次
   - 设置间隔时间为1分钟
   - 验证任务按顺序执行
   - 验证间隔时间被正确执行
   - 验证所有任务完成后批次结束

2. **超时任务重试流程**
   - 创建一个会超时的任务
   - 设置max_retries=2
   - 验证任务超时后重试
   - 验证重试次数用完后标记为failed

3. **批次停止流程**
   - 创建包含5个任务的批次
   - 在第2个任务完成后停止批次
   - 验证剩余任务被取消
   - 验证文章锁被释放

### 测试配置

- 属性测试最少运行100次迭代
- 每个属性测试必须引用设计文档中的属性编号
- 使用fast-check库进行属性测试（TypeScript）
- 超时测试使用较短的超时时间（10-30秒）以加快测试速度
