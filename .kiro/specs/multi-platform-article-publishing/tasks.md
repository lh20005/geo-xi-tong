# Implementation Plan

- [x] 1. Set up database schema and encryption infrastructure
  - Create migration file for all publishing-related tables
  - Implement EncryptionService with AES-256-GCM
  - Generate and store encryption key securely
  - Create database indexes for performance
  - _Requirements: 3.1, 3.3_

- [x] 1.1 Write property test for encryption round-trip
  - **Property 1: Encryption round-trip consistency**
  - **Validates: Requirements 3.2**

- [x] 1.2 Write property test for database encryption
  - **Property 2: Credentials always encrypted in database**
  - **Validates: Requirements 3.4**

- [x] 2. Implement platform configuration and account management backend
  - Create platforms_config table with initial platform data
  - Implement AccountService with CRUD operations
  - Add API endpoints for account management (/api/platform-accounts)
  - Implement credential encryption/decryption in account operations
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.4_

- [x] 2.1 Write property test for credential validation
  - **Property 7: Credential validation rejects invalid formats**
  - **Validates: Requirements 2.3**

- [x] 2.2 Write property test for credential encryption before storage
  - **Property 8: Valid credentials are encrypted before storage**
  - **Validates: Requirements 2.4**

- [x] 2.3 Write property test for account deletion
  - **Property 3: Account deletion removes all data**
  - **Validates: Requirements 3.5**

- [x] 2.4 Write property test for multiple accounts per platform
  - **Property 25: Multiple accounts per platform supported**
  - **Validates: Requirements 12.1**

- [x] 3. Create platform management frontend page
  - Add "平台登录" menu item to sidebar navigation
  - Create PlatformManagementPage component with card grid layout
  - Fetch and display platform icons (4 per row)
  - Show bound/unbound status for each platform
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 3.1 Write property test for platform card display
  - **Property 4: Platform cards display all configured platforms**
  - **Validates: Requirements 1.2**

- [x] 3.2 Write property test for card layout
  - **Property 5: Platform cards layout consistency**
  - **Validates: Requirements 1.3**

- [x] 3.3 Write property test for bound status indicator
  - **Property 6: Bound accounts show status indicator**
  - **Validates: Requirements 1.5**

- [x] 4. Implement account binding UI flow
  - Create AccountBindingModal component
  - Implement dynamic form based on platform requirements
  - Add client-side validation for credential fields
  - Handle account creation API calls
  - Update platform card status after successful binding
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 5. Implement account management UI
  - Create AccountManagementModal component
  - Display account information with masked sensitive fields
  - Implement edit account functionality
  - Implement delete account with confirmation
  - Support setting default account per platform
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 12.5_

- [ ] 5.1 Write property test for sensitive data masking
  - **Property 9: Sensitive data masked in UI**
  - **Validates: Requirements 4.2**

- [ ] 5.2 Write property test for default account persistence
  - **Property 28: Default account setting persisted**
  - **Validates: Requirements 12.5**

- [x] 6. Implement publishing task backend infrastructure
  - Create PublishingService with task CRUD operations
  - Implement TaskScheduler for scheduled publishing
  - Add API endpoints for publishing tasks (/api/publishing-tasks)
  - Create publishing_logs table and logging functionality
  - _Requirements: 6.1, 6.2, 6.4, 6.5, 13.1_

- [x] 6.1 Write property test for scheduled time validation
  - **Property 11: Scheduled time must be in future**
  - **Validates: Requirements 6.4**

- [x] 6.2 Write property test for task scheduling
  - **Property 12: Scheduled tasks execute at correct time**
  - **Validates: Requirements 6.5**

- [x] 6.3 Write property test for task logging
  - **Property 29: Task execution creates logs**
  - **Validates: Requirements 13.1**

- [x] 7. Create publishing configuration UI
  - Add "发布到平台" button to article list page
  - Create PublishingConfigModal component
  - Display only bound platforms for selection
  - Implement platform-specific configuration fields
  - Add immediate/scheduled publishing options
  - Handle task creation API calls
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.3_

