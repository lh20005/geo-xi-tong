# Design Document: Publishing Task Reliability

## Overview

This design addresses critical reliability issues in the publishing task system, focusing on four main areas:
1. Automatic retry mechanism for failed tasks
2. Correct status updates for cancelled tasks
3. Proper article lock release on task cancellation/deletion
4. Timely status updates after task completion

The design ensures that the task execution system is robust, predictable, and maintains data consistency across all operations.

## Architecture

### Current System Components

The publishing system consists of several key components:

1. **TaskScheduler**: Periodically checks for pending tasks and triggers execution
2. **PublishingExecutor**: Executes individual publishing tasks
3. **BatchExecutor**: Manages sequential execution of batch tasks with intervals
4. **PublishingService**: Provides CRUD operations and status management for tasks
5. **Database**: PostgreSQL with publishing_tasks, publishing_logs, and articles tables

### Problem Analysis

#### Problem 1: Retry Mechanism Not Working

**Current Behavior:**
- When a task fails (e.g., "Cookie登录失败"), the executor increments retry_count and sets status to 'pending'
- However, the TaskScheduler only checks for tasks where `scheduled_at <= CURRENT_TIMESTAMP`
- Retry tasks have `scheduled_at` set to their original scheduled time, not updated for retry
- Result: Retry tasks are not detected by the scheduler

**Root Cause:**
```typescript
// In TaskScheduler.checkAndExecuteTasks()
const tasks = await publishingService.getPendingScheduledTasks();

// In PublishingService.getPendingScheduledTasks()
SELECT * FROM publishing_tasks 
WHERE status = 'pending' 
AND scheduled_at IS NOT NULL 
AND scheduled_at <= CURRENT_TIMESTAMP  // This filters out retry tasks!
```

#### Problem 2: Cancelled Task Status Not Updated

**Current Behavior:**
- The `cancelTask` method correctly updates status to 'cancelled'
- However, the `stopBatch` method in BatchExecutor updates status to 'cancelled'
- Both methods work correctly

**Root Cause:**
- This appears to be working correctly in the code
- The issue may be in the UI not refreshing or displaying the status correctly
- Or there may be a race condition where the status is read before the update completes

#### Problem 3: Article Lock Not Released

**Current Behavior:**
- `cancelTask` correctly clears `publishing_status`
- `stopBatch` correctly clears `publishing_status` for cancelled tasks
- `deleteTask` and `deleteTasks` correctly clear `publishing_status`

**Root Cause:**
- The code appears correct
- The issue may be that the article lock is set at task creation but not properly tracked
- Need to verify when `publishing_status` is set and ensure it's always cleared

#### Problem 4: Task Status Not Updated After Completion

**Current Behavior:**
```typescript
// In PublishingExecutor.executeTask()
await publishingService.updateTaskStatus(taskId, 'success');
await publishingService.logMessage(taskId, 'info', '🎉 文章发布成功！');
await this.createPublishingRecord(taskId, task, account);
await publishingService.logMessage(taskId, 'info', '✅ 发布记录已创建');
```

**Root Cause:**
- The status IS being updated to 'success' before creating the publishing record
- The issue may be:
  1. The UI is not refreshing to show the updated status
  2. There's a race condition where the UI reads the status before it's updated
  3. The log message "发布记录已创建" appears after status update, making it seem like status wasn't updated

## Components and Interfaces

### 1. TaskScheduler Enhancements

**Purpose**: Detect and execute both new tasks and retry tasks

**Changes**:
```typescript
class TaskScheduler {
  /**
   * Get all pending tasks that should be executed
   * Includes:
   * - New tasks with scheduled_at <= now
   * - Retry tasks (pending status, retry_count > 0)
   * - Immediate tasks (scheduled_at is null)
   */
  private async getPendingTasks(): Promise<PublishingTask[]> {
    const result = await pool.query(`
      SELECT * FROM publishing_tasks 
      WHERE status = 'pending' 
      AND (
        scheduled_at IS NULL 
        OR scheduled_at <= CURRENT_TIMESTAMP
        OR retry_count > 0
      )
      ORDER BY 
        CASE WHEN retry_count > 0 THEN 0 ELSE 1 END,  -- Prioritize retries
        scheduled_at ASC NULLS FIRST
    `);
    return result.rows.map(row => this.formatTask(row));
  }
}
```

### 2. PublishingExecutor Enhancements

**Purpose**: Ensure correct status transitions and error handling

