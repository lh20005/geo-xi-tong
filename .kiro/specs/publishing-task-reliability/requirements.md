# Requirements Document

## Introduction

This document specifies requirements for improving the reliability and correctness of the publishing task system. The system currently has several critical issues related to task retry mechanisms, status updates, and resource cleanup that need to be addressed.

## Glossary

- **Publishing_Task**: A scheduled task to publish an article to a platform
- **Batch**: A group of publishing tasks that execute sequentially with intervals
- **Task_Scheduler**: The service that checks and executes scheduled tasks
- **Publishing_Executor**: The service that executes individual publishing tasks
- **Batch_Executor**: The service that executes batch tasks sequentially
- **Task_Status**: The current state of a task (pending, running, success, failed, cancelled)
- **Retry_Mechanism**: The system that automatically retries failed tasks
- **Article_Lock**: The publishing_status field that prevents articles from appearing in selection lists

## Requirements

### Requirement 1: Automatic Retry Mechanism

**User Story:** As a system administrator, I want failed tasks to automatically retry according to their retry configuration, so that temporary failures don't require manual intervention.

#### Acceptance Criteria

1. WHEN a task fails with retry count less than max retries, THE Task_Scheduler SHALL schedule the task for retry within the next check interval
2. WHEN a task is marked as pending after failure, THE Task_Scheduler SHALL detect and execute it in the next check cycle
3. WHEN a task fails due to "Cookie登录失败", THE Publishing_Executor SHALL increment retry count and set status to pending
4. WHEN the retry count reaches max retries, THE Publishing_Executor SHALL set task status to failed and SHALL NOT retry again
5. WHEN a task is retried, THE Publishing_Executor SHALL log the retry attempt with current retry count

### Requirement 2: Task Cancellation Status Update

**User Story:** As a user, I want cancelled tasks to show "cancelled" status immediately, so that I can see which tasks were manually stopped.

#### Acceptance Criteria

1. WHEN a user cancels a pending task, THE Publishing_Service SHALL update task status to cancelled
2. WHEN a user stops a batch, THE Batch_Executor SHALL update all pending tasks in the batch to cancelled status
3. WHEN a task is cancelled, THE Publishing_Service SHALL set error_message to indicate manual cancellation
4. WHEN a task status is updated to cancelled, THE Publishing_Service SHALL set updated_at to current timestamp
5. WHEN displaying task lists, THE System SHALL show cancelled tasks with their cancelled status

### Requirement 3: Article Lock Release on Cancellation

**User Story:** As a user, I want articles to return to the selection list immediately after task cancellation, so that I can reuse them for other publishing tasks.

#### Acceptance Criteria

1. WHEN a task is cancelled, THE Publishing_Service SHALL clear the article's publishing_status field
2. WHEN a batch is stopped, THE Batch_Executor SHALL clear publishing_status for all articles in cancelled tasks
3. WHEN a task is deleted, THE Publishing_Service SHALL clear the article's publishing_status field
4. WHEN an article's publishing_status is cleared, THE System SHALL make the article visible in selection lists
5. WHEN multiple tasks for the same article are cancelled, THE System SHALL clear publishing_status only once

### Requirement 4: Task Status Update After Completion

**User Story:** As a user, I want task status to update to "success" immediately after publishing completes, so that I can see accurate task progress.

#### Acceptance Criteria

1. WHEN a task completes successfully, THE Publishing_Executor SHALL update task status to success before creating publishing record
2. WHEN a publishing record is created, THE Publishing_Executor SHALL verify task status is already set to success
3. WHEN task status is updated to success, THE Publishing_Executor SHALL set completed_at to current timestamp
4. WHEN a task transitions to success status, THE Publishing_Executor SHALL log the status change
5. WHEN displaying task details, THE System SHALL show success status immediately after completion

### Requirement 5: Batch Task Retry Handling

**User Story:** As a system administrator, I want batch tasks to retry failed tasks without blocking subsequent tasks, so that one failure doesn't stop the entire batch.

#### Acceptance Criteria

1. WHEN a batch task fails with remaining retries, THE Batch_Executor SHALL mark it as pending and continue to next task
2. WHEN a batch completes, THE Task_Scheduler SHALL detect and retry any pending tasks from that batch
3. WHEN a batch task is retried, THE System SHALL respect the original batch order
4. WHEN a batch task reaches max retries, THE Batch_Executor SHALL mark it as failed and continue to next task
5. WHEN all batch tasks complete or fail, THE Batch_Executor SHALL log the final batch status

### Requirement 6: Task State Consistency

**User Story:** As a developer, I want task state transitions to be atomic and consistent, so that the system maintains data integrity.

#### Acceptance Criteria

1. WHEN updating task status, THE Publishing_Service SHALL use database transactions
2. WHEN a task status changes, THE Publishing_Service SHALL update both status and updated_at in the same transaction
3. WHEN clearing article locks, THE Publishing_Service SHALL update articles table in the same transaction as task update
4. WHEN a transaction fails, THE Publishing_Service SHALL rollback all changes
5. WHEN concurrent status updates occur, THE System SHALL handle them without data corruption

### Requirement 7: Retry Scheduling

**User Story:** As a system administrator, I want failed tasks to be retried promptly, so that temporary issues are resolved quickly.

#### Acceptance Criteria

1. WHEN a task is marked for retry, THE Task_Scheduler SHALL detect it within 10 seconds
2. WHEN multiple tasks need retry, THE Task_Scheduler SHALL execute them in order of scheduled_at
3. WHEN a retry task is detected, THE Task_Scheduler SHALL execute it immediately if no other task is running
4. WHEN a task is being retried, THE Task_Scheduler SHALL not schedule it again until completion
5. WHEN the scheduler checks for tasks, THE System SHALL include both new tasks and retry tasks

### Requirement 8: Error Message Clarity

**User Story:** As a user, I want clear error messages for failed tasks, so that I can understand what went wrong and take appropriate action.

#### Acceptance Criteria

1. WHEN a task fails, THE Publishing_Executor SHALL log the specific error message
2. WHEN a task is cancelled, THE Publishing_Service SHALL set error_message to indicate manual cancellation
3. WHEN a task reaches max retries, THE Publishing_Executor SHALL set error_message to indicate retry exhaustion
4. WHEN displaying task errors, THE System SHALL show both error_message and retry count
5. WHEN a task fails during login, THE Publishing_Executor SHALL include platform name in error message
