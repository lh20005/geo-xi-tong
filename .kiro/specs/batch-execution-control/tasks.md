# Implementation Plan: Batch Execution Control

## Overview

This implementation plan fixes two critical issues in batch execution:
1. Batch stop not responding immediately (currently takes up to 10 seconds)
2. Interval time not being enforced (tasks execute immediately instead of waiting)

The implementation will modify the BatchExecutor to check stop signals more frequently (every 1 second instead of 10 seconds) and add detailed logging to verify interval timing.

## Tasks

- [x] 1. Add stop signal detection method
  - Create `checkStopSignal(batchId)` method in BatchExecutor
  - Query pending task count from database
  - Return true if count is 0, false otherwise
  - Add retry logic for query failures (retry once)
  - Add error logging for failed queries
  - _Requirements: 7.2, 7.3, 7.4, 9.2, 9.3_

- [x]* 1.1 Write property test for stop signal detection
  - **Property 24: Zero Pending Count Interpretation**
  - **Validates: Requirements 7.3**

- [x]* 1.2 Write property test for positive pending count
  - **Property 25: Positive Pending Count Continuation**
  - **Validates: Requirements 7.4**

- [x]* 1.3 Write property test for query retry
  - **Property 31: Query Retry on Failure**
  - **Validates: Requirements 9.2, 9.3**

- [x] 2. Reduce stop check interval constant
  - Change `checkInterval` from 10000ms to 1000ms
  - Add constant `STOP_CHECK_INTERVAL_MS = 1000`
  - Update all references to use the constant
  - _Requirements: 3.1_

- [x]* 2.1 Write property test for stop check frequency
  - **Property 9: Stop Check Frequency**
  - **Validates: Requirements 3.1**

- [x] 3. Add stop signal checks before and after each task
  - Add stop signal check before starting each task in the loop
  - Add stop signal check after task completion
  - Log stop detection with task number
  - Break out of loop if stop detected
  - _Requirements: 1.1, 1.2_

- [x]* 3.1 Write property test for stop detection speed
  - **Property 1: Stop Signal Detection Speed**
  - **Validates: Requirements 1.1**

- [x]* 3.2 Write property test for current task completion
  - **Property 2: Current Task Completion on Stop**
  - **Validates: Requirements 1.2**

- [ ] 4. Improve interval wait implementation
  - [x] 4.1 Extract wait logic into `waitWithStopCheck()` method
    - Accept batchId and intervalMinutes parameters
    - Validate intervalMinutes (handle negative, zero, very large values)
    - Calculate waitMs using formula: intervalMinutes * 60 * 1000
    - Log wait start with current time, interval, and expected next execution time
    - _Requirements: 6.1, 6.2, 6.4, 6.5_

  - [x]* 4.2 Write property test for interval calculation
    - **Property 20: Interval Calculation Correctness**
    - **Validates: Requirements 6.1, 6.2**

  - [x] 4.3 Implement wait loop with frequent stop checks
    - Loop while waitedTime < waitMs
    - Sleep for min(STOP_CHECK_INTERVAL_MS, remaining time)
    - Check stop signal after each sleep
    - If stopped, log early termination with remaining time and return
    - Handle sleep interruptions gracefully
    - _Requirements: 3.1, 3.2, 3.3, 9.4_

  - [x]* 4.4 Write property test for immediate wait termination
    - **Property 3: Immediate Wait Termination on Stop**
    - **Validates: Requirements 1.3, 3.2, 3.4**

  - [x]* 4.5 Write property test for early termination logging
    - **Property 10: Early Termination Logging**
    - **Validates: Requirements 3.3**

  - [x]* 4.6 Write property test for sleep interruption handling
    - **Property 32: Sleep Interruption Handling**
    - **Validates: Requirements 9.4**

  - [x] 4.4 Add final stop check after wait completes
    - Check stop signal one final time before returning
    - Log if stopped after wait completion
    - _Requirements: 3.5_

  - [x]* 4.7 Write property test for final stop check
    - **Property 11: Final Stop Check Before Task**
    - **Validates: Requirements 3.5**

  - [x] 4.5 Log wait completion with timing details
    - Calculate actual wait time
    - Log expected vs actual wait time
    - Log completion message
    - _Requirements: 2.5_

  - [x]* 4.8 Write property test for wait completion logging
    - **Property 8: Wait Completion Logging**
    - **Validates: Requirements 2.5**

