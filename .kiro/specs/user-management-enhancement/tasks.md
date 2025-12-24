# Implementation Plan: User Management Enhancement

## Overview

This implementation plan breaks down the user management enhancement into discrete, manageable tasks. The system will be built incrementally, starting with backend infrastructure (database, services, API), then adding the frontend user management interface on the marketing website, and finally implementing real-time synchronization for the client and Windows applications. Each task builds on previous work, with testing integrated throughout.

## Tasks

- [x] 1. Database schema migration
  - Create migration script to add invitation code fields to users table
  - Add invitation_code VARCHAR(6) UNIQUE NOT NULL
  - Add invited_by_code VARCHAR(6) with foreign key constraint
  - Add is_temp_password BOOLEAN DEFAULT FALSE
  - Create indexes on invitation_code and invited_by_code
  - Create login_attempts table for rate limiting
  - Test migration on development database
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 2. Backend: Invitation Service
  - [x] 2.1 Implement invitation code generator
    - Create InvitationService class in server/src/services/InvitationService.ts
    - Implement generate() method using crypto.randomBytes
    - Character set: lowercase letters (a-z) and numbers (0-9)
    - Length: exactly 6 characters
    - Implement retry logic for uniqueness (max 10 attempts)
    - _Requirements: 2.1, 2.2_

  - [x] 2.2 Write property test for invitation code format and uniqueness
    - **Property 6: Invitation Code Format and Uniqueness**
    - **Validates: Requirements 2.1, 2.2**

  - [x] 2.3 Implement invitation code validation
    - Add validateFormat() method to check 6 chars, lowercase alphanumeric
    - Add isUnique() method to query database for uniqueness
    - Add exists() method to check if code exists in database
    - _Requirements: 3.2_

  - [x] 2.4 Implement invitation statistics queries
    - Add getInvitationStats(userId) method
    - Query users table where invited_by_code matches user's invitation_code
    - Return total count and array of invited users with usernames and dates
    - _Requirements: 2.5, 2.6_

  - [x] 2.5 Write property test for invitation statistics accuracy
    - **Property 7: Invitation Statistics Accuracy**
    - **Validates: Requirements 2.5, 2.6, 4.5**

  - [x] 2.6 Write property test for invitation relationship integrity
    - **Property 8: Invitation Relationship Integrity**
    - **Validates: Requirements 2.7, 3.3**

- [x] 3. Backend: Enhanced Auth Service
  - [x] 3.1 Add user registration method
    - Extend AuthService with registerUser() method
    - Validate username format (3-20 chars, alphanumeric and underscore)
    - Validate password length (minimum 6 characters)
    - Hash password with bcrypt (10 salt rounds)
    - Generate unique invitation code via InvitationService
    - Handle optional invited_by_code parameter
    - Validate invited_by_code exists if provided
    - Insert user into database with all fields
    - _Requirements: 1.2, 1.4, 1.5, 1.7_

  - [x] 3.2 Write property test for successful registration
    - **Property 1: Successful Registration Creates Valid Account**
    - **Validates: Requirements 1.2, 1.5, 1.7, 2.1**

  - [x] 3.3 Write property test for unique username constraint
    - **Property 2: Unique Username Constraint**
    - **Validates: Requirements 1.3**

  - [x] 3.4 Write property test for password minimum length
    - **Property 3: Password Minimum Length Validation**
    - **Validates: Requirements 1.4, 5.2**

  - [x] 3.5 Write property test for password hashing security
    - **Property 4: Password Hashing Security**
    - **Validates: Requirements 1.5, 5.3, 9.1**

  - [x] 3.6 Write property test for invitation code validation
    - **Property 9: Invitation Code Validation**
    - **Validates: Requirements 3.2, 3.4**

  - [x] 3.7 Write property test for optional invitation code
    - **Property 10: Optional Invitation Code**
    - **Validates: Requirements 3.5**