**Changes**:
```typescript
class PublishingExecutor {
  /**
   * Execute task with proper status management
   */
  async executeTask(taskId: number): Promise<void> {
    try {
      // ... existing execution logic ...
      
      // CRITICAL: Update status to success BEFORE creating record
      await publishingService.updateTaskStatus(taskId, 'success');
      await publishingService.logMessage(taskId, 'info', '✅ 任务执行成功');
      
      // Create publishing record
      await this.createPublishingRecord(taskId, task, account);
      await publishingService.logMessage(taskId, 'info', '✅ 发布记录已创建');
      
      // Clear article lock
      await this.clearArticleLock(task.article_id);
      
    } catch (error: any) {
      await this.handleTaskFailure(taskId, error);
    }
  }
  
  /**
   * Handle task failure with retry logic
   */
  private async handleTaskFailure(taskId: number, error: Error): Promise<void> {
    // Increment retry count
    await publishingService.incrementRetryCount(taskId);
    
    // Get current task state
    const task = await publishingService.getTaskById(taskId);
    if (!task) return;
    
    const nextRetryCount = task.retry_count + 1;
    
    if (nextRetryCount < task.max_retries) {
      // Still have retries left
      await publishingService.updateTaskStatus(
        taskId,
        'pending',
        `执行失败，将自动重试 (${nextRetryCount}/${task.max_retries})`
      );
      await publishingService.logMessage(
        taskId,
        'warning',
        `执行失败，将自动重试 (${nextRetryCount}/${task.max_retries})`,
        { error: error.message }
      );
    } else {
      // Retries exhausted
      await publishingService.updateTaskStatus(
        taskId,
        'failed',
        `重试次数已用完: ${error.message}`
      );
      await publishingService.logMessage(
        taskId,
        'error',
        '任务执行失败，重试次数已用完',
        { error: error.message, stack: error.stack }
      );
      
      // Clear article lock on final failure
      await this.clearArticleLock(task.article_id);
    }
  }
  
  /**
   * Clear article lock (publishing_status)
   */
  private async clearArticleLock(articleId: number): Promise<void> {
    await pool.query(
      'UPDATE articles SET publishing_status = NULL WHERE id = $1',
      [articleId]
    );
  }
}
```

### 3. PublishingService Enhancements

**Purpose**: Ensure atomic operations and proper transaction handling

**Changes**:
```typescript
class PublishingService {
  /**
   * Cancel task with atomic article lock release
   */
  async cancelTask(taskId: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Get task info
      const taskResult = await client.query(
        'SELECT article_id, status FROM publishing_tasks WHERE id = $1',
        [taskId]
      );
      
      if (taskResult.rows.length === 0) {
        throw new Error('任务不存在');
      }
      
      const task = taskResult.rows[0];
      
      // Only cancel pending tasks
      if (task.status !== 'pending') {
        throw new Error(`只能取消待处理状态的任务，当前状态: ${task.status}`);
      }
      
      // Update task status
      await client.query(
        `UPDATE publishing_tasks 
         SET status = 'cancelled', 
             updated_at = CURRENT_TIMESTAMP,
             error_message = '用户手动取消'
         WHERE id = $1`,
        [taskId]
      );
      
      // Clear article lock
      await client.query(
        'UPDATE articles SET publishing_status = NULL WHERE id = $1',
        [task.article_id]
      );
      
      await client.query('COMMIT');
      
      // Log cancellation
      await this.logMessage(taskId, 'info', '任务已取消');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Update task status with timestamp
   */
  async updateTaskStatus(
    taskId: number,
    status: PublishingTask['status'],
    errorMessage?: string
  ): Promise<void> {
    const updates: string[] = [
      'status = $1',
      'updated_at = CURRENT_TIMESTAMP'
    ];
    const params: any[] = [status];
    let paramIndex = 2;
    
    // Set timestamps based on status
    if (status === 'running') {
      updates.push('started_at = CURRENT_TIMESTAMP');
    }
    
    if (status === 'success' || status === 'failed' || status === 'cancelled') {
      updates.push('completed_at = CURRENT_TIMESTAMP');
    }
    
    if (errorMessage) {
      updates.push(`error_message = $${paramIndex}`);
      params.push(errorMessage);
      paramIndex++;
    }
    
    params.push(taskId);
    
    await pool.query(
      `UPDATE publishing_tasks 
       SET ${updates.join(', ')} 
       WHERE id = $${paramIndex}`,
      params
    );
  }
}
```

### 4. BatchExecutor Enhancements

**Purpose**: Ensure batch tasks handle retries correctly

