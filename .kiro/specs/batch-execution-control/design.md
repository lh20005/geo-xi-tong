# Design Document: Batch Execution Control

## Overview

This design addresses two critical issues in the batch execution system:

1. **Batch Stop Not Responding**: When users click "Stop Batch", tasks continue executing because the stop signal detection is not immediate or reliable
2. **Interval Time Not Enforced**: Tasks execute immediately after the previous task completes, ignoring the configured interval_minutes setting

The root causes are:
- Stop signal checks happen too infrequently (every 10 seconds during wait)
- The interval wait logic may have bugs that cause it to skip the wait
- Task execution doesn't verify stop signal before starting each task

This design provides solutions to make batch stopping immediate and interval timing accurate.

## Architecture

### Current System Flow

```
User clicks "Stop Batch"
  ↓
PublishingService.stopBatch()
  ↓
Updates all pending tasks to 'cancelled' in database
  ↓
BatchExecutor continues running...
  ↓
Checks stop signal every 10 seconds during wait
  ↓
Eventually detects stop (up to 10 second delay)
```

### Problem 1: Stop Signal Detection Delay

**Current Implementation:**
```typescript
// In BatchExecutor.executeBatch()
while (waitedTime < totalWaitTime) {
  const sleepTime = Math.min(checkInterval, totalWaitTime - waitedTime);
  await this.sleep(sleepTime);  // Sleeps for up to 10 seconds
  waitedTime += sleepTime;
  
  // Check stop signal
  const checkResult = await pool.query(
    `SELECT COUNT(*) as pending_count 
     FROM publishing_tasks 
     WHERE batch_id = $1 AND status = 'pending'`,
    [batchId]
  );
  
  const pendingCount = parseInt(checkResult.rows[0].pending_count);
  if (pendingCount === 0) {
    console.log(`🛑 批次 ${batchId} 在等待期间被停止，终止执行`);
    return;
  }
}
```

**Issues:**
- Check interval is 10 seconds, which is too long
- No check happens before starting each task (only during wait)
- If a task is currently executing when stop is clicked, it completes fully before checking

**Solution:**
- Reduce check interval to 1 second for faster response
- Add stop signal check before starting each task
- Add stop signal check immediately after task completion

### Problem 2: Interval Time Not Enforced

**Current Implementation:**
```typescript
// After task execution
if (i < tasks.length - 1 && task.interval_minutes && task.interval_minutes > 0) {
  const waitMs = task.interval_minutes * 60 * 1000;
  // ... wait logic ...
}
```

**Potential Issues:**
- The condition `i < tasks.length - 1` might be evaluated incorrectly
- The `task.interval_minutes` might be null or undefined
- The wait loop might exit early due to stop signal check
- There might be a bug in the wait loop logic

**Solution:**
- Add detailed logging before and after wait
- Verify interval_minutes value is used correctly
- Ensure wait completes unless stop signal is detected
- Add timing verification to confirm actual wait duration

### Improved System Flow

```
User clicks "Stop Batch"
  ↓
PublishingService.stopBatch()
  ↓
Updates all pending tasks to 'cancelled' in database
  ↓
BatchExecutor checks stop signal (within 1 second)
  ↓
Detects pending_count = 0
  ↓
Terminates wait immediately or skips next task
  ↓
Logs stop event and exits
```

## Components and Interfaces

### 1. BatchExecutor Enhancements

**Purpose**: Execute batch tasks with accurate interval timing and immediate stop response

**Key Changes:**

