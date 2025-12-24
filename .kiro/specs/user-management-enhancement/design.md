# Design Document: User Management Enhancement

## Overview

This document describes the design for enhancing the existing user authentication system with comprehensive user management capabilities. The enhancement includes user registration, an administrative user management interface on the marketing website, and an invitation code referral system. The system maintains a shared backend API used by three platforms while implementing UI only on the marketing website. Real-time synchronization ensures that user data changes are immediately reflected across all platforms.

The design follows modern web application best practices, including secure password hashing with bcrypt, JWT-based session management, WebSocket-based real-time synchronization, and intuitive admin dashboard patterns inspired by leading SaaS platforms.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Landing    │  │    Client    │  │   Windows    │          │
│  │   Website    │  │     App      │  │     App      │          │
│  │              │  │              │  │              │          │
│  │ [User Mgmt   │  │ [Data Only]  │  │ [Data Only]  │          │
│  │  Interface]  │  │              │  │              │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                  │
│         └──────────────────┼──────────────────┘                  │
│                            │                                     │
└────────────────────────────┼─────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   API Gateway   │
                    │  (Express.js)   │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼─────┐      ┌──────▼──────┐      ┌─────▼──────┐
   │   Auth   │      │    User     │      │ Invitation │
   │ Service  │      │   Service   │      │  Service   │
   └────┬─────┘      └──────┬──────┘      └─────┬──────┘
        │                   │                    │
        └───────────────────┼────────────────────┘
                            │
                    ┌───────▼────────┐
                    │   PostgreSQL   │
                    │    Database    │
                    └────────────────┘
                            │
                    ┌───────▼────────┐
                    │   WebSocket    │
                    │     Server     │
                    └────────┬───────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼─────┐      ┌──────▼──────┐      ┌─────▼──────┐
   │ Landing  │      │   Client    │      │  Windows   │
   │ WS Client│      │  WS Client  │      │ WS Client  │
   └──────────┘      └─────────────┘      └────────────┘
```

### Component Responsibilities

**Frontend Components:**
- **Landing Website**: Full user management UI (registration, admin dashboard, profile management)
- **Client App**: Receives real-time updates, displays user data (no management UI)
- **Windows App**: Receives real-time updates, displays user data (no management UI)

**Backend Services:**
- **AuthService**: Password hashing, user validation, authentication
- **UserService**: User CRUD operations, profile updates, admin operations
- **InvitationService**: Code generation, uniqueness validation, referral tracking
- **TokenService**: JWT token generation, validation, refresh
- **WebSocketService**: Real-time synchronization across all connected clients

## Components and Interfaces

### 1. Database Schema

```sql
-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  invitation_code VARCHAR(6) UNIQUE NOT NULL,
  invited_by_code VARCHAR(6),
  role VARCHAR(20) DEFAULT 'user',
  is_temp_password BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP,
  
  CONSTRAINT fk_invited_by FOREIGN KEY (invited_by_code) 
    REFERENCES users(invitation_code) ON DELETE SET NULL
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_invitation_code ON users(invitation_code);
CREATE INDEX idx_users_invited_by_code ON users(invited_by_code);

-- Refresh tokens table
CREATE TABLE refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);