- [ ] 7.1 Write property test for bound platform filtering
  - **Property 10: Only bound platforms shown in publishing config**
  - **Validates: Requirements 5.3**

- [x] 8. Implement browser automation foundation
  - Install and configure Puppeteer
  - Create BrowserAutomationService base class
  - Implement browser launch and lifecycle management
  - Add error handling and retry logic
  - Create logging for automation actions
  - _Requirements: 7.1, 7.4, 9.4, 13.2_

- [x] 8.1 Write property test for retry limit
  - **Property 18: Retry limit enforced**
  - **Validates: Requirements 9.4**

- [x] 8.2 Write property test for browser action logging
  - **Property 30: Browser actions logged**
  - **Validates: Requirements 13.2**

- [x] 9. Create platform adapter abstract class and base implementations
  - Define PlatformAdapter abstract class
  - Implement adapter for 网易号 (WangyiAdapter)
  - Implement adapter for 百家号 (BaijiahaoAdapter)
  - Implement adapter for 知乎 (ZhihuAdapter)
  - Add adapter registry and factory pattern
  - _Requirements: 7.2, 14.1_

- [x] 9.1 Write property test for platform URL navigation
  - **Property 13: Browser navigates to correct platform URL**
  - **Validates: Requirements 7.2**

- [ ] 10. Implement login automation
  - Implement login flow in BrowserAutomationService
  - Add credential retrieval and decryption
  - Implement form filling with stored credentials
  - Add login success verification
  - Handle common login errors
  - _Requirements: 7.2, 7.3, 7.4, 7.5_

- [ ] 10.1 Write property test for login form filling
  - **Property 14: Login form filled with stored credentials**
  - **Validates: Requirements 7.3**

- [ ] 11. Implement article content publishing automation
  - Implement article title filling
  - Implement content editor filling
  - Add image upload functionality
  - Implement category selection
  - Implement tag filling
  - Add publish button click and verification
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 11.1 Write property test for title filling
  - **Property 15: Article title filled in publish form**
  - **Validates: Requirements 8.1**

- [ ] 11.2 Write property test for content filling
  - **Property 16: Article content filled in editor**
  - **Validates: Requirements 8.2**

- [ ] 11.3 Write property test for image upload
  - **Property 17: Images uploaded for articles with images**
  - **Validates: Requirements 8.3**

- [ ] 12. Implement captcha handling
  - Add captcha detection logic
  - Integrate with captcha solving service (2captcha or similar)
  - Implement captcha filling and retry logic
  - Add configuration for captcha service credentials
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 13. Create publishing records UI
  - Create PublishingRecordsPage component
  - Display all publishing tasks in a table
  - Show real-time status updates
  - Display error messages for failed tasks
  - Add task detail view modal
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 13.1 Write property test for task history display
  - **Property 19: All tasks displayed in history**
  - **Validates: Requirements 10.1**

- [ ] 13.2 Write property test for task record fields
  - **Property 20: Task records contain required fields**
  - **Validates: Requirements 10.2**

- [ ] 13.3 Write property test for error display
  - **Property 21: Failed tasks show error information**
  - **Validates: Requirements 10.4**

- [ ] 14. Implement retry functionality
  - Add "重新发布" button for failed tasks
  - Implement configuration loading from original task
  - Allow configuration editing before retry
  - Create new task for retry operation
  - Execute retry task
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 14.1 Write property test for retry button visibility
  - **Property 22: Failed tasks show retry button**
  - **Validates: Requirements 11.1**

- [ ] 14.2 Write property test for configuration loading
  - **Property 23: Retry loads original configuration**
  - **Validates: Requirements 11.2**

- [ ] 14.3 Write property test for retry task creation
  - **Property 24: Retry creates new task**
  - **Validates: Requirements 11.4**