- [ ] 5. Add detailed interval logging
  - [x] 5.1 Log wait start information
    - Log interval in minutes
    - Log current timestamp
    - Log expected next execution timestamp
    - Log wait duration in milliseconds
    - _Requirements: 2.4, 6.3_

  - [x]* 5.2 Write property test for wait start logging
    - **Property 7: Wait Start Logging**
    - **Validates: Requirements 2.4**

  - [x]* 5.3 Write property test for wait time logging completeness
    - **Property 21: Wait Time Logging Completeness**
    - **Validates: Requirements 6.3**

  - [x] 5.2 Add logging for zero/null intervals
    - Log when interval is 0 or null
    - Log "no wait needed, executing next task immediately"
    - _Requirements: 2.3_

- [ ] 6. Verify task status before execution
  - [x] 6.1 Query fresh task status from database
    - Call `publishingService.getTaskById(task.id)` before execution
    - Do not use cached task data
    - _Requirements: 4.1, 4.5_

  - [x]* 6.2 Write property test for fresh task status query
    - **Property 12: Fresh Task Status Query**
    - **Validates: Requirements 4.1, 4.5, 7.5**

  - [x] 6.2 Skip non-pending tasks
    - Check if status is not 'pending'
    - Log skip event with current status
    - Continue to next task
    - _Requirements: 4.2, 4.3_

  - [x]* 6.3 Write property test for non-pending task skipping
    - **Property 13: Non-Pending Task Skipping**
    - **Validates: Requirements 4.2**

  - [x]* 6.4 Write property test for skip event logging
    - **Property 14: Skip Event Logging**
    - **Validates: Requirements 4.3**

  - [x] 6.3 Handle all-skipped batches
    - Allow batch to complete normally if all tasks skipped
    - Log completion message
    - _Requirements: 4.4_

  - [x]* 6.5 Write property test for all-skipped batch completion
    - **Property 15: All-Skipped Batch Completion**
    - **Validates: Requirements 4.4**

- [ ] 7. Improve executing batches set management
  - [x] 7.1 Add batch to executing set at start
    - Add batch_id to executingBatches set before any tasks execute
    - Log addition to set
    - _Requirements: 5.1_

  - [x]* 7.2 Write property test for executing set addition
    - **Property 16: Executing Set Addition on Start**
    - **Validates: Requirements 5.1**

  - [x] 7.2 Remove batch from executing set on completion
    - Remove batch_id in finally block
    - Log removal from set
    - Ensure removal happens even on error
    - _Requirements: 1.5, 5.2, 5.5_

  - [x]* 7.3 Write property test for executing set cleanup
    - **Property 5: Executing Set Cleanup on Stop**
    - **Validates: Requirements 1.5, 5.2**

  - [x]* 7.4 Write property test for executing set cleanup on error
    - **Property 19: Executing Set Cleanup on Error**
    - **Validates: Requirements 5.5, 9.5**

  - [x] 7.3 Prevent duplicate batch execution
    - Check if batch_id is already in executingBatches set
    - If yes, log warning and return without executing
    - _Requirements: 5.3_

  - [x]* 7.5 Write property test for duplicate execution prevention
    - **Property 17: Duplicate Execution Prevention**
    - **Validates: Requirements 5.3**

  - [x] 7.4 Verify getExecutingBatches() accuracy
    - Ensure method returns current set contents
    - Add unit test to verify accuracy
    - _Requirements: 5.4_

  - [x]* 7.6 Write property test for executing batches query
    - **Property 18: Executing Batches Query Accuracy**
    - **Validates: Requirements 5.4**

- [ ] 8. Add batch completion logging
  - [x] 8.1 Create `logBatchSummary()` method
    - Query final status counts (success, failed, cancelled, pending)
    - Log total task count
    - Log counts for each status
    - _Requirements: 8.1, 8.3_

  - [x]* 8.2 Write property test for completion logging
    - **Property 26: Completion Logging with Task Count**
    - **Validates: Requirements 8.1**

  - [x]* 8.3 Write property test for final status query
    - **Property 28: Final Status Query on Completion**
    - **Validates: Requirements 8.3**

  - [x] 8.2 Add execution duration tracking
    - Record start time at batch start
    - Calculate duration at batch end
    - Log duration in completion message
    - _Requirements: 8.4_

  - [x]* 8.4 Write property test for duration logging
    - **Property 29: Completion Duration Logging**
    - **Validates: Requirements 8.4**

  - [x] 8.3 Add early stop logging
    - When stopped early, log completed and remaining task counts
    - Include stop reason in log
    - _Requirements: 8.2_

  - [x]* 8.5 Write property test for early stop logging
    - **Property 27: Early Stop Logging with Counts**
    - **Validates: Requirements 8.2**

  - [x] 8.4 Add stop event logging
    - Log when stop signal is detected
    - Include timestamp in log
    - _Requirements: 1.4_

  - [x]* 8.6 Write property test for stop event logging
    - **Property 4: Stop Event Logging**
    - **Validates: Requirements 1.4**

