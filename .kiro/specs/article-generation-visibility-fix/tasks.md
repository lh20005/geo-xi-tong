# Implementation Plan

- [x] 1. Enhance AI Service with retry logic and increased timeout
  - Modify AIService class to accept timeout and maxRetries configuration parameters
  - Implement callAIWithRetry method with exponential backoff (5s, 10s delays)
  - Increase default timeout from 60s to 120s
  - Add detailed error logging for retry attempts
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 1.1 Write property test for AI retry attempts
  - **Property 6: AI retry attempts**
  - **Validates: Requirements 3.2**

- [x] 2. Improve article generation error handling
  - Modify generateSingleArticle to return ArticleGenerationResult with success/error fields
  - Update executeTask to continue processing articles when individual generation fails
  - Collect error messages for failed articles
  - Update task status logic: mark as 'completed' if any articles succeed, 'failed' if all fail
  - Ensure zero articles generated results in 'failed' status
  - _Requirements: 1.4, 3.4, 4.4_

- [x] 2.1 Write property test for zero articles failure
  - **Property 3: Zero articles means failure**
  - **Validates: Requirements 1.4**

- [x] 2.2 Write property test for failure continues processing
  - **Property 7: Failure continues processing**
  - **Validates: Requirements 3.4, 4.4**

- [x] 3. Fix progress tracking
  - Verify updateTaskProgress correctly calculates percentage as Math.round((generated/requested) * 100)
  - Ensure progress is updated after each successful article generation
  - _Requirements: 4.1_

- [x] 3.1 Write property test for progress calculation
  - **Property 8: Progress calculation accuracy**
  - **Validates: Requirements 4.1**

- [ ] 4. Enhance retry functionality
  - Verify retryTask method resets status to 'pending'
  - Ensure retryTask clears error_message field
  - Verify retryTask preserves all configuration fields (distillation_id, album_id, knowledge_base_id, article_setting_id, requested_count)
  - _Requirements: 2.2, 2.3, 2.4_

- [ ] 4.1 Write property test for retry preserves configuration
  - **Property 4: Retry preserves configuration**
  - **Validates: Requirements 2.3**

- [ ] 4.2 Write property test for retry clears error state
  - **Property 5: Retry clears error state**
  - **Validates: Requirements 2.2, 2.4**

- [x] 5. Add article filtering by task ID
  - Modify GET /api/articles endpoint to accept optional taskId query parameter
  - Update article list query to filter by task_id when parameter is provided
  - Ensure filtered results only include articles matching the task ID
  - _Requirements: 5.3_

- [x] 5.1 Write property test for article filtering
  - **Property 11: Article filtering correctness**
  - **Validates: Requirements 5.3**

- [ ] 6. Enhance frontend task status display
  - Add TaskStatusBadge component to display status with appropriate colors (green=completed, red=failed, blue=running, gray=pending)
  - Display error messages in task detail view for failed tasks
  - Show progress as "X of Y articles generated" format
  - Add conditional "View Articles" button when generated_count > 0
  - _Requirements: 1.1, 1.2, 4.2, 5.1_

- [ ] 6.1 Write property test for failed task status display
  - **Property 1: Failed task status display**
  - **Validates: Requirements 1.1, 2.1**

- [ ] 6.2 Write property test for error message visibility
  - **Property 2: Error message visibility**
  - **Validates: Requirements 1.2**

- [ ] 6.3 Write property test for progress display format
  - **Property 9: Progress display format**
  - **Validates: Requirements 4.2**

- [ ] 6.4 Write property test for view articles button visibility
  - **Property 10: View articles button visibility**
  - **Validates: Requirements 5.1**

- [ ] 7. Implement retry button in frontend
  - Add "Retry" button to task detail view for failed tasks
  - Implement retry handler that calls POST /api/article-generation/tasks/:id/retry
  - Show loading state during retry
  - Refresh task list after retry is initiated
  - _Requirements: 2.1, 2.2_

- [ ] 8. Implement view articles navigation
  - Add "View Articles" button to task detail view when articles exist
  - Implement navigation to /articles?taskId={taskId}
  - Update ArticleListPage to read taskId from URL query parameters
  - Display filter indicator showing "Showing articles from Task #{taskId}"
  - Add "Clear Filter" button to return to all articles view
  - Handle empty state when task has no articles
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 9. Add auto-refresh for running tasks
  - Implement useEffect hook to poll task status every 5 seconds when status is 'running'
  - Clear interval when task completes or component unmounts
  - Update task list with latest status and progress
  - _Requirements: 4.3_

- [ ] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
