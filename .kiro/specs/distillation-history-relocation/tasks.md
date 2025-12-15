# Implementation Plan

- [x] 1. Phase 1: Add history functionality to DistillationPage
  - [x] 1.1 Add history state and selectedRecordId state to DistillationPage component
    - Import necessary types and hooks
    - Add `history` state array for storing history records
    - Add `selectedRecordId` state for tracking the currently selected record
    - _Requirements: 1.1, 5.4_

  - [x] 1.2 Implement loadHistory function in DistillationPage
    - Create async function to fetch history from `/api/distillation/history`
    - Update history state with fetched data
    - Add error handling for failed API calls
    - _Requirements: 1.1, 5.4_

  - [x] 1.3 Implement handleViewHistory function in DistillationPage
    - Create async function to fetch record details from `/api/distillation/:id`
    - Save result to LocalStorage using existing utility
    - Navigate to `/distillation-results` route
    - Update selectedRecordId state
    - _Requirements: 1.3_

  - [x] 1.4 Implement handleDeleteRecord function in DistillationPage
    - Create function to show confirmation modal
    - Call DELETE `/api/distillation/:id` on confirmation
    - Refresh history list after successful deletion
    - Clear LocalStorage if deleted record is currently selected
    - _Requirements: 1.5_

  - [x] 1.5 Implement handleEditKeyword function in DistillationPage
    - Create function to show modal with input field
    - Call PATCH `/api/distillation/:id` with new keyword
    - Refresh history list after successful update
    - Update LocalStorage if edited record is currently selected
    - _Requirements: 1.4_

  - [x] 1.6 Implement handleDeleteAll function in DistillationPage
    - Create function to show confirmation modal with warning
    - Call DELETE `/api/distillation/all/records` on confirmation
    - Clear history state
    - Clear LocalStorage
    - Display success message with deleted count
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

  - [x] 1.7 Add useEffect to load history and selected record on mount
    - Call loadHistory on component mount
    - Load selected record from LocalStorage
    - Set selectedRecordId if record exists
    - _Requirements: 5.4, 5.5_

  - [x] 1.8 Add history table Card component to DistillationPage JSX
    - Add Card with "蒸馏历史" title and FileTextOutlined icon
    - Add refresh button and conditional delete all button in Card extra
    - Include Table component with all columns (keyword, topic_count, provider, created_at, actions)
    - Add Empty component for empty state
    - Add rowClassName to highlight selected record
    - Position below the keyword input section with appropriate spacing
    - _Requirements: 1.1, 1.2, 4.1, 5.5_

  - [ ]* 1.9 Write property test for successful distillation LocalStorage save
    - **Property 1: Successful distillation saves to LocalStorage**
    - **Validates: Requirements 3.1**
    - Generate random valid distillation result data
    - Verify all required fields are saved to LocalStorage
    - Run 100 iterations

  - [ ]* 1.10 Write property test for delete all button visibility
    - **Property 4: Delete all button visibility**
    - **Validates: Requirements 4.1**
    - Generate different history states (empty, with records)
    - Verify button visibility matches record presence
    - Run 100 iterations

- [x] 2. Phase 2: Update handleDistill to navigate after success
  - [x] 2.1 Modify handleDistill function in DistillationPage
    - After successful API response, save result to LocalStorage
    - Navigate to `/distillation-results` using navigate hook
    - Remove the inline "查看结果" button from success message
    - Keep the success message simple
    - _Requirements: 3.1, 3.2_

  - [ ]* 2.2 Write property test for distillation success navigation
    - **Property 2: Distillation success triggers navigation**
    - **Validates: Requirements 3.2**
    - Test that successful distillation triggers navigation
    - Run 100 iterations

  - [ ]* 2.3 Write property test for post-distillation display consistency
    - **Property 3: Post-distillation display consistency**
    - **Validates: Requirements 3.3**
    - Generate random distillation results
    - Verify displayed data matches LocalStorage data
    - Run 100 iterations