**Changes**:
```typescript
class BatchExecutor {
  /**
   * Execute batch with retry support
   */
  async executeBatch(batchId: string): Promise<void> {
    // ... existing batch execution logic ...
    
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      
      // Re-check task status (may have been cancelled)
      const currentTask = await publishingService.getTaskById(task.id);
      if (!currentTask || currentTask.status !== 'pending') {
        console.log(`⏭️  任务 #${task.id} 状态为 ${currentTask?.status || '不存在'}，跳过`);
        continue;
      }
      
      try {
        await publishingExecutor.executeTask(task.id);
      } catch (error: any) {
        console.error(`❌ 任务 #${task.id} 执行失败:`, error.message);
        // Continue to next task - failed task will be retried by scheduler
      }
      
      // Wait interval before next task
      if (i < tasks.length - 1 && task.interval_minutes > 0) {
        await this.waitWithCancellationCheck(batchId, task.interval_minutes);
      }
    }
  }
  
  /**
   * Wait with periodic cancellation checks
   */
  private async waitWithCancellationCheck(
    batchId: string,
    minutes: number
  ): Promise<void> {
    const totalMs = minutes * 60 * 1000;
    const checkInterval = 10000; // Check every 10 seconds
    let elapsed = 0;
    
    while (elapsed < totalMs) {
      const sleepTime = Math.min(checkInterval, totalMs - elapsed);
      await this.sleep(sleepTime);
      elapsed += sleepTime;
      
      // Check if batch was stopped
      const pendingCount = await this.getPendingTaskCount(batchId);
      if (pendingCount === 0) {
        console.log(`🛑 批次 ${batchId} 已停止`);
        return;
      }
    }
  }
  
  /**
   * Get count of pending tasks in batch
   */
  private async getPendingTaskCount(batchId: string): Promise<number> {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM publishing_tasks WHERE batch_id = $1 AND status = $2',
      [batchId, 'pending']
    );
    return parseInt(result.rows[0].count);
  }
}
```

## Data Models

### PublishingTask

```typescript
interface PublishingTask {
  id: number;
  article_id: number;
  account_id: number;
  platform_id: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  config: any;
  scheduled_at?: Date;
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

### Database Schema

No schema changes required. The existing `publishing_tasks` table has all necessary fields:
- `retry_count`: Tracks number of retry attempts
- `max_retries`: Maximum allowed retries
- `status`: Task status including 'cancelled'
- `error_message`: Stores error details
- `updated_at`: Tracks last update time

The `articles` table has:
- `publishing_status`: Lock field to prevent article reuse

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Retry Task Detection

*For any* task with status 'pending' and retry_count > 0, the Task_Scheduler should detect and include it in the list of tasks to execute, regardless of its scheduled_at value.

**Validates: Requirements 1.1, 1.2, 7.5**

### Property 2: Retry Count Increment

*For any* task that fails with retry_count < max_retries, the Publishing_Executor should increment retry_count by 1 and set status to 'pending'.

**Validates: Requirements 1.3, 1.5**

### Property 3: Retry Exhaustion

*For any* task where retry_count >= max_retries after failure, the Publishing_Executor should set status to 'failed' and should not set it to 'pending'.

**Validates: Requirements 1.4**

### Property 4: Cancellation Status Update

*For any* pending task, when cancelled, the Publishing_Service should atomically update status to 'cancelled', set error_message to indicate manual cancellation, and set updated_at to current timestamp.

**Validates: Requirements 2.1, 2.3, 2.4, 8.2**

### Property 5: Batch Cancellation

*For any* batch with pending tasks, when stopped, the Batch_Executor should update all pending tasks in that batch to 'cancelled' status.

**Validates: Requirements 2.2**

### Property 6: Article Lock Release on Cancellation

*For any* task cancellation, deletion, or final failure, the system should clear the article's publishing_status field in the same transaction as the task status update.

**Validates: Requirements 3.1, 3.2, 3.3, 6.3**

### Property 7: Article Visibility After Lock Release

*For any* article with publishing_status = NULL, the article should appear in selection list queries.

**Validates: Requirements 3.4**

### Property 8: Success Status Before Record Creation

*For any* successful task execution, the task status should be updated to 'success' and completed_at should be set before the publishing record is created.

**Validates: Requirements 4.1, 4.3**

### Property 9: Success Status Logging

*For any* task transitioning to 'success' status, a log entry should be created indicating the successful completion.

**Validates: Requirements 4.4**

### Property 10: Batch Task Retry Continuation

*For any* batch task that fails with remaining retries, the Batch_Executor should mark it as 'pending' and continue executing the next task in the batch without blocking.

**Validates: Requirements 5.1**

### Property 11: Batch Order Preservation

*For any* batch task that is retried, the task should maintain its original batch_order value.

**Validates: Requirements 5.3**

### Property 12: Batch Completion with Failures

*For any* batch task that reaches max_retries, the Batch_Executor should mark it as 'failed' and continue to the next task.

**Validates: Requirements 5.4**

### Property 13: Transaction Atomicity

*For any* task status update that includes article lock release, both the task update and article update should complete in the same transaction, such that if either fails, both are rolled back.

**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

### Property 14: Concurrent Update Safety

*For any* two concurrent status updates to the same task, the final state should reflect one complete update without data corruption or partial updates.

**Validates: Requirements 6.5**

### Property 15: Retry Task Ordering

*For any* set of pending tasks including retry tasks, the Task_Scheduler should execute them in order of scheduled_at, with retry tasks (retry_count > 0) prioritized.

**Validates: Requirements 7.2**

### Property 16: Duplicate Execution Prevention

*For any* task with status 'running', the Task_Scheduler should not include it in the list of tasks to execute.

**Validates: Requirements 7.4**

### Property 17: Error Message Completeness

*For any* task that fails, the Publishing_Executor should create a log entry containing the error message and set the task's error_message field.

**Validates: Requirements 8.1**

### Property 18: Retry Exhaustion Error Message

*For any* task that reaches max_retries, the error_message should indicate that retry attempts have been exhausted.

**Validates: Requirements 8.3**

### Property 19: Login Error Platform Information

*For any* task that fails during login, the error_message should include the platform name.

**Validates: Requirements 8.5**

## Error Handling

### Error Categories

1. **Login Failures**
   - Cookie authentication failures
   - Form login failures
   - Session expiration
   - Action: Retry with incremented retry_count

2. **Publishing Failures**
   - Content validation errors
   - Platform API errors
   - Network timeouts
   - Action: Retry with incremented retry_count

3. **System Failures**
   - Database connection errors
   - Transaction failures
   - Browser automation errors
   - Action: Retry with incremented retry_count

4. **User Actions**
   - Task cancellation
   - Batch停止
   - Task deletion
   - Action: Update status to 'cancelled', clear article locks

### Error Recovery Strategy

```typescript
// Retry with exponential backoff (handled by scheduler check interval)
if (retry_count < max_retries) {
  status = 'pending';  // Will be picked up by next scheduler check
  error_message = `执行失败，将自动重试 (${retry_count + 1}/${max_retries})`;
} else {
  status = 'failed';
  error_message = `重试次数已用完: ${original_error}`;
  clearArticleLock(article_id);
}
```

### Transaction Rollback

All multi-step operations use transactions:
```typescript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // ... multiple operations ...
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

## Testing Strategy

### Unit Tests

Unit tests will verify specific examples and edge cases:

1. **Scheduler Detection Tests**
   - Test that retry tasks (retry_count > 0) are detected
   - Test that scheduled tasks (scheduled_at <= now) are detected
   - Test that immediate tasks (scheduled_at = null) are detected

2. **Status Transition Tests**
   - Test pending → running → success flow
   - Test pending → running → failed → pending (retry) flow
   - Test pending → cancelled flow

3. **Article Lock Tests**
   - Test lock is cleared on task cancellation
   - Test lock is cleared on task deletion
   - Test lock is cleared on final failure

4. **Error Message Tests**
   - Test error messages include platform name for login failures
   - Test error messages indicate manual cancellation
   - Test error messages indicate retry exhaustion

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

**Property Test Tasks**:

1. **Property 1: Retry Task Detection**
   - Generate: Random tasks with various retry_count and scheduled_at values
   - Verify: Tasks with retry_count > 0 are always included in scheduler results
   - Tag: **Feature: publishing-task-reliability, Property 1: Retry Task Detection**

2. **Property 4: Cancellation Status Update**
   - Generate: Random pending tasks
   - Verify: After cancellation, status='cancelled', error_message set, updated_at updated
   - Tag: **Feature: publishing-task-reliability, Property 4: Cancellation Status Update**

3. **Property 6: Article Lock Release**
   - Generate: Random task cancellations/deletions
   - Verify: Article publishing_status is always cleared
   - Tag: **Feature: publishing-task-reliability, Property 6: Article Lock Release**

4. **Property 13: Transaction Atomicity**
   - Generate: Random task updates with simulated failures
   - Verify: Either both task and article update, or neither updates
   - Tag: **Feature: publishing-task-reliability, Property 13: Transaction Atomicity**

5. **Property 14: Concurrent Update Safety**
   - Generate: Multiple concurrent status updates to same task
   - Verify: Final state is consistent, no partial updates
   - Tag: **Feature: publishing-task-reliability, Property 14: Concurrent Update Safety**

### Integration Tests

Integration tests will verify end-to-end workflows:

1. **Retry Flow Test**
   - Create task → Fail task → Verify retry → Execute retry → Verify success

2. **Batch Cancellation Test**
   - Create batch → Start execution → Cancel batch → Verify all pending tasks cancelled

3. **Article Lock Lifecycle Test**
   - Create task (lock article) → Cancel task → Verify article unlocked → Create new task with same article

### Test Coverage Goals

- Unit tests: 80% code coverage
- Property tests: All 19 correctness properties
- Integration tests: All major workflows
- Edge cases: Boundary conditions, concurrent operations, transaction failures