- [ ] 9. Add error handling improvements
  - [x] 9.1 Handle errors during interval wait
    - Wrap wait logic in try-catch
    - Log errors but continue to next task
    - _Requirements: 9.1_

  - [x]* 9.2 Write property test for error logging and continuation
    - **Property 30: Error Logging and Continuation**
    - **Validates: Requirements 9.1**

  - [x] 9.2 Ensure cleanup in finally block
    - Move executingBatches.delete() to finally block
    - Ensure it runs even on exceptions
    - _Requirements: 5.5, 9.5_

- [ ] 10. Verify concurrent batch execution
  - [x] 10.1 Ensure batches execute concurrently
    - Verify checkAndExecuteBatches() starts multiple batches
    - Verify batches don't block each other
    - _Requirements: 10.1_

  - [x]* 10.2 Write property test for concurrent execution
    - **Property 33: Concurrent Batch Execution**
    - **Validates: Requirements 10.1**

  - [x] 10.2 Verify batch stop isolation
    - Ensure stopping one batch doesn't affect others
    - Verify stop signal query filters by batch_id
    - _Requirements: 10.2, 10.3_

  - [x]* 10.3 Write property test for batch stop isolation
    - **Property 34: Batch Stop Isolation**
    - **Validates: Requirements 10.2**

  - [x]* 10.4 Write property test for stop signal query scope
    - **Property 35: Stop Signal Query Scope**
    - **Validates: Requirements 10.3**

  - [x] 10.3 Add batch_id to all log messages
    - Ensure all logs include batch_id for identification
    - _Requirements: 10.4_

  - [x]* 10.5 Write property test for batch ID in logs
    - **Property 36: Batch ID in Logs**
    - **Validates: Requirements 10.4**

  - [x] 10.4 Verify non-blocking completion
    - Ensure batch completion doesn't block other batches
    - _Requirements: 10.5_

  - [x]* 10.6 Write property test for non-blocking completion
    - **Property 37: Non-Blocking Batch Completion**
    - **Validates: Requirements 10.5**

- [x] 11. Checkpoint - Verify core functionality
  - Test batch stop during task execution
  - Test batch stop during interval wait
  - Test interval timing accuracy
  - Ensure all tests pass, ask the user if questions arise

- [ ] 12. Integration testing
  - [x] 12.1 Write integration test for batch stop during execution
    - Create batch with 3 tasks
    - Start execution, stop during task 2
    - Verify task 2 completes, task 3 doesn't start
    - _Requirements: 1.1, 1.2_

  - [x] 12.2 Write integration test for batch stop during wait
    - Create batch with 2 tasks, 5 minute interval
    - Start execution, stop 1 minute into wait
    - Verify wait terminates within 2 seconds
    - Verify task 2 doesn't start
    - _Requirements: 1.3, 3.2_

  - [x] 12.3 Write integration test for interval timing
    - Create batch with 2 tasks, 2 minute interval
    - Execute batch, measure time between tasks
    - Verify approximately 2 minutes (within 5 seconds)
    - _Requirements: 2.1, 2.2_

  - [x] 12.4 Write integration test for concurrent batches
    - Create 3 batches with different tasks
    - Start all batches
    - Stop batch 2
    - Verify batches 1 and 3 continue, batch 2 stops
    - _Requirements: 10.1, 10.2_

- [x] 13. Final checkpoint - Ensure all tests pass
  - Run all unit tests and property tests
  - Run all integration tests
  - Verify batch stop responds within 2 seconds
  - Verify interval timing is accurate
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties with 100 iterations each
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end workflows
- The stop check interval is reduced from 10 seconds to 1 second for faster response
- Detailed logging is added to help debug interval timing issues
- All database queries use fresh data, not cached results