- [x] 4. Backend: User Service
  - [x] 4.1 Create UserService class
    - Create server/src/services/UserService.ts
    - Implement getUserById(id) to retrieve user data
    - Implement getUserProfile(id) to get profile with invitation stats
    - Implement updateUser(id, data) for admin updates
    - Implement changePassword(id, currentPassword, newPassword)
    - Implement deleteUser(id) with cascade handling
    - _Requirements: 4.6, 5.1, 5.2, 5.3_

  - [x] 4.2 Implement admin password reset
    - Add resetPassword(userId) method to UserService
    - Generate temporary password (8 random characters)
    - Hash temporary password with bcrypt
    - Set is_temp_password flag to true
    - Update user in database
    - Return temporary password to admin
    - _Requirements: 6.1, 6.2_

  - [x] 4.3 Write property test for password change validation
    - **Property 14: Password Change Validation**
    - **Validates: Requirements 5.1, 5.5**

  - [x] 4.4 Write property test for admin update persistence
    - **Property 13: Admin Update Persistence**
    - **Validates: Requirements 4.6**

  - [x] 4.5 Write property test for temporary password flow
    - **Property 16: Temporary Password Flow**
    - **Validates: Requirements 6.1, 6.3**

- [x] 5. Backend: Rate Limiting Service
  - [x] 5.1 Create RateLimitService class
    - Create server/src/services/RateLimitService.ts
    - Implement recordLoginAttempt(username, ipAddress, success)
    - Implement checkRateLimit(username, ipAddress) - returns boolean
    - Query login_attempts table for failed attempts in last 15 minutes
    - Return true if less than 5 failed attempts, false otherwise
    - Implement cleanup method to delete old attempts (older than 1 hour)
    - _Requirements: 9.3_

  - [x] 5.2 Write property test for rate limiting enforcement
    - **Property 21: Rate Limiting Enforcement**
    - **Validates: Requirements 9.3**

- [x] 6. Backend: Token Service Enhancement
  - [x] 6.1 Update TokenService for session invalidation
    - Modify existing TokenService or create new methods
    - Add invalidateUserTokens(userId) method
    - Delete all refresh tokens for user from database
    - Optionally maintain a token blacklist for access tokens
    - _Requirements: 5.4, 6.4_

  - [x] 6.2 Write property test for session invalidation
    - **Property 15: Session Invalidation on Password Change**
    - **Validates: Requirements 5.4, 6.4**

  - [x] 6.3 Write property test for auto-login after registration
    - **Property 5: Auto-Login After Registration**
    - **Validates: Requirements 1.6**

  - [x] 6.4 Write property test for JWT cross-platform validity
    - **Property 25: JWT Token Cross-Platform Validity**
    - **Validates: Requirements 10.4**

- [x] 7. Backend: API Routes - Registration
  - [x] 7.1 Implement registration endpoint
    - Add POST /api/auth/register to server/src/routes/auth.ts
    - Validate input (username, password, optional invitationCode)
    - Check rate limit for registration (3 per hour per IP)
    - Call AuthService.registerUser()
    - Generate JWT access and refresh tokens
    - Return user data with tokens
    - Handle errors (duplicate username, invalid invitation code)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_

  - [x] 7.2 Write property test for password confidentiality
    - **Property 22: Password Confidentiality**
    - **Validates: Requirements 9.4**

