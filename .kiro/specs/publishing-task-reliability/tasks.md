# Implementation Plan: Publishing Task Reliability

## Overview

This implementation plan addresses four critical issues in the publishing task system:
1. Retry mechanism not detecting failed tasks for retry
2. Cancelled task status not displaying correctly
3. Article locks not being released on task cancellation
4. Task status not updating to success after completion

The implementation will be done incrementally, with testing at each step to ensure correctness.

## Tasks

- [x] 1. Fix retry task detection in TaskScheduler
  - Modify `getPendingScheduledTasks()` to include retry tasks (retry_count > 0)
  - Update query to prioritize retry tasks over new tasks
  - Add logging to show when retry tasks are detected
  - _Requirements: 1.1, 1.2, 7.5_

- [x] 1.1 Write property test for retry task detection
  - **Property 1: Retry Task Detection**
  - **Validates: Requirements 1.1, 1.2, 7.5**

- [x] 1.2 Write unit tests for scheduler query logic
  - Test retry tasks are included in results
  - Test scheduled tasks are included when scheduled_at <= now
  - Test immediate tasks (scheduled_at = null) are included
  - _Requirements: 1.1, 1.2_

- [x] 2. Improve error handling in PublishingExecutor
  - [x] 2.1 Extract failure handling into separate method
    - Create `handleTaskFailure()` method
    - Implement retry count increment logic
    - Implement status update logic based on retry count
    - Add detailed error logging with retry information
    - _Requirements: 1.3, 1.4, 1.5_

  - [x] 2.2 Write property test for retry count increment
    - **Property 2: Retry Count Increment**
    - **Validates: Requirements 1.3, 1.5**

  - [x] 2.3 Write property test for retry exhaustion
    - **Property 3: Retry Exhaustion**
    - **Validates: Requirements 1.4**

  - [x] 2.4 Add article lock cleanup on final failure
    - Create `clearArticleLock()` method
    - Call it when retry count reaches max_retries
    - Call it on task cancellation
    - _Requirements: 3.1, 3.3_

  - [x] 2.5 Write property test for article lock release
    - **Property 6: Article Lock Release on Cancellation**
    - **Validates: Requirements 3.1, 3.2, 3.3, 6.3**

- [x] 3. Ensure atomic status updates in PublishingService
  - [x] 3.1 Review and verify cancelTask transaction
    - Verify transaction wraps both task update and article lock clear
    - Ensure error_message is set correctly
    - Ensure updated_at is set
    - Add logging for cancellation
    - _Requirements: 2.1, 2.3, 2.4, 6.1, 6.2, 6.3_

  - [x] 3.2 Write property test for cancellation status update
    - **Property 4: Cancellation Status Update**
    - **Validates: Requirements 2.1, 2.3, 2.4, 8.2**

  - [x] 3.3 Write property test for transaction atomicity
    - **Property 13: Transaction Atomicity**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

  - [x] 3.2 Enhance updateTaskStatus method
    - Ensure completed_at is set for success/failed/cancelled status
    - Ensure started_at is set for running status
    - Ensure updated_at is always set
    - _Requirements: 4.3, 2.4_

  - [x] 3.4 Write unit tests for updateTaskStatus
    - Test timestamp setting for each status transition
    - Test error_message setting
    - _Requirements: 4.3, 2.4_

- [x] 4. Fix status update timing in PublishingExecutor
  - [x] 4.1 Reorder operations in executeTask
    - Ensure status update to 'success' happens before createPublishingRecord
    - Add log message after status update
    - Add log message after record creation
    - Verify completed_at is set
    - _Requirements: 4.1, 4.3, 4.4_

  - [x] 4.2 Write property test for success status before record
    - **Property 8: Success Status Before Record Creation**
    - **Validates: Requirements 4.1, 4.3**

  - [x] 4.3 Write property test for success status logging
    - **Property 9: Success Status Logging**
    - **Validates: Requirements 4.4**

