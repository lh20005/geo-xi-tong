# Requirements Document

## Introduction

This document specifies requirements for fixing critical issues in the batch execution control system. The system currently has two major problems: batch tasks continue executing after the user clicks "Stop Batch", and the configured interval time between tasks is not being respected (tasks execute immediately instead of waiting for the specified interval).

## Glossary

- **Batch**: A group of publishing tasks that execute sequentially with intervals
- **Batch_Executor**: The service that executes batch tasks sequentially
- **Batch_Stop**: User action to cancel all pending tasks in a batch
- **Interval_Time**: The configured wait time (in minutes) between consecutive task executions in a batch
- **Task_Status**: The current state of a task (pending, running, success, failed, cancelled)
- **Executing_Batch**: A batch that is currently being processed by the Batch_Executor
- **Stop_Signal**: The mechanism to signal a running batch to stop execution

## Requirements

### Requirement 1: Immediate Batch Stop Response

**User Story:** As a user, I want the batch to stop immediately when I click "Stop Batch", so that no additional tasks are executed after I request the stop.

#### Acceptance Criteria

1. WHEN a user clicks "Stop Batch", THE Batch_Executor SHALL detect the stop signal within 1 second
2. WHEN a stop signal is detected during task execution, THE Batch_Executor SHALL complete the current task and SHALL NOT start the next task
3. WHEN a stop signal is detected during interval waiting, THE Batch_Executor SHALL terminate the wait immediately and SHALL NOT start the next task
4. WHEN a batch is stopped, THE Batch_Executor SHALL log the stop event with timestamp
5. WHEN a batch stops, THE Batch_Executor SHALL remove the batch from the executing batches set

### Requirement 2: Interval Time Enforcement

**User Story:** As a user, I want tasks to execute with the configured interval time between them, so that I can control the publishing rate and avoid platform rate limits.

#### Acceptance Criteria

1. WHEN a task completes successfully, THE Batch_Executor SHALL wait for the configured interval_minutes before starting the next task
2. WHEN a task fails, THE Batch_Executor SHALL wait for the configured interval_minutes before starting the next task
3. WHEN interval_minutes is 0 or null, THE Batch_Executor SHALL start the next task immediately
4. WHEN waiting for interval time, THE Batch_Executor SHALL log the wait start time and expected next execution time
5. WHEN interval wait completes, THE Batch_Executor SHALL log the wait completion before starting the next task

### Requirement 3: Stop Signal Detection During Wait

**User Story:** As a user, I want the batch to stop immediately even during the interval wait period, so that I don't have to wait for the full interval before the batch stops.

#### Acceptance Criteria

1. WHEN waiting for interval time, THE Batch_Executor SHALL check for stop signal every 5 seconds
2. WHEN a stop signal is detected during wait, THE Batch_Executor SHALL terminate the wait immediately
3. WHEN terminating wait early, THE Batch_Executor SHALL log the early termination with remaining wait time
4. WHEN wait is terminated early, THE Batch_Executor SHALL NOT execute the next task
5. WHEN wait completes normally, THE Batch_Executor SHALL verify stop signal one final time before starting next task

### Requirement 4: Task Status Verification Before Execution

**User Story:** As a developer, I want the batch executor to verify task status before execution, so that cancelled or modified tasks are not executed.

#### Acceptance Criteria

1. WHEN starting a task, THE Batch_Executor SHALL query the current task status from database
2. WHEN a task status is not 'pending', THE Batch_Executor SHALL skip the task and continue to next task
3. WHEN a task is skipped, THE Batch_Executor SHALL log the skip event with current status
4. WHEN all tasks in a batch are skipped or cancelled, THE Batch_Executor SHALL complete the batch execution
5. WHEN verifying task status, THE Batch_Executor SHALL use the latest data from database, not cached data

### Requirement 5: Batch Execution State Tracking

**User Story:** As a system administrator, I want to track which batches are currently executing, so that I can monitor system state and prevent duplicate execution.

#### Acceptance Criteria