- [x] 8. Backend: API Routes - User Management (Admin)
  - [x] 8.1 Create admin middleware
    - Create server/src/middleware/adminAuth.ts
    - Check if authenticated user has role === 'admin'
    - Return 403 Forbidden if not admin
    - _Requirements: 4.1_

  - [x] 8.2 Implement GET /api/admin/users
    - Add route to server/src/routes/admin.ts (create new file)
    - Apply authentication and admin middleware
    - Parse query parameters (page, pageSize, search)
    - Call UserService to get paginated user list
    - Include invitation count for each user (subquery or join)
    - Return users array with pagination metadata
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 8.3 Write property test for user search functionality
    - **Property 11: User Search Functionality**
    - **Validates: Requirements 4.2**

  - [x] 8.4 Write property test for pagination correctness
    - **Property 12: Pagination Correctness**
    - **Validates: Requirements 4.3**

  - [x] 8.5 Implement GET /api/admin/users/:id
    - Add route to get detailed user information
    - Call UserService.getUserProfile(id)
    - Include full invitation statistics
    - Return user details with invited users list
    - _Requirements: 4.4_

  - [x] 8.6 Implement PUT /api/admin/users/:id
    - Add route to update user information
    - Validate input (username, role)
    - Call UserService.updateUser(id, data)
    - Broadcast WebSocket event for user update
    - Return updated user data
    - _Requirements: 4.6_

  - [x] 8.7 Implement POST /api/admin/users/:id/reset-password
    - Add route to reset user password
    - Call UserService.resetPassword(id)
    - Invalidate all user sessions via TokenService
    - Broadcast WebSocket event for password change
    - Return temporary password
    - _Requirements: 6.1, 6.2, 6.4_

  - [x] 8.8 Implement DELETE /api/admin/users/:id
    - Add route to delete user
    - Call UserService.deleteUser(id)
    - Broadcast WebSocket event for user deletion
    - Return success message
    - _Requirements: 4.7_

- [x] 9. Backend: API Routes - User Profile
  - [x] 9.1 Implement GET /api/users/profile
    - Add route to server/src/routes/users.ts (create new file)
    - Apply authentication middleware
    - Get user ID from JWT token
    - Call UserService.getUserProfile(userId)
    - Return user profile data
    - _Requirements: 2.3_

  - [x] 9.2 Implement PUT /api/users/password
    - Add route to change password
    - Apply authentication middleware
    - Validate current password via AuthService
    - Validate new password meets requirements
    - Call UserService.changePassword()
    - Invalidate old sessions except current
    - Broadcast WebSocket event for password change
    - Return success message
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 10. Backend: API Routes - Invitations
  - [x] 10.1 Implement GET /api/invitations/stats
    - Add route to server/src/routes/invitations.ts (create new file)
    - Apply authentication middleware
    - Get user ID from JWT token
    - Call InvitationService.getInvitationStats(userId)
    - Return invitation code, total count, and invited users list
    - _Requirements: 2.5, 2.6_

  - [x] 10.2 Implement POST /api/invitations/validate
    - Add route to validate invitation code
    - No authentication required (public endpoint)
    - Call InvitationService.exists(code)
    - Return validation result with inviter username if valid
    - _Requirements: 3.2_

- [x] 11. Backend: WebSocket Service
  - [x] 11.1 Create WebSocket server
    - Create server/src/services/WebSocketService.ts
    - Set up WebSocket server using 'ws' library
    - Implement authentication for WebSocket connections (JWT in query or header)
    - Maintain map of userId to Set<WebSocket> connections
    - Implement subscribe(userId, ws) method
    - Implement unsubscribe(userId, ws) method
    - Implement broadcast(userId, event) method
    - Handle connection, disconnection, and errors
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 11.2 Integrate WebSocket with API routes
    - Import WebSocketService in admin routes
    - Call broadcast() after user update (user:updated event)
    - Call broadcast() after user deletion (user:deleted event)
    - Call broadcast() after password change (user:password-changed event)
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 11.3 Write property test for real-time synchronization
    - **Property 17: Real-Time User Update Synchronization**
    - **Property 18: Real-Time User Deletion Synchronization**
    - **Validates: Requirements 7.1, 7.2, 7.3**

- [x] 12. Checkpoint - Backend testing
  - Ensure all backend tests pass
  - Test API endpoints with Postman or similar tool
  - Verify database schema is correct
  - Test WebSocket connections and events
  - Ask the user if questions arise