- [ ] 15. Implement multi-account support
  - Update account management to show all accounts per platform
  - Add unique identifier display for each account
  - Implement account selection in publishing config
  - Implement default account fallback logic
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [ ] 15.1 Write property test for account unique identifiers
  - **Property 26: Accounts have unique identifiers**
  - **Validates: Requirements 12.2**

- [ ] 15.2 Write property test for default account usage
  - **Property 27: Default account used when unspecified**
  - **Validates: Requirements 12.4**

- [ ] 16. Implement comprehensive logging and auditing
  - Add detailed logging to all task execution steps
  - Log browser automation actions
  - Implement error logging with stack traces
  - Add audit logging for account operations (without credentials)
  - Implement log filtering and querying
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [ ] 16.1 Write property test for error logging
  - **Property 31: Errors logged with stack trace**
  - **Validates: Requirements 13.3**

- [ ] 16.2 Write property test for audit logging
  - **Property 32: Account operations audited without credentials**
  - **Validates: Requirements 13.4**

- [ ] 16.3 Write property test for log filtering
  - **Property 33: Logs filterable by criteria**
  - **Validates: Requirements 13.5**

- [ ] 17. Implement platform-specific features
  - Add content format conversion for different platforms
  - Implement content length validation
  - Add cover image extraction/requirement handling
  - Create platform-specific configuration schemas
  - _Requirements: 14.2, 14.3, 14.4_

- [ ] 17.1 Write property test for content length validation
  - **Property 34: Content length validated against platform limits**
  - **Validates: Requirements 14.3**

- [ ] 17.2 Write property test for cover image handling
  - **Property 35: Cover image extracted or required**
  - **Validates: Requirements 14.4**

- [x] 18. Add remaining platform adapters
  - Implement adapter for 搜狐号 (SouhuAdapter)
  - Implement adapter for 头条号 (ToutiaoAdapter)
  - Implement adapter for 企鹅号 (QieAdapter)
  - Implement adapter for 微信公众号 (WechatAdapter)
  - Implement adapter for 小红书 (XiaohongshuAdapter)
  - Implement adapter for 抖音号 (DouyinAdapter)
  - Implement adapter for 哔哩哔哩 (BilibiliAdapter)
  - Implement adapter for CSDN (CSDNAdapter)
  - Implement adapter for 简书 (JianshuAdapter)
  - _Requirements: 14.1_

- [ ] 19. Implement task queue and concurrency control
  - Integrate job queue library (Bull or similar)
  - Configure concurrent task limits
  - Implement task priority handling
  - Add queue monitoring and metrics
  - _Requirements: 6.5, 7.1_

- [ ] 20. Add platform icons and branding
  - Source real platform icons/logos
  - Add icons to platforms_config table
  - Ensure proper icon display in UI
  - Handle icon loading errors gracefully
  - _Requirements: 1.4_

- [ ] 21. Checkpoint - Ensure all tests pass
  - Run all unit tests and property tests
  - Verify database migrations work correctly
  - Test end-to-end publishing flow with at least one platform
  - Ask the user if questions arise

- [ ] 22. Security hardening and final polish
  - Review and test encryption implementation
  - Add rate limiting to API endpoints
  - Implement input sanitization
  - Add authentication checks to all endpoints
  - Test browser isolation and cookie management
  - _Requirements: 3.1, 3.4_

- [ ] 22.1 Write integration tests for complete publishing flow
  - Test account binding → task creation → execution → logging
  - Test retry flow for failed tasks
  - Test multi-account scenarios

- [ ] 23. Documentation and deployment preparation
  - Document API endpoints
  - Create user guide for platform binding
  - Document environment variables and configuration
  - Create deployment checklist
  - Add monitoring and alerting setup guide
  - _Requirements: All_

- [ ] 24. Final checkpoint - Ensure all tests pass
  - Run complete test suite
  - Verify all features work as expected
  - Test with multiple platforms
  - Ask the user if questions arise