- [x] 5. Enhance batch task retry handling
  - [x] 5.1 Update BatchExecutor to handle retry tasks
    - Ensure failed batch tasks are marked as pending (not failed)
    - Continue to next task after failure
    - Add logging for batch task failures
    - _Requirements: 5.1, 5.4_

  - [x] 5.2 Write property test for batch task retry continuation
    - **Property 10: Batch Task Retry Continuation**
    - **Validates: Requirements 5.1**

  - [x] 5.3 Write property test for batch order preservation
    - **Property 11: Batch Order Preservation**
    - **Validates: Requirements 5.3**

  - [x] 5.4 Write property test for batch completion with failures
    - **Property 12: Batch Completion with Failures**
    - **Validates: Requirements 5.4**

  - [x] 5.2 Verify stopBatch clears article locks
    - Review transaction in stopBatch
    - Ensure all cancelled tasks have their article locks cleared
    - Add logging for article lock cleanup
    - _Requirements: 2.2, 3.2_

  - [x] 5.5 Write property test for batch cancellation
    - **Property 5: Batch Cancellation**
    - **Validates: Requirements 2.2**

- [x] 6. Add comprehensive error messages
  - [x] 6.1 Enhance error messages in PublishingExecutor
    - Include platform name in login error messages
    - Include retry count in failure messages
    - Indicate retry exhaustion in final failure message
    - Set clear cancellation message
    - _Requirements: 8.1, 8.2, 8.3, 8.5_

  - [x] 6.2 Write property test for error message completeness
    - **Property 17: Error Message Completeness**
    - **Validates: Requirements 8.1**

  - [x] 6.3 Write property test for retry exhaustion message
    - **Property 18: Retry Exhaustion Error Message**
    - **Validates: Requirements 8.3**

  - [x] 6.4 Write property test for login error platform info
    - **Property 19: Login Error Platform Information**
    - **Validates: Requirements 8.5**

- [x] 7. Add article visibility query verification
  - [x] 7.1 Verify article selection queries exclude locked articles
    - Review queries that fetch articles for selection
    - Ensure they filter WHERE publishing_status IS NULL
    - Add index on publishing_status if needed
    - _Requirements: 3.4_

  - [x] 7.2 Write property test for article visibility
    - **Property 7: Article Visibility After Lock Release**
    - **Validates: Requirements 3.4**

- [x] 8. Add concurrency safety tests
  - [x] 8.1 Write property test for concurrent update safety
    - **Property 14: Concurrent Update Safety**
    - **Validates: Requirements 6.5**

  - [x] 8.2 Write property test for duplicate execution prevention
    - **Property 16: Duplicate Execution Prevention**
    - **Validates: Requirements 7.4**

  - [x] 8.3 Write property test for retry task ordering
    - **Property 15: Retry Task Ordering**
    - **Validates: Requirements 7.2**

- [x] 9. Checkpoint - Verify all fixes work together
  - Run all unit tests and property tests
  - Test retry flow end-to-end
  - Test cancellation flow end-to-end
  - Test batch execution with failures
  - Ensure all tests pass, ask the user if questions arise

- [x] 10. Integration testing
  - [x] 10.1 Write integration test for retry flow
    - Create task → Fail task → Verify retry scheduled → Execute retry → Verify success
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 10.2 Write integration test for batch cancellation
    - Create batch → Start execution → Cancel batch → Verify all pending tasks cancelled → Verify article locks released
    - _Requirements: 2.2, 3.2_

  - [x] 10.3 Write integration test for article lock lifecycle
    - Create task (lock article) → Cancel task → Verify article unlocked → Create new task with same article → Verify success
    - _Requirements: 3.1, 3.4_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise

## Notes

- All tasks are required for comprehensive testing and reliability
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties with 100 iterations each
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end workflows
- All database operations use transactions to ensure atomicity
- Error messages include context (platform name, retry count) for debugging