- [x] 13. Frontend Shared: API Client
  - [x] 13.1 Create shared AuthApiClient methods
    - Add register() method to existing API client
    - Update login() method to handle is_temp_password flag
    - Ensure consistent error handling across all methods
    - _Requirements: 1.1, 1.2, 6.3_

  - [x] 13.2 Create AdminApiClient class
    - Create landing/src/api/admin.ts
    - Implement getUsers(page, pageSize, search) method
    - Implement getUserDetails(id) method
    - Implement updateUser(id, data) method
    - Implement resetPassword(id) method
    - Implement deleteUser(id) method
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 6.1_

  - [x] 13.3 Create InvitationApiClient class
    - Create landing/src/api/invitations.ts
    - Implement getStats() method
    - Implement validateCode(code) method
    - _Requirements: 2.5, 2.6, 3.2_

  - [x] 13.4 Create shared type definitions
    - Create landing/src/types/user.ts
    - Define User interface
    - Define RegistrationData interface
    - Define InvitationStats interface
    - Define UserListResponse interface
    - _Requirements: All_

  - [x] 13.5 Write property test for API consistency
    - **Property 23: Cross-Platform API Consistency**
    - **Property 24: Error Response Consistency**
    - **Validates: Requirements 10.2, 10.3**

  - [x] 13.6 Write property test for user-friendly error messages
    - **Property 26: User-Friendly Error Messages**
    - **Validates: Requirements 11.4**

- [x] 14. Frontend Landing: Registration Page
  - [x] 14.1 Create RegistrationPage component
    - Create landing/src/pages/RegistrationPage.tsx
    - Design form with username, password, confirm password fields
    - Add optional invitation code field
    - Implement real-time username availability check (debounced)
    - Add password strength indicator
    - Style with Tailwind CSS matching existing design
    - _Requirements: 1.1, 3.1_

  - [x] 14.2 Implement registration form logic
    - Handle form submission
    - Validate inputs client-side
    - Call AuthApiClient.register()
    - Store tokens in localStorage
    - Redirect to dashboard on success
    - Display error messages on failure
    - Handle invitation code validation warnings
    - _Requirements: 1.2, 1.3, 1.4, 1.6, 3.4_

  - [x] 14.3 Add registration route
    - Add /register route to landing/src/App.tsx
    - Update login page to link to registration
    - _Requirements: 1.1_

- [x] 15. Frontend Landing: User Management Dashboard
  - [x] 15.1 Create UserManagementPage component
    - Create landing/src/pages/UserManagementPage.tsx
    - Design table layout with columns: username, registration date, invitation code, invited count, actions
    - Implement search input with debounce (300ms)
    - Implement pagination controls
    - Add "View Details" button for each user
    - Add "Reset Password" button for each user
    - Add "Delete" button for each user
    - Style with Tailwind CSS
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 15.2 Implement user management logic
    - Call AdminApiClient.getUsers() on mount and when page/search changes
    - Handle loading and error states
    - Implement search functionality
    - Implement pagination
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 15.3 Add admin route protection
    - Create AdminRoute component similar to ProtectedRoute
    - Check user role === 'admin'
    - Redirect to dashboard if not admin
    - Wrap UserManagementPage with AdminRoute
    - _Requirements: 4.1_

- [x] 16. Frontend Landing: User Detail Modal
  - [x] 16.1 Create UserDetailModal component
    - Create landing/src/components/UserDetailModal.tsx
    - Display full user information (username, role, registration date, last login)
    - Display invitation code with copy button
    - Display invitation statistics (total count, invited users list)
    - Add edit mode for username and role
    - Add "Reset Password" button
    - Add "Delete User" button with confirmation
    - Style with Tailwind CSS
    - _Requirements: 4.4, 4.5, 4.6, 4.7_

  - [x] 16.2 Implement user detail logic
    - Call AdminApiClient.getUserDetails(id) on mount
    - Handle edit mode toggle
    - Call AdminApiClient.updateUser() on save
    - Call AdminApiClient.resetPassword() on reset
    - Display temporary password in modal
    - Call AdminApiClient.deleteUser() on delete after confirmation
    - Close modal and refresh list on success
    - _Requirements: 4.4, 4.6, 6.1, 6.2_