- [x] 3. Checkpoint - Verify DistillationPage functionality
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Phase 3: Simplify DistillationResultsPage
  - [x] 4.1 Remove history-related state and functions from DistillationResultsPage
    - Remove `history` state
    - Remove `loadHistory` function
    - Remove `handleViewHistory` function
    - Remove `handleDeleteRecord` function (keep only if used for result card)
    - Remove `handleEditKeyword` function (keep only if used for result card)
    - Remove `handleDeleteAll` function
    - Keep `result`, `selectedRecordId`, and `loading` states
    - _Requirements: 2.2, 6.4_

  - [x] 4.2 Remove history table Card from DistillationResultsPage JSX
    - Remove the entire Card component containing the history table
    - Keep only the result detail Card component
    - _Requirements: 2.2_

  - [x] 4.3 Add empty state handling to DistillationResultsPage
    - Add conditional rendering: if no result, show Empty component
    - Empty state should have descriptive text prompting user to select from history
    - Include a button to navigate back to `/distillation` page
    - _Requirements: 2.1_

  - [x] 4.4 Ensure result card operations still work in DistillationResultsPage
    - Verify edit keyword button works and updates LocalStorage
    - Verify delete button works and clears LocalStorage
    - Verify "查看话题" and "生成文章" buttons work
    - _Requirements: 2.3, 2.4, 2.5_

  - [ ]* 4.5 Write property test for valid LocalStorage data display
    - **Property 9: Valid LocalStorage data displays correctly**
    - **Validates: Requirements 5.2**
    - Generate random valid result data
    - Verify all fields display correctly
    - Run 100 iterations

  - [ ]* 4.6 Write property test for LocalStorage operations preservation
    - **Property 12: LocalStorage operations preservation**
    - **Validates: Requirements 6.3**
    - Generate random distillation data
    - Test save, load, and clear operations
    - Verify behavior is identical to original implementation
    - Run 100 iterations

- [x] 5. Checkpoint - Verify DistillationResultsPage functionality
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Final integration and testing
  - [x] 6.1 Test complete distillation workflow
    - Manually test: input keyword → distill → auto-navigate → view result
    - Verify LocalStorage is correctly populated
    - Verify result displays correctly
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 6.2 Test history management workflow
    - Manually test: view history → click view details → navigate to results
    - Manually test: edit keyword in history table
    - Manually test: delete single record from history table
    - Manually test: delete all records
    - _Requirements: 1.3, 1.4, 1.5, 4.2, 4.3, 4.4, 4.5_

  - [x] 6.3 Test page refresh and LocalStorage persistence
    - Perform distillation and navigate to results
    - Refresh the results page
    - Verify result is restored from LocalStorage
    - Navigate to distillation page
    - Verify selected record is highlighted in history table
    - _Requirements: 5.1, 5.2, 5.5_

  - [x] 6.4 Test empty states
    - Clear all records
    - Verify distillation page shows empty history table
    - Verify results page shows empty state with guidance
    - _Requirements: 2.1_

  - [ ]* 6.5 Write property test for delete all operation completeness
    - **Property 5: Delete all operation completeness**
    - **Validates: Requirements 4.3**
    - Generate random sets of records
    - Verify all records are deleted
    - Verify correct count is returned
    - Run 100 iterations

  - [ ]* 6.6 Write property test for delete all clears selected record
    - **Property 6: Delete all clears selected record**
    - **Validates: Requirements 4.4**
    - Generate scenarios with selected records
    - Verify LocalStorage is cleared when selected record is deleted
    - Run 100 iterations

  - [ ]* 6.7 Write property test for delete all success message accuracy
    - **Property 7: Delete all success message accuracy**
    - **Validates: Requirements 4.5**
    - Generate different record counts
    - Verify success message shows correct count
    - Run 100 iterations

  - [ ]* 6.8 Write property test for results page LocalStorage loading
    - **Property 8: Results page loads from LocalStorage**
    - **Validates: Requirements 5.1**
    - Test that page load attempts to read from LocalStorage
    - Run 100 iterations

  - [ ]* 6.9 Write property test for history page data loading
    - **Property 10: History page loads data on mount**
    - **Validates: Requirements 5.4**
    - Test that page load fetches history from API
    - Run 100 iterations

  - [ ]* 6.10 Write property test for selected record highlighting
    - **Property 11: Selected record highlighting**
    - **Validates: Requirements 5.5**
    - Generate history with selected record
    - Verify correct row has selected styling
    - Run 100 iterations

- [x] 7. Final Checkpoint - Complete refactoring verification
  - Ensure all tests pass, ask the user if questions arise.
