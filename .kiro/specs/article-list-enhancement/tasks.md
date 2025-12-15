# Implementation Plan

- [x] 1. Enhance API endpoint to include related data
  - Modify GET /articles endpoint to join with distillations and conversion_targets tables
  - Update SQL query to use LEFT JOIN for optional relationships
  - Add distillation_keyword and conversion_target_name to response
  - Ensure consistent field naming (camelCase in responses)
  - _Requirements: 2.2, 2.4, 3.2, 3.4, 5.3_

- [x] 1.1 Write property test for related data display
  - **Property 3: Related data display**
  - **Validates: Requirements 2.2, 3.2**

- [x] 1.2 Write property test for referential integrity
  - **Property 4: Referential integrity preservation**
  - **Validates: Requirements 2.4, 3.4**

- [x] 1.3 Write property test for query correctness
  - **Property 5: Query correctness and data preservation**
  - **Validates: Requirements 5.3, 5.4**

- [x] 1.4 Write unit tests for API endpoint
  - Test articles with and without distillation results
  - Test articles with and without conversion targets
  - Test NULL handling in JOIN queries
  - Test response field naming consistency
  - _Requirements: 2.2, 2.3, 3.2, 3.3, 5.3_

- [x] 2. Fix creation time display in API response
  - Ensure created_at field is consistently returned in API responses
  - Verify timestamp format is ISO 8601 compatible
  - Update field mapping to use consistent naming
  - _Requirements: 1.1, 1.3_

- [x] 2.1 Write property test for creation time consistency
  - **Property 1: Creation time display consistency**
  - **Validates: Requirements 1.1, 1.3**

- [x] 2.2 Write property test for creation time sort order
  - **Property 2: Creation time sort order**
  - **Validates: Requirements 1.2**

- [x] 3. Update article list UI component
  - Remove "Preview" column from table configuration
  - Remove "AI Model" (provider) column from table configuration
  - Add "Conversion Target" column before "Keywords" column
  - Add "Distillation Result" column after "Keywords" column
  - Update column rendering to handle NULL values gracefully
  - Fix created_at field reference to use consistent naming from API
  - _Requirements: 2.1, 3.1, 4.1, 4.2, 4.3_

- [x] 3.1 Write unit tests for UI component
  - Test correct columns are displayed in correct order
  - Test "Preview" and "AI Model" columns are not present
  - Test NULL values display appropriately
  - Test creation time formatting
  - _Requirements: 2.1, 2.3, 3.1, 3.3, 4.1, 4.2_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Verify database schema supports requirements
  - Confirm articles.distillation_id foreign key exists
  - Confirm generation_tasks.conversion_target_id foreign key exists
  - Verify indexes are in place for efficient JOIN queries
  - Document the relationship chain: articles → generation_tasks → conversion_targets
  - _Requirements: 5.1, 5.2_

- [x] 5.1 Write integration test for end-to-end flow
  - Create test articles with various relationship combinations
  - Verify data displays correctly in API responses
  - Test edge cases (NULL foreign keys)
  - _Requirements: 5.1, 5.2, 5.3, 5.4_