- [x] 17. Frontend Landing: Profile Page
  - [x] 17.1 Create ProfilePage component
    - Create landing/src/pages/ProfilePage.tsx
    - Display user information (username, registration date, invitation code)
    - Add "Copy Invitation Code" button
    - Add "Change Password" button
    - Display invitation statistics section
    - Style with Tailwind CSS
    - _Requirements: 2.3, 2.4, 5.1_

  - [x] 17.2 Create ChangePasswordModal component
    - Create landing/src/components/ChangePasswordModal.tsx
    - Form with current password, new password, confirm new password fields
    - Validate new password meets requirements
    - Call AuthApiClient.changePassword() on submit
    - Display success message
    - Handle errors (incorrect current password)
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

  - [x] 17.3 Create InvitationDashboard component (integrated into ProfilePage)
    - Display invitation code prominently with copy button
    - Display total invites count with animation
    - Display list of invited users with usernames and registration dates
    - Call InvitationApiClient.getStats() on mount
    - _Requirements: 2.3, 2.4, 2.5, 2.6_

  - [x] 17.4 Add profile route
    - Add /profile route to landing/src/App.tsx
    - Add profile link to navigation menu
    - _Requirements: 2.3_

- [x] 18. Frontend Landing: Temporary Password Flow
  - [x] 18.1 Update LoginPage for temporary password
    - Modify landing/src/pages/LoginPage.tsx
    - Check is_temp_password flag in login response
    - If true, show "Change Password Required" modal immediately
    - Prevent access to other pages until password is changed
    - _Requirements: 6.3_

  - [x] 18.2 Create ForcePasswordChangeModal component (reused ChangePasswordModal with isForced prop)
    - Form with new password and confirm password fields
    - Cannot be dismissed until password is changed
    - Call AuthApiClient.changePassword() with temporary password as current
    - Redirect to dashboard on success
    - _Requirements: 6.3_

- [x] 19. Frontend Landing: WebSocket Client
  - [x] 19.1 Create WebSocket client service
    - Create landing/src/services/WebSocketService.ts
    - Implement connect() method with JWT authentication
    - Implement disconnect() method
    - Implement subscribe(userId) method
    - Implement event handlers (onUserUpdated, onUserDeleted, onPasswordChanged)
    - Implement reconnection logic with exponential backoff
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

  - [x] 19.2 Integrate WebSocket with user management
    - Import WebSocketService in UserManagementPage
    - Connect on mount, disconnect on unmount
    - Subscribe to current user
    - On user:updated event, refresh user list
    - On user:deleted event, refresh user list
    - _Requirements: 7.3, 7.5_

  - [x] 19.3 Integrate WebSocket with profile page
    - Import WebSocketService in ProfilePage
    - Connect on mount, disconnect on unmount
    - Subscribe to current user
    - On user:updated event, refresh profile data
    - On user:password-changed event, show notification
    - _Requirements: 7.1, 7.3, 7.5_

  - [x] 19.4 Write property test for WebSocket event handling
    - **Property 19: WebSocket Event Handling**
    - **Validates: Requirements 7.5**

- [x] 20. Checkpoint - Landing frontend testing
  - Test registration flow end-to-end
  - Test login with new account
  - Test admin user management (view, edit, delete)
  - Test password reset flow
  - Test invitation code usage and tracking
  - Test WebSocket synchronization
  - Ensure all tests pass
  - Ask the user if questions arise

- [x] 21. Frontend Client: WebSocket Integration
  - [x] 21.1 Create WebSocket client service for client app
    - Create client/src/services/UserWebSocketService.ts
    - Reuse logic from landing WebSocket service
    - Implement connect(), disconnect(), subscribe()
    - Implement event handlers
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

  - [x] 21.2 Integrate WebSocket with client app
    - Import UserWebSocketService in client/src/App.tsx
    - Connect on user login
    - Subscribe to current user
    - On user:updated event, update local user data
    - On user:deleted event, log out immediately
    - On user:password-changed event, invalidate token and redirect to login
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

  - [x] 21.3 Update client authentication context
    - Modify existing auth context to handle WebSocket events
    - Add method to update user data from WebSocket
    - Add method to force logout from WebSocket
    - _Requirements: 7.2, 7.3_