1. WHEN a batch starts executing, THE Batch_Executor SHALL add the batch_id to the executing batches set
2. WHEN a batch completes or stops, THE Batch_Executor SHALL remove the batch_id from the executing batches set
3. WHEN a batch is already executing, THE Batch_Executor SHALL NOT start a duplicate execution
4. WHEN checking executing batches, THE System SHALL return the list of currently executing batch_ids
5. WHEN a batch execution fails with exception, THE Batch_Executor SHALL remove the batch_id from executing batches set in finally block

### Requirement 6: Interval Time Calculation Accuracy

**User Story:** As a user, I want the interval time to be calculated accurately, so that tasks execute at the expected times.

#### Acceptance Criteria

1. WHEN calculating wait time, THE Batch_Executor SHALL use the interval_minutes value from the current task
2. WHEN converting minutes to milliseconds, THE Batch_Executor SHALL use the formula: minutes * 60 * 1000
3. WHEN logging wait time, THE Batch_Executor SHALL display both minutes and the calculated next execution timestamp
4. WHEN interval_minutes is negative, THE Batch_Executor SHALL treat it as 0 (no wait)
5. WHEN interval_minutes is greater than 1440 (24 hours), THE Batch_Executor SHALL log a warning but still honor the value

### Requirement 7: Stop Signal Persistence

**User Story:** As a developer, I want the stop signal to be persisted in the database, so that the batch executor can reliably detect stop requests.

#### Acceptance Criteria

1. WHEN a user stops a batch, THE Publishing_Service SHALL update all pending tasks to 'cancelled' status in a single transaction
2. WHEN checking for stop signal, THE Batch_Executor SHALL query the count of pending tasks in the batch
3. WHEN pending task count is 0, THE Batch_Executor SHALL interpret this as a stop signal
4. WHEN pending task count is greater than 0, THE Batch_Executor SHALL continue execution
5. WHEN querying pending task count, THE Batch_Executor SHALL use a fresh database query, not cached results

### Requirement 8: Graceful Batch Completion

**User Story:** As a user, I want to see clear completion status for batches, so that I know when all tasks have finished or been stopped.

#### Acceptance Criteria

1. WHEN a batch completes all tasks, THE Batch_Executor SHALL log a completion message with total task count
2. WHEN a batch is stopped early, THE Batch_Executor SHALL log a stop message with completed and remaining task counts
3. WHEN a batch completes, THE Batch_Executor SHALL query final task status counts (success, failed, cancelled)
4. WHEN logging batch completion, THE Batch_Executor SHALL include execution duration
5. WHEN a batch completes, THE System SHALL make the batch status visible in the UI immediately

### Requirement 9: Error Handling During Interval Wait

**User Story:** As a developer, I want errors during interval wait to be handled gracefully, so that one task failure doesn't break the entire batch.

#### Acceptance Criteria

1. WHEN an error occurs during interval wait, THE Batch_Executor SHALL log the error and continue to next task
2. WHEN database query fails during stop signal check, THE Batch_Executor SHALL retry the query once
3. WHEN retry fails, THE Batch_Executor SHALL assume no stop signal and continue execution
4. WHEN sleep operation is interrupted, THE Batch_Executor SHALL handle the interruption and check stop signal
5. WHEN any error occurs, THE Batch_Executor SHALL ensure the batch_id is removed from executing batches set

### Requirement 10: Concurrent Batch Execution

**User Story:** As a system administrator, I want multiple batches to execute concurrently without interfering with each other, so that the system can handle multiple publishing workflows simultaneously.

#### Acceptance Criteria

1. WHEN multiple batches have pending tasks, THE Batch_Executor SHALL execute them concurrently
2. WHEN one batch is stopped, THE Batch_Executor SHALL NOT affect other executing batches
3. WHEN checking stop signal, THE Batch_Executor SHALL only check the current batch's pending task count
4. WHEN logging batch events, THE Batch_Executor SHALL include batch_id to distinguish between batches
5. WHEN a batch completes, THE Batch_Executor SHALL NOT block other batches from starting or continuing
