# Implementation Plan

- [x] 1. Improve backend ID validation and error handling
  - [x] 1.1 Update ID validation logic to handle string-to-number conversion
    - Modify the validation in `server/src/routes/distillation.ts` to convert string IDs to numbers before validation
    - Use `parseInt()` for strings and `Number()` for other types
    - Validate the converted values are positive integers
    - _Requirements: 1.3, 2.3, 2.4_
  
  - [x] 1.2 Enhance error messages to include specific invalid IDs
    - Return detailed error response with `invalidIds` array
    - Provide clear error messages distinguishing between format errors and validation errors
    - _Requirements: 2.5, 3.1_
  
  - [x] 1.3 Add comprehensive error logging
    - Log all validation failures with details
    - Log database errors with full context
    - _Requirements: 3.5_
  
  - [ ]* 1.4 Write property test for ID validation
    - **Property 3: ID Validation Correctness**
    - **Validates: Requirements 1.3, 2.3**
    - Generate random arrays of valid positive integers
    - Verify all pass validation
  
  - [ ]* 1.5 Write property test for string ID tolerance
    - **Property 4: String ID Tolerance**
    - **Validates: Requirements 2.4**
    - Generate random valid numeric IDs as strings
    - Verify server accepts and converts them correctly
  
  - [ ]* 1.6 Write property test for invalid ID rejection
    - **Property 5: Invalid ID Rejection**
    - **Validates: Requirements 2.5**
    - Generate random invalid ID values (non-numeric strings, null, negative numbers, zero)
    - Verify server rejects them with clear error messages

- [x] 2. Improve frontend type safety and error handling
  - [x] 2.1 Enhance ID conversion in handleDeleteSelected
    - Update `client/src/pages/DistillationResultsPage.tsx`
    - Add proper type conversion with validation
    - Filter out any invalid IDs before API call
    - Add client-side validation error messages
    - _Requirements: 1.2, 2.2_
  
  - [x] 2.2 Improve error message display
    - Parse backend error responses and display specific error details
    - Show which IDs were invalid if provided by backend
    - _Requirements: 3.1, 3.2_
  
  - [ ]* 2.3 Write property test for ID type conversion
    - **Property 2: ID Type Conversion**
    - **Validates: Requirements 1.2, 2.2**
    - Generate random arrays of mixed string/number IDs
    - Verify conversion produces correct numeric IDs

- [ ] 3. Add unit tests for validation logic
  - [ ]* 3.1 Write unit tests for backend ID validation
    - Test validation with valid numeric IDs
    - Test validation with string numeric IDs
    - Test validation with invalid inputs (negative, zero, non-numeric)
    - Test error response format
    - _Requirements: 1.3, 2.3, 2.4, 2.5_
  
  - [ ]* 3.2 Write unit tests for frontend ID conversion
    - Test conversion of numeric keys
    - Test conversion of string keys
    - Test filtering of invalid keys
    - _Requirements: 1.2, 2.2_

- [ ] 4. Integration testing and verification
  - [ ]* 4.1 Write property test for deletion completeness
    - **Property 6: Deletion Completeness**
    - **Validates: Requirements 1.4**
    - Generate random valid ID sets
    - Verify all are deleted from database after operation
  
  - [ ]* 4.2 Write property test for deletion count accuracy
    - **Property 7: Deletion Count Accuracy**
    - **Validates: Requirements 1.5**
    - Generate random valid ID sets
    - Verify returned deletedCount matches input count
  
  - [ ]* 4.3 Write integration test for end-to-end deletion flow
    - Test complete flow from frontend to database
    - Test error propagation
    - Test UI state updates
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