- [x] 22. Frontend Windows: WebSocket Integration
  - [x] 22.1 Create WebSocket client service for Windows app
    - Create windows-login-manager/electron/websocket/userClient.ts
    - Implement connect(), disconnect(), subscribe()
    - Implement event handlers
    - Use Electron IPC to communicate with renderer process
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

  - [x] 22.2 Integrate WebSocket with Windows app
    - Import UserWebSocketClient in windows-login-manager/electron/main.ts
    - Connect on user login
    - Subscribe to current user
    - On user:updated event, send IPC message to renderer
    - On user:deleted event, log out immediately and close app
    - On user:password-changed event, invalidate token and show login window
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

  - [x] 22.3 Update Windows app renderer
    - Add IPC listeners in windows-login-manager/src/App.tsx
    - Handle user:updated event by updating local state
    - Handle user:deleted event by redirecting to login
    - Handle user:password-changed event by redirecting to login
    - _Requirements: 7.2, 7.3, 7.5_

- [x] 23. Security: Rate Limiting Middleware
  - [x] 23.1 Implement rate limiting middleware
    - Create server/src/middleware/rateLimit.ts
    - Use RateLimitService to check limits
    - Apply to login endpoint (5 attempts per 15 minutes)
    - Apply to registration endpoint (3 attempts per hour)
    - Return 429 Too Many Requests on limit exceeded
    - _Requirements: 9.3_

  - [x] 23.2 Add cleanup job for login attempts
    - Create scheduled job to run every hour
    - Call RateLimitService.cleanup() to delete old attempts
    - _Requirements: 9.3_

- [x] 24. Security: Password Confidentiality Audit
  - [x] 24.1 Audit code for password exposure
    - Review all API responses to ensure no plain text passwords
    - Review all log statements to ensure no plain text passwords
    - Add sanitization to error messages
    - Ensure password fields are never included in user objects returned by API
    - _Requirements: 9.4_

  - [x] 24.2 Add response sanitization middleware
    - Create server/src/middleware/sanitizeResponse.ts
    - Remove password_hash field from all user objects in responses
    - Apply to all routes that return user data
    - _Requirements: 9.4_

- [x] 25. Documentation and Deployment
  - [x] 25.1 Update API documentation
    - Document all new endpoints in server/docs/API.md
    - Add request/response examples
    - Document error codes
    - Document WebSocket events
    - _Requirements: All_

  - [x] 25.2 Create environment variable template
    - Update .env.example with new variables
    - Document JWT_SECRET and JWT_REFRESH_SECRET
    - Document WEBSOCKET_PORT
    - Document rate limiting configuration
    - _Requirements: 9.1, 9.2_

  - [x] 25.3 Create database migration guide
    - Document migration steps in server/migrations/README.md
    - Provide rollback instructions
    - Document how to generate invitation codes for existing users
    - _Requirements: 8.1_

  - [x] 25.4 Update README files
    - Update main README.md with new features
    - Update landing/README.md with user management instructions
    - Update client/README.md with WebSocket integration notes
    - Update windows-login-manager/README.md with WebSocket integration notes
    - _Requirements: All_

- [x] 26. Final checkpoint - Integration testing
  - Test complete registration flow across all platforms
  - Test login with new accounts across all platforms
  - Test admin user management on landing website
  - Test password change and verify synchronization to client and Windows
  - Test user deletion and verify immediate logout on all platforms
  - Test invitation system end-to-end
  - Test WebSocket reconnection after network interruption
  - Test rate limiting behavior
  - Verify all security measures are in place
  - Ensure all tests pass
  - Ask the user if questions arise

## Notes

- All tasks including property-based tests are required for comprehensive quality assurance
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties with minimum 100 iterations each
- Unit tests validate specific examples and edge cases
- Backend tasks should be completed before frontend tasks
- Landing website tasks should be completed before client and Windows app tasks
- WebSocket integration is critical for real-time synchronization across platforms