-- Login attempts table (for rate limiting)
CREATE TABLE login_attempts (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  success BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_login_attempts_username ON login_attempts(username);
CREATE INDEX idx_login_attempts_ip ON login_attempts(ip_address);
```

### 2. Backend API Endpoints

#### Authentication Endpoints

**POST /api/auth/register**
```typescript
Request:
{
  username: string;      // 3-20 characters, alphanumeric and underscore
  password: string;      // minimum 6 characters
  invitationCode?: string; // optional, 6 characters
}

Response:
{
  success: boolean;
  data: {
    user: {
      id: number;
      username: string;
      invitationCode: string;
      createdAt: string;
    };
    token: string;
    refreshToken: string;
  };
  message?: string;
}
```

**POST /api/auth/login**
```typescript
Request:
{
  username: string;
  password: string;
}

Response:
{
  success: boolean;
  data: {
    user: {
      id: number;
      username: string;
      role: string;
      invitationCode: string;
      isTempPassword: boolean;
    };
    token: string;
    refreshToken: string;
    expiresIn: number;
  };
  message?: string;
}
```

**POST /api/auth/logout**
```typescript
Request:
{
  refreshToken: string;
}

Response:
{
  success: boolean;
  message: string;
}
```

#### User Management Endpoints (Admin Only)

**GET /api/admin/users**
```typescript
Headers: Authorization: Bearer <token>

Query Parameters:
{
  page?: number;
  pageSize?: number;
  search?: string;  // search by username
}

Response:
{
  success: boolean;
  data: {
    users: Array<{
      id: number;
      username: string;
      invitationCode: string;
      invitedByCode: string | null;
      invitedCount: number;
      role: string;
      createdAt: string;
      lastLoginAt: string | null;
    }>;
    total: number;
    page: number;
    pageSize: number;
  };
}
```

**GET /api/admin/users/:id**
```typescript
Headers: Authorization: Bearer <token>

Response:
{
  success: boolean;
  data: {
    id: number;
    username: string;
    invitationCode: string;
    invitedByCode: string | null;
    role: string;
    createdAt: string;
    lastLoginAt: string | null;
    invitedUsers: Array<{
      username: string;
      createdAt: string;
    }>;
  };
}
```

**PUT /api/admin/users/:id**
```typescript
Headers: Authorization: Bearer <token>

Request:
{
  username?: string;
  role?: string;
}

Response:
{
  success: boolean;
  data: {
    id: number;
    username: string;
    role: string;
    updatedAt: string;
  };
  message: string;
}
```

**POST /api/admin/users/:id/reset-password**
```typescript
Headers: Authorization: Bearer <token>

Response:
{
  success: boolean;
  data: {
    temporaryPassword: string;
  };
  message: string;
}
```

**DELETE /api/admin/users/:id**
```typescript
Headers: Authorization: Bearer <token>

Response:
{
  success: boolean;
  message: string;
}
```

#### User Profile Endpoints

**GET /api/users/profile**
```typescript
Headers: Authorization: Bearer <token>

Response:
{
  success: boolean;
  data: {
    id: number;
    username: string;
    invitationCode: string;
    invitedByCode: string | null;
    role: string;
    createdAt: string;
    lastLoginAt: string;
  };
}
```

**PUT /api/users/password**
```typescript
Headers: Authorization: Bearer <token>

Request:
{
  currentPassword: string;
  newPassword: string;
}

Response:
{
  success: boolean;
  message: string;
}
```

#### Invitation Endpoints

**GET /api/invitations/stats**
```typescript
Headers: Authorization: Bearer <token>

Response:
{
  success: boolean;
  data: {
    invitationCode: string;
    totalInvites: number;
    invitedUsers: Array<{
      username: string;
      createdAt: string;
    }>;
  };
}
```

**POST /api/invitations/validate**
```typescript
Request:
{
  invitationCode: string;
}

Response:
{
  success: boolean;
  data: {
    valid: boolean;
    inviterUsername?: string;
  };
}
```

### 3. WebSocket Events

#### Server to Client Events

**user:updated**
```typescript
{
  type: 'user:updated';
  payload: {
    userId: number;
    username: string;
    role: string;
  };
}
```

**user:deleted**
```typescript
{
  type: 'user:deleted';
  payload: {
    userId: number;
  };
}
```

**user:password-changed**
```typescript
{
  type: 'user:password-changed';
  payload: {
    userId: number;
  };
}
```

#### Client to Server Events

**subscribe:user**
```typescript
{
  type: 'subscribe:user';
  payload: {
    userId: number;
  };
}
```

### 4. Frontend Components

#### Landing Website Components

**RegistrationPage**
```typescript
interface RegistrationFormData {
  username: string;
  password: string;
  confirmPassword: string;
  invitationCode?: string;
}

// Features:
// - Real-time username availability check
// - Password strength indicator
// - Optional invitation code field with validation
// - Inline error messages
// - Auto-login after successful registration
```

**UserManagementPage (Admin Only)**
```typescript
interface UserManagementPageProps {
  currentUser: User;
}

// Features:
// - Searchable user table with pagination
// - Sort by username, registration date, invited count
// - Quick actions: view details, reset password, delete
// - Bulk selection for batch operations
// - Export user list to CSV
```

**UserDetailModal**
```typescript
interface UserDetailModalProps {
  userId: number;
  onClose: () => void;
  onUpdate: (user: User) => void;
}

// Features:
// - Display full user information
// - Edit username and role
// - View invitation statistics
// - List of invited users
// - Reset password button
// - Delete user button with confirmation
```

**ProfilePage**
```typescript
interface ProfilePageProps {
  user: User;
}

// Features:
// - Display user information
// - Change password modal
// - Invitation code display with copy button
// - Invitation statistics
// - List of invited users
```

**InvitationDashboard**
```typescript
interface InvitationDashboardProps {
  invitationCode: string;
  stats: InvitationStats;
}

// Features:
// - Large invitation code display
// - Copy to clipboard button
// - Total invites counter with animation
// - Invited users list with registration dates
// - Shareable invitation link generator
```

#### Client and Windows App Components

**UserDataSync Service**
```typescript
interface UserDataSyncService {
  connect(): void;
  disconnect(): void;
  onUserUpdated(callback: (user: User) => void): void;
  onUserDeleted(callback: (userId: number) => void): void;
  onPasswordChanged(callback: (userId: number) => void): void;
}

// Features:
// - Automatic WebSocket connection management
// - Reconnection with exponential backoff
// - Event subscription and unsubscription
// - Local cache invalidation on updates
```

## Data Models

### User Model

```typescript
interface User {
  id: number;
  username: string;
  passwordHash: string;
  invitationCode: string;
  invitedByCode: string | null;
  role: 'admin' | 'user';
  isTempPassword: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

// Validation rules:
// - username: 3-20 characters, alphanumeric and underscore only
// - password: minimum 6 characters
// - invitationCode: exactly 6 characters, lowercase letters and numbers
```

### Invitation Code Generation

```typescript
interface InvitationCodeGenerator {
  generate(): string;
  validate(code: string): boolean;
  isUnique(code: string): Promise<boolean>;
}

// Algorithm:
// - Character set: [a-z0-9] (36 characters)
// - Length: 6 characters
// - Total combinations: 36^6 = 2,176,782,336
// - Generation method: crypto.randomBytes for security
// - Collision handling: retry with new random code (max 10 attempts)
// - Format: lowercase only for consistency and readability
```

### Session Token Model

```typescript
interface AccessToken {
  userId: number;
  username: string;
  role: string;
  iat: number;  // issued at
  exp: number;  // expiration
}

interface RefreshToken {
  userId: number;
  iat: number;
  exp: number;
}

// Token configuration:
// - Access token expiry: 1 hour
// - Refresh token expiry: 7 days
// - Algorithm: HS256 (HMAC with SHA-256)
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Successful Registration Creates Valid Account

*For any* valid username and password (meeting format requirements), submitting registration data SHALL create a new user account with a unique ID, a unique 6-character invitation code, and a hashed password that verifies correctly.

**Validates: Requirements 1.2, 1.5, 1.7, 2.1**

### Property 2: Unique Username Constraint

*For any* two user registration attempts with the same username, the second registration SHALL be rejected and the first user's account SHALL remain unchanged.

**Validates: Requirements 1.3**

### Property 3: Password Minimum Length Validation

*For any* password input (registration or change) with length less than 6 characters, the operation SHALL be rejected with a validation error.

**Validates: Requirements 1.4, 5.2**

### Property 4: Password Hashing Security

*For any* user registration or password change, the stored password_hash SHALL never equal the plain text password, SHALL be generated using bcrypt with at least 10 salt rounds, and verifying the plain text password against the hash SHALL always succeed.

**Validates: Requirements 1.5, 5.3, 9.1**

### Property 5: Auto-Login After Registration

*For any* successful registration, the response SHALL include a valid JWT token that can be used to authenticate the newly created user immediately.

**Validates: Requirements 1.6**

### Property 6: Invitation Code Format and Uniqueness

*For any* newly created user account, the generated invitation_code SHALL contain exactly 6 characters using only lowercase letters (a-z) and numbers (0-9), and SHALL be unique across all existing users in the database.

**Validates: Requirements 2.1, 2.2**

### Property 7: Invitation Statistics Accuracy

*For any* user, the invitation statistics SHALL display the correct count of invited users and the list SHALL contain all users whose invited_by_code matches the user's invitation_code.

**Validates: Requirements 2.5, 2.6, 4.5**

### Property 8: Invitation Relationship Integrity

*For any* user who registers with a valid invitation code, the invited_by_code field SHALL be set to that code, and querying the inviter's referral list SHALL include that user with the inviter's total count increased by exactly one.

**Validates: Requirements 2.7, 3.3**

### Property 9: Invitation Code Validation

*For any* invitation code entered during registration, if the code exists in the database, the registration SHALL succeed and establish the inviter relationship; if the code does not exist, the registration SHALL succeed but display a warning and not establish any inviter relationship.

**Validates: Requirements 3.2, 3.4**

### Property 10: Optional Invitation Code

*For any* registration without an invitation code, the account SHALL be created successfully with invited_by_code set to null.

**Validates: Requirements 3.5**

### Property 11: User Search Functionality

*For any* search query on the user management page, the results SHALL contain only users whose username contains the search string (case-insensitive).

**Validates: Requirements 4.2**

### Property 12: Pagination Correctness

*For any* page number and page size, the user list SHALL return exactly page_size users (or fewer on the last page), and the total count SHALL match the actual number of users in the database.

**Validates: Requirements 4.3**

### Property 13: Admin Update Persistence

*For any* admin update to user information (username or role), the changes SHALL be persisted to the database and reflected in subsequent queries.

**Validates: Requirements 4.6**

### Property 14: Password Change Validation

*For any* password change attempt, if the current password is incorrect, the change SHALL be rejected; if the current password is correct and the new password meets requirements, the change SHALL succeed.

**Validates: Requirements 5.1, 5.5**

### Property 15: Session Invalidation on Password Change

*For any* user who changes their password (or has it reset by an admin), all previously issued access tokens SHALL become invalid and fail authentication, except for the current session if the user initiated the change.

**Validates: Requirements 5.4, 6.4**

### Property 16: Temporary Password Flow

*For any* user whose password is reset by an administrator, the is_temp_password flag SHALL be set to true, and when that user logs in, the response SHALL indicate that a password change is required before accessing other features.

**Validates: Requirements 6.1, 6.3**

### Property 17: Real-Time User Update Synchronization

*For any* user profile update on the marketing website, all connected WebSocket clients subscribed to that user SHALL receive a user:updated event containing the new user data.

**Validates: Requirements 7.1, 7.3**

### Property 18: Real-Time User Deletion Synchronization

*For any* user deletion on the marketing website, all connected WebSocket clients for that user SHALL receive a user:deleted event and SHALL terminate the user's session immediately.

**Validates: Requirements 7.2**

### Property 19: WebSocket Event Handling

*For any* WebSocket event received by a client (user:updated, user:deleted, user:password-changed), the client SHALL update its local user data cache and refresh the UI to reflect the changes.

**Validates: Requirements 7.5**

### Property 20: Foreign Key Constraint Enforcement

*For any* user registration with an invited_by_code, if the code does not exist as an invitation_code in the users table, the database SHALL reject the insertion (or the application SHALL validate before insertion).

**Validates: Requirements 8.5**

### Property 21: Rate Limiting Enforcement

*For any* IP address that makes more than 5 failed login attempts within 15 minutes, subsequent login attempts from that IP SHALL be rejected with a rate limit error until the time window expires.

**Validates: Requirements 9.3**

### Property 22: Password Confidentiality

*For any* API response, log entry, or error message, plain text passwords SHALL never be included or exposed.

**Validates: Requirements 9.4**

### Property 23: Cross-Platform API Consistency

*For any* authentication or user data request from any platform (landing, client, Windows), the API SHALL return data in the same format with consistent field names and types.

**Validates: Requirements 10.2**

### Property 24: Error Response Consistency

*For any* error condition, the API SHALL return an error response with a consistent structure including success: false, message, and optional errors array.

**Validates: Requirements 10.3**

### Property 25: JWT Token Cross-Platform Validity

*For any* JWT token generated by the authentication system, the token SHALL be valid and decodable using the same secret across all platforms (landing, client, Windows).

**Validates: Requirements 10.4**

### Property 26: User-Friendly Error Messages

*For any* error response, the message SHALL be user-friendly and SHALL NOT expose technical details such as stack traces, database errors, or internal system information.

**Validates: Requirements 11.4**

## Error Handling

### Error Categories

**Validation Errors (400 Bad Request)**
- Invalid username format (too short, too long, invalid characters)
- Password too short (less than 6 characters)
- Username already exists
- Mismatched password confirmation
- Invalid invitation code format

**Authentication Errors (401 Unauthorized)**
- Invalid credentials
- Expired token
- Invalid token signature
- Missing authentication token
- Temporary password requires change

**Authorization Errors (403 Forbidden)**
- Insufficient permissions for admin operations
- Attempting to modify another user's data
- Rate limit exceeded

**Resource Errors (404 Not Found)**
- User not found
- Invitation code not found

**Server Errors (500 Internal Server Error)**
- Database connection failure
- Password hashing failure
- Token generation failure
- WebSocket connection failure

### Error Response Format

```typescript
interface ErrorResponse {
  success: false;
  message: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
  code?: string;
}
```

### Error Handling Strategy

1. **Input Validation**: Validate all inputs on both frontend and backend
2. **Graceful Degradation**: Show user-friendly error messages
3. **Security**: Never expose sensitive information in error messages
4. **Logging**: Log all errors server-side with context
5. **Retry Logic**: Implement exponential backoff for WebSocket reconnection
6. **User Feedback**: Provide clear, actionable error messages

## Security Considerations

### Password Security

- **Hashing Algorithm**: bcrypt with salt rounds = 10
- **Storage**: Never store plain text passwords
- **Transmission**: Always use HTTPS for password transmission
- **Validation**: Enforce minimum password length (6 characters)
- **Temporary Passwords**: Flag temporary passwords and force change on first login

### Token Security

- **JWT Secret**: Store in environment variables, never in code
- **Token Expiry**: Short-lived access tokens (1 hour)
- **Refresh Tokens**: Longer-lived (7 days), stored in database
- **Token Rotation**: Generate new refresh token on each refresh
- **Revocation**: Delete refresh tokens from database on logout

### Rate Limiting

- **Login Attempts**: Maximum 5 failed attempts per IP per 15 minutes
- **Registration**: Maximum 3 registrations per IP per hour
- **Implementation**: Use express-rate-limit middleware
- **Storage**: Track attempts in database for persistence

### WebSocket Security

- **Authentication**: Require valid JWT token for WebSocket connection
- **Authorization**: Only send events to authorized clients
- **Encryption**: Use WSS (WebSocket Secure) in production
- **Validation**: Validate all incoming WebSocket messages

### CORS Configuration

```typescript
const corsOptions = {
  origin: [
    process.env.LANDING_URL,
    process.env.CLIENT_URL,
    'http://localhost:5173',  // Development
    'http://localhost:5174'   // Development
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
```

## Real-Time Synchronization Design

### WebSocket Architecture

The system uses WebSocket connections to provide real-time synchronization of user data across all platforms. This ensures that when an administrator updates user information on the marketing website, the changes are immediately reflected on the client and Windows applications.

### Connection Management

```typescript
class WebSocketManager {
  private connections: Map<number, Set<WebSocket>>;
  
  // Subscribe a client to user updates
  subscribe(userId: number, ws: WebSocket): void;
  
  // Unsubscribe a client
  unsubscribe(userId: number, ws: WebSocket): void;
  
  // Broadcast event to all subscribed clients
  broadcast(userId: number, event: WebSocketEvent): void;
  
  // Handle client disconnection
  handleDisconnect(ws: WebSocket): void;
}
```

### Event Flow

1. **User Update on Marketing Website**:
   - Admin updates user data via API
   - Backend updates database
   - Backend broadcasts `user:updated` event via WebSocket
   - All connected clients receive event
   - Clients update local cache and refresh UI

2. **Password Change**:
   - User or admin changes password
   - Backend updates database
   - Backend broadcasts `user:password-changed` event
   - All clients except current session invalidate tokens
   - Affected clients redirect to login page

3. **User Deletion**:
   - Admin deletes user via API
   - Backend deletes from database
   - Backend broadcasts `user:deleted` event
   - All clients for that user log out immediately
   - Clients redirect to login page

### Reconnection Strategy

```typescript
class WebSocketClient {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseDelay = 1000; // 1 second
  
  reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }
    
    const delay = this.baseDelay * Math.pow(2, this.reconnectAttempts);
    setTimeout(() => {
      this.connect();
      this.reconnectAttempts++;
    }, delay);
  }
}
```

## Testing Strategy

### Unit Testing

**Backend Services:**
- AuthService: password hashing, validation, user creation
- InvitationService: code generation, uniqueness validation, referral tracking
- TokenService: JWT generation, validation, expiry
- UserService: CRUD operations, admin operations
- WebSocketService: event broadcasting, subscription management

**Frontend Components:**
- Form validation logic
- Input sanitization
- Error message display
- State management
- WebSocket event handling

### Property-Based Testing

All correctness properties listed above will be implemented as property-based tests using fast-check for TypeScript. Each test will:

- Run a minimum of 100 iterations
- Generate random valid and invalid inputs
- Verify the property holds across all test cases
- Tag format: **Feature: user-management-enhancement, Property {number}: {property_text}**

### Integration Testing

- End-to-end registration flow
- Login and token refresh flow
- Password change flow
- Admin user management flow
- Invitation code usage flow
- WebSocket synchronization flow
- Cross-platform authentication

### Manual Testing Checklist

- [ ] Register new user on landing page
- [ ] Login on client app with new credentials
- [ ] Verify token works across all platforms
- [ ] Change password on landing and verify sync to other platforms
- [ ] Admin: view user list with pagination and search
- [ ] Admin: view user details and invitation statistics
- [ ] Admin: reset user password and verify temporary password flow
- [ ] Admin: delete user and verify immediate logout on all platforms
- [ ] Register with invitation code and verify referral tracking
- [ ] Test WebSocket reconnection after network interruption
- [ ] Test rate limiting behavior
- [ ] Verify HTTPS enforcement in production

## Implementation Notes

### Phase 1: Backend Foundation
1. Database schema migration
2. InvitationService implementation
3. Enhanced AuthService with registration
4. UserService for profile and admin operations
5. WebSocketService for real-time sync
6. API endpoints implementation

### Phase 2: Frontend - Landing Website
1. Registration page with invitation code support
2. User management dashboard (admin only)
3. User detail modal with edit capabilities
4. Profile management page
5. Invitation dashboard
6. WebSocket client integration

### Phase 3: Frontend - Client Application
1. WebSocket client integration
2. User data sync service
3. Automatic logout on user deletion
4. Token invalidation on password change

### Phase 4: Frontend - Windows Application
1. WebSocket client integration
2. User data sync service
3. Automatic logout on user deletion
4. Token invalidation on password change

### Phase 5: Testing and Refinement
1. Property-based tests
2. Integration tests
3. Security audit
4. Performance optimization
5. Load testing for WebSocket connections

## Performance Considerations

### Database Optimization

- Indexes on frequently queried fields (username, invitation_code, invited_by_code)
- Connection pooling for database connections
- Prepared statements for common queries
- Efficient pagination queries with LIMIT and OFFSET

### Caching Strategy

- Cache user profile data in frontend (invalidate on WebSocket event)
- Cache invitation statistics (refresh on page load)
- No caching of authentication tokens (security)
- Redis for rate limiting counters (optional)

### WebSocket Optimization

- Connection pooling for WebSocket server
- Efficient event routing to subscribed clients only
- Heartbeat mechanism to detect dead connections
- Automatic cleanup of disconnected clients

### Frontend Optimization

- Lazy loading of admin dashboard components
- Debounce username availability checks (300ms)
- Optimistic UI updates for non-critical operations
- Virtual scrolling for large user lists

## Deployment Considerations

### Environment Variables

```bash
# Backend
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-secret-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d
WEBSOCKET_PORT=8080
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-in-production

# Frontend
VITE_API_URL=https://api.example.com
VITE_WS_URL=wss://api.example.com
VITE_LANDING_URL=https://landing.example.com
VITE_CLIENT_URL=https://app.example.com
```

### Database Migration

```sql
-- Migration script to add invitation code fields to existing users table
ALTER TABLE users ADD COLUMN invitation_code VARCHAR(6) UNIQUE;
ALTER TABLE users ADD COLUMN invited_by_code VARCHAR(6);
ALTER TABLE users ADD COLUMN is_temp_password BOOLEAN DEFAULT FALSE;

-- Generate invitation codes for existing users
UPDATE users SET invitation_code = generate_invitation_code() WHERE invitation_code IS NULL;

-- Add indexes
CREATE INDEX idx_users_invitation_code ON users(invitation_code);
CREATE INDEX idx_users_invited_by_code ON users(invited_by_code);

-- Add foreign key constraint
ALTER TABLE users ADD CONSTRAINT fk_invited_by 
  FOREIGN KEY (invited_by_code) REFERENCES users(invitation_code) ON DELETE SET NULL;

-- Create login attempts table
CREATE TABLE login_attempts (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  success BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_login_attempts_username ON login_attempts(username);
CREATE INDEX idx_login_attempts_ip ON login_attempts(ip_address);
```

### Monitoring and Logging

- Log all authentication attempts (success and failure)
- Monitor failed login rate for security alerts
- Track invitation code usage metrics
- Monitor WebSocket connection count and health
- Track token refresh patterns
- Alert on unusual registration patterns
- Monitor database query performance

## Future Enhancements

1. **Email Integration**: Add email field and verification flow
2. **Two-Factor Authentication**: SMS or authenticator app support
3. **Social Login**: OAuth integration (Google, GitHub, etc.)
4. **Password Reset**: Email-based password recovery
5. **Account Deletion**: Self-service account deletion with confirmation
6. **Invitation Rewards**: Gamification for referrals (badges, points)
7. **Advanced Password Requirements**: Complexity rules, password history
8. **Session Management**: View and revoke active sessions
9. **Audit Log**: Track all account changes with timestamps
10. **Bulk Operations**: Bulk user import/export, bulk password reset
11. **User Groups**: Organize users into groups for easier management
12. **Activity Dashboard**: Visualize user registration trends and invitation performance
