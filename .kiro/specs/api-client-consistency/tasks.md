# Implementation Plan

- [x] 1. Create unified API client module
  - Create `client/src/api/client.ts` with axios instance configured with baseURL '/api'
  - Add response interceptor for unified error handling
  - Export apiClient instance for use across the application
  - _Requirements: 1.1, 1.4, 1.5_

- [x] 1.1 Write property test for relative path consistency
  - **Property 1: Relative path consistency**
  - **Validates: Requirements 1.2**

- [x] 1.2 Write property test for error handling consistency
  - **Property 2: Error handling consistency**
  - **Validates: Requirements 1.5**

- [x] 1.3 Write property test for error message extraction
  - **Property 3: Error message extraction**
  - **Validates: Requirements 2.4**

- [x] 2. Update article settings API module
  - Modify `client/src/api/articleSettings.ts` to import apiClient from './client'
  - Replace all fetch calls with apiClient methods (get, post, patch, delete)
  - Remove hardcoded API_BASE_URL constant
  - Ensure all functions maintain their existing signatures and return types
  - _Requirements: 3.2, 3.5_

- [x] 3. Update article list page
  - Modify `client/src/pages/ArticleListPage.tsx` to import apiClient from '../api/client'
  - Replace direct axios import with apiClient
  - Update all API calls to use apiClient instead of axios
  - Ensure error handling uses error.message from caught errors
  - _Requirements: 3.1, 3.4_

- [x] 4. Test page navigation flows
  - Manually test navigation from ArticleListPage to ArticleSettingsPage
  - Manually test navigation from ArticleSettingsPage to ArticleListPage
  - Verify both pages load successfully without "列表加载失败" errors
  - Verify error messages display correctly when API calls fail
  - _Requirements: 2.1, 2.2, 2.4_

- [x] 4.1 Write property test for navigation consistency
  - **Property 4: Navigation consistency**
  - **Validates: Requirements 2.5**

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