```typescript
class BatchExecutor {
  private executingBatches: Set<string> = new Set();
  private readonly STOP_CHECK_INTERVAL_MS = 1000; // Check every 1 second (was 10 seconds)
  
  /**
   * Execute batch with improved stop detection and interval enforcement
   */
  async executeBatch(batchId: string): Promise<void> {
    // Prevent duplicate execution
    if (this.executingBatches.has(batchId)) {
      console.log(`⚠️  批次 ${batchId} 正在执行中，跳过`);
      return;
    }

    this.executingBatches.add(batchId);
    const startTime = Date.now();
    console.log(`🚀 开始执行批次 ${batchId} at ${new Date().toISOString()}`);

    try {
      // Get all tasks in batch
      const tasks = await publishingService.getBatchTasks(batchId);
      
      if (tasks.length === 0) {
        console.log(`⚠️  批次 ${batchId} 没有任务`);
        return;
      }

      console.log(`📋 批次 ${batchId} 共有 ${tasks.length} 个任务`);

      // Execute each task sequentially
      for (let i = 0; i < tasks.length; i++) {
        // CRITICAL: Check stop signal before starting each task
        const shouldStop = await this.checkStopSignal(batchId);
        if (shouldStop) {
          console.log(`🛑 批次 ${batchId} 在任务 ${i + 1} 开始前被停止`);
          break;
        }
        
        const task = tasks[i];
        
        // Verify task status from database (fresh query)
        const currentTask = await publishingService.getTaskById(task.id);
        if (!currentTask || currentTask.status !== 'pending') {
          console.log(`⏭️  任务 #${task.id} 状态为 ${currentTask?.status || '不存在'}，跳过`);
          continue;
        }

        console.log(`\n📝 执行批次 ${batchId} 中的第 ${i + 1}/${tasks.length} 个任务 #${task.id}`);
        console.log(`   文章ID: ${task.article_id}, 平台: ${task.platform_id}`);

        try {
          // Execute task (synchronous wait for completion)
          await publishingExecutor.executeTask(task.id);
          
          // Log final task status
          const finalTask = await publishingService.getTaskById(task.id);
          if (finalTask?.status === 'success') {
            console.log(`✅ 批次任务 #${task.id} 执行成功`);
          } else if (finalTask?.status === 'pending') {
            console.log(`🔄 批次任务 #${task.id} 失败，已标记为待重试 (${finalTask.retry_count}/${finalTask.max_retries})`);
          } else if (finalTask?.status === 'failed') {
            console.log(`❌ 批次任务 #${task.id} 失败，重试次数已用完`);
          }
        } catch (error: any) {
          console.error(`❌ 批次任务 #${task.id} 执行异常:`, error.message);
          // Continue to next task - failed task will be retried by scheduler
        }

        // CRITICAL: Check stop signal after task completion
        const shouldStopAfterTask = await this.checkStopSignal(batchId);
        if (shouldStopAfterTask) {
          console.log(`🛑 批次 ${batchId} 在任务 ${i + 1} 完成后被停止`);
          break;
        }

        // Wait interval before next task (if not last task)
        if (i < tasks.length - 1) {
          const intervalMinutes = task.interval_minutes || 0;
          
          if (intervalMinutes > 0) {
            await this.waitWithStopCheck(batchId, intervalMinutes);
          } else {
            console.log(`⏭️  无需等待，立即执行下一个任务`);
          }
        }
      }

      // Log batch completion
      const duration = Date.now() - startTime;
      console.log(`\n🎉 批次 ${batchId} 执行完成！耗时: ${Math.round(duration / 1000)}秒`);
      
      // Query final status counts
      await this.logBatchSummary(batchId);

    } catch (error: any) {
      console.error(`❌ 批次 ${batchId} 执行失败:`, error);
    } finally {
      // CRITICAL: Always remove from executing set
      this.executingBatches.delete(batchId);
      console.log(`✅ 批次 ${batchId} 已从执行队列中移除`);
    }
  }

  /**
   * Check if batch should stop (pending task count = 0)
   */
  private async checkStopSignal(batchId: string): Promise<boolean> {
    try {
      const { pool } = require('../db/database');
      const result = await pool.query(
        `SELECT COUNT(*) as pending_count 
         FROM publishing_tasks 
         WHERE batch_id = $1 AND status = 'pending'`,
        [batchId]
      );
      
      const pendingCount = parseInt(result.rows[0].pending_count);
      return pendingCount === 0;
    } catch (error: any) {
      console.error(`⚠️  检查停止信号失败，假设未停止:`, error.message);
      // On error, retry once
      try {
        const { pool } = require('../db/database');
        const result = await pool.query(
          `SELECT COUNT(*) as pending_count 
           FROM publishing_tasks 
           WHERE batch_id = $1 AND status = 'pending'`,
          [batchId]
        );
        
        const pendingCount = parseInt(result.rows[0].pending_count);
        return pendingCount === 0;
      } catch (retryError: any) {
        console.error(`⚠️  重试检查停止信号失败，假设未停止:`, retryError.message);
        return false; // Assume not stopped on double failure
      }
    }
  }

  /**
   * Wait for interval with frequent stop signal checks
   */
  private async waitWithStopCheck(
    batchId: string,
    intervalMinutes: number
  ): Promise<void> {
    // Validate and normalize interval
    if (intervalMinutes < 0) {
      console.log(`⚠️  间隔时间为负数 (${intervalMinutes})，视为0`);
      intervalMinutes = 0;
    }
    
    if (intervalMinutes > 1440) {
      console.log(`⚠️  间隔时间超过24小时 (${intervalMinutes}分钟)，但仍会执行`);
    }
    
    if (intervalMinutes === 0) {
      return; // No wait needed
    }
    
    const waitMs = intervalMinutes * 60 * 1000;
    const nextExecutionTime = new Date(Date.now() + waitMs);
    
    console.log(`⏳ 等待 ${intervalMinutes} 分钟后执行下一个任务...`);
    console.log(`   当前时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log(`   预计下次执行时间: ${nextExecutionTime.toLocaleString('zh-CN')}`);
    console.log(`   等待时长: ${waitMs}ms (${intervalMinutes}分钟)`);
    
    const waitStartTime = Date.now();
    let waitedTime = 0;
    
    // Check stop signal every 1 second (was 10 seconds)
    while (waitedTime < waitMs) {
      const sleepTime = Math.min(this.STOP_CHECK_INTERVAL_MS, waitMs - waitedTime);
      
      try {
        await this.sleep(sleepTime);
      } catch (error: any) {
        console.error(`⚠️  睡眠被中断:`, error.message);
        // Handle interruption and check stop signal
      }
      
      waitedTime += sleepTime;
      
      // Check if batch was stopped
      const shouldStop = await this.checkStopSignal(batchId);
      if (shouldStop) {
        const remainingMs = waitMs - waitedTime;
        const remainingMinutes = Math.round(remainingMs / 60000);
        console.log(`🛑 批次 ${batchId} 在等待期间被停止`);
        console.log(`   已等待: ${Math.round(waitedTime / 1000)}秒`);
        console.log(`   剩余等待: ${remainingMinutes}分钟`);
        return; // Exit wait immediately
      }
    }
    
    const actualWaitTime = Date.now() - waitStartTime;
    const actualWaitMinutes = Math.round(actualWaitTime / 60000);
    console.log(`✅ 等待完成`);
    console.log(`   预期等待: ${intervalMinutes}分钟`);
    console.log(`   实际等待: ${actualWaitMinutes}分钟 (${actualWaitTime}ms)`);
    
    // Final stop signal check before proceeding
    const shouldStopFinal = await this.checkStopSignal(batchId);
    if (shouldStopFinal) {
      console.log(`🛑 批次 ${batchId} 在等待完成后被停止，不执行下一个任务`);
      return;
    }
  }

  /**
   * Log batch summary with final status counts
   */
  private async logBatchSummary(batchId: string): Promise<void> {
    try {
      const { pool } = require('../db/database');
      const result = await pool.query(
        `SELECT 
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE status = 'success') as success,
           COUNT(*) FILTER (WHERE status = 'failed') as failed,
           COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
           COUNT(*) FILTER (WHERE status = 'pending') as pending
         FROM publishing_tasks 
         WHERE batch_id = $1`,
        [batchId]
      );
      
      const stats = result.rows[0];
      console.log(`📊 批次 ${batchId} 统计:`);
      console.log(`   总任务数: ${stats.total}`);
      console.log(`   成功: ${stats.success}`);
      console.log(`   失败: ${stats.failed}`);
      console.log(`   已取消: ${stats.cancelled}`);
      console.log(`   待处理: ${stats.pending}`);
    } catch (error: any) {
      console.error(`⚠️  获取批次统计失败:`, error.message);
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 2. PublishingService (No Changes Needed)

The `stopBatch()` method already correctly updates all pending tasks to 'cancelled' status in a transaction. No changes needed.

### 3. Database Queries

**Stop Signal Detection Query:**
```sql
SELECT COUNT(*) as pending_count 
FROM publishing_tasks 
WHERE batch_id = $1 AND status = 'pending'
```

This query is efficient and uses the existing index on `batch_id`.

## Data Models

No schema changes required. The existing `publishing_tasks` table has all necessary fields:
- `batch_id`: Groups tasks into batches
- `batch_order`: Defines execution order within batch
- `interval_minutes`: Wait time between tasks
- `status`: Task status (pending, running, success, failed, cancelled)

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Stop Signal Detection Speed

*For any* batch that is stopped, the Batch_Executor should detect the stop signal within 2 seconds (allowing for 1 check interval + query time).

**Validates: Requirements 1.1**

### Property 2: Current Task Completion on Stop

*For any* batch where a stop signal is sent during task execution, the currently executing task should complete, and the next task should not start.

**Validates: Requirements 1.2**

### Property 3: Immediate Wait Termination on Stop

*For any* batch where a stop signal is sent during interval wait, the wait should terminate within 2 seconds and the next task should not start.

**Validates: Requirements 1.3, 3.2, 3.4**

### Property 4: Stop Event Logging

*For any* batch that is stopped, a log entry should be created containing the stop event and timestamp.

**Validates: Requirements 1.4**

### Property 5: Executing Set Cleanup on Stop

*For any* batch that stops (normally or via stop signal), the batch_id should be removed from the executing batches set.

**Validates: Requirements 1.5, 5.2**

### Property 6: Interval Time Enforcement

*For any* task in a batch with interval_minutes > 0, the time between task completion and next task start should be approximately interval_minutes * 60 seconds (within 5% tolerance for system overhead).

**Validates: Requirements 2.1, 2.2**

### Property 7: Wait Start Logging

*For any* interval wait, a log entry should be created containing the wait start time, interval duration, and expected next execution time.

**Validates: Requirements 2.4**

### Property 8: Wait Completion Logging

*For any* interval wait that completes normally, a log entry should be created before the next task starts.

**Validates: Requirements 2.5**

### Property 9: Stop Check Frequency

*For any* interval wait, stop signal checks should occur at intervals of approximately 1 second (within 10% tolerance).

**Validates: Requirements 3.1**

### Property 10: Early Termination Logging

*For any* interval wait that terminates early due to stop signal, a log entry should be created containing the early termination event and remaining wait time.

**Validates: Requirements 3.3**

### Property 11: Final Stop Check Before Task

*For any* interval wait that completes normally, a final stop signal check should occur immediately before starting the next task.

**Validates: Requirements 3.5**

### Property 12: Fresh Task Status Query

*For any* task about to be executed, the Batch_Executor should query the current task status from the database (not use cached data).

**Validates: Requirements 4.1, 4.5, 7.5**

### Property 13: Non-Pending Task Skipping

*For any* task with status other than 'pending', the Batch_Executor should skip the task and continue to the next task.

**Validates: Requirements 4.2**

### Property 14: Skip Event Logging

*For any* task that is skipped, a log entry should be created containing the skip event and current task status.

**Validates: Requirements 4.3**

### Property 15: All-Skipped Batch Completion

*For any* batch where all tasks are skipped or cancelled, the batch execution should complete without error.

**Validates: Requirements 4.4**

### Property 16: Executing Set Addition on Start

*For any* batch that starts executing, the batch_id should be added to the executing batches set before any tasks execute.

**Validates: Requirements 5.1**

### Property 17: Duplicate Execution Prevention

*For any* batch that is already in the executing batches set, attempting to start it again should be rejected without executing any tasks.

**Validates: Requirements 5.3**

### Property 18: Executing Batches Query Accuracy

*For any* query of executing batches, the returned list should exactly match the batches currently in the executing batches set.

**Validates: Requirements 5.4**

### Property 19: Executing Set Cleanup on Error

*For any* batch execution that fails with an exception, the batch_id should be removed from the executing batches set.

**Validates: Requirements 5.5, 9.5**

### Property 20: Interval Calculation Correctness

*For any* task with interval_minutes value, the calculated wait time in milliseconds should equal interval_minutes * 60 * 1000.

**Validates: Requirements 6.1, 6.2**

### Property 21: Wait Time Logging Completeness

*For any* interval wait log entry, it should contain both the interval in minutes and the calculated next execution timestamp.

**Validates: Requirements 6.3**

### Property 22: Stop Signal Transaction Atomicity

*For any* batch stop operation, all pending tasks should be updated to 'cancelled' status in a single transaction (all succeed or all fail).

**Validates: Requirements 7.1**

### Property 23: Stop Signal Detection Mechanism

*For any* stop signal check, the Batch_Executor should query the count of pending tasks in the batch from the database.

**Validates: Requirements 7.2**

### Property 24: Zero Pending Count Interpretation

*For any* batch where the pending task count is 0, the Batch_Executor should interpret this as a stop signal and terminate execution.

**Validates: Requirements 7.3**

### Property 25: Positive Pending Count Continuation

*For any* batch where the pending task count is greater than 0, the Batch_Executor should continue execution.

**Validates: Requirements 7.4**

### Property 26: Completion Logging with Task Count

*For any* batch that completes all tasks, a log entry should be created containing the completion event and total task count.

**Validates: Requirements 8.1**

### Property 27: Early Stop Logging with Counts

*For any* batch that is stopped early, a log entry should be created containing completed task count and remaining task count.

**Validates: Requirements 8.2**

### Property 28: Final Status Query on Completion

*For any* batch that completes, the Batch_Executor should query and log the final status counts (success, failed, cancelled).

**Validates: Requirements 8.3**

### Property 29: Completion Duration Logging

*For any* batch completion log, it should include the total execution duration.

**Validates: Requirements 8.4**

### Property 30: Error Logging and Continuation

*For any* error that occurs during interval wait, the Batch_Executor should log the error and continue to the next task.

**Validates: Requirements 9.1**

### Property 31: Query Retry on Failure

*For any* database query failure during stop signal check, the Batch_Executor should retry the query once before assuming no stop signal.

**Validates: Requirements 9.2, 9.3**

### Property 32: Sleep Interruption Handling

*For any* sleep operation that is interrupted, the Batch_Executor should handle the interruption and check the stop signal.

**Validates: Requirements 9.4**

### Property 33: Concurrent Batch Execution

*For any* set of multiple batches with pending tasks, the Batch_Executor should execute them concurrently without blocking each other.

**Validates: Requirements 10.1**

### Property 34: Batch Stop Isolation

*For any* batch that is stopped, other executing batches should continue running without interruption.

**Validates: Requirements 10.2**

### Property 35: Stop Signal Query Scope

*For any* stop signal check, the database query should filter by the current batch_id only.

**Validates: Requirements 10.3**

### Property 36: Batch ID in Logs

*For any* batch event log entry, it should include the batch_id to distinguish between different batches.

**Validates: Requirements 10.4**

### Property 37: Non-Blocking Batch Completion

*For any* batch that completes, it should not prevent other batches from starting or continuing execution.

**Validates: Requirements 10.5**

## Error Handling

### Error Categories

1. **Stop Signal Detection Errors**
   - Database query failures during stop check
   - Action: Retry once, then assume no stop signal

2. **Interval Wait Errors**
   - Sleep interruption
   - Timer errors
   - Action: Log error, check stop signal, continue

3. **Task Status Query Errors**
   - Database connection failures
   - Action: Log error, skip task, continue to next

4. **Batch Execution Errors**
   - Unexpected exceptions during execution
   - Action: Log error, clean up executing set, exit gracefully

### Error Recovery Strategy

```typescript
// Stop signal check with retry
try {
  return await this.checkStopSignal(batchId);
} catch (error) {
  console.error('Stop signal check failed, retrying once:', error);
  try {
    return await this.checkStopSignal(batchId);
  } catch (retryError) {
    console.error('Stop signal check retry failed, assuming not stopped:', retryError);
    return false; // Assume not stopped on double failure
  }
}

// Batch execution with cleanup
try {
  // ... execute batch ...
} catch (error) {
  console.error('Batch execution failed:', error);
} finally {
  // CRITICAL: Always clean up
  this.executingBatches.delete(batchId);
}
```

## Testing Strategy

### Unit Tests

Unit tests will verify specific examples and edge cases:

1. **Stop Signal Detection Tests**
   - Test that checkStopSignal returns true when pending count is 0
   - Test that checkStopSignal returns false when pending count > 0
   - Test retry logic on query failure

2. **Interval Calculation Tests**
   - Test minutes to milliseconds conversion
   - Test negative interval handling (treat as 0)
   - Test very large interval handling (log warning)

3. **Executing Set Tests**
   - Test batch added to set on start
   - Test batch removed from set on completion
   - Test batch removed from set on error
   - Test duplicate execution prevention

4. **Logging Tests**
   - Test stop event logging
   - Test wait start/completion logging
   - Test skip event logging
   - Test completion summary logging

### Property-Based Tests

Property-based tests will verify universal properties across all inputs. Each test will run a minimum of 100 iterations to ensure comprehensive coverage.

**Test Framework**: We will use `fast-check` for TypeScript property-based testing.

**Test Configuration**:
```typescript
import fc from 'fast-check';

// Each property test runs 100 iterations
fc.assert(
  fc.property(/* generators */, (/* inputs */) => {
    // Test property
  }),
  { numRuns: 100 }
);
```

**Key Property Tests**:

1. **Property 3: Immediate Wait Termination**
   - Generate: Random batches with various interval times
   - Action: Start wait, send stop signal at random time during wait
   - Verify: Wait terminates within 2 seconds, next task doesn't start
   - Tag: **Feature: batch-execution-control, Property 3: Immediate Wait Termination on Stop**

2. **Property 6: Interval Time Enforcement**
   - Generate: Random batches with various interval_minutes values
   - Action: Execute batch, measure actual wait time
   - Verify: Actual wait time ≈ interval_minutes * 60 seconds (within 5% tolerance)
   - Tag: **Feature: batch-execution-control, Property 6: Interval Time Enforcement**

3. **Property 20: Interval Calculation Correctness**
   - Generate: Random interval_minutes values
   - Action: Calculate wait time in milliseconds
   - Verify: waitMs = interval_minutes * 60 * 1000
   - Tag: **Feature: batch-execution-control, Property 20: Interval Calculation Correctness**

4. **Property 34: Batch Stop Isolation**
   - Generate: Multiple random batches executing concurrently
   - Action: Stop one batch
   - Verify: Other batches continue without interruption
   - Tag: **Feature: batch-execution-control, Property 34: Batch Stop Isolation**

### Integration Tests

Integration tests will verify end-to-end workflows:

1. **Batch Stop During Task Execution**
   - Create batch with 3 tasks
   - Start execution
   - Send stop signal during task 2
   - Verify: Task 2 completes, task 3 doesn't start

2. **Batch Stop During Interval Wait**
   - Create batch with 2 tasks, 5 minute interval
   - Start execution
   - Send stop signal 1 minute into wait
   - Verify: Wait terminates within 2 seconds, task 2 doesn't start

3. **Interval Time Accuracy**
   - Create batch with 2 tasks, 2 minute interval
   - Execute batch
   - Measure time between task completions
   - Verify: Approximately 2 minutes (within 5 seconds)

4. **Concurrent Batch Execution**
   - Create 3 batches with different tasks
   - Start all batches
   - Stop batch 2
   - Verify: Batches 1 and 3 continue, batch 2 stops

### Test Coverage Goals

- Unit tests: 85% code coverage
- Property tests: All 37 correctness properties
- Integration tests: All major workflows
- Edge cases: Negative intervals, very large intervals, zero intervals, concurrent stops
