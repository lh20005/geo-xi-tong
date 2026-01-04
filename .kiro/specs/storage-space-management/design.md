# Design Document: Storage Space Management

## Overview

The Storage Space Management system provides comprehensive tracking, enforcement, and visualization of storage quotas across the GEO optimization platform. The system tracks storage consumption for three resource types (images, documents, articles), enforces configurable quotas per subscription plan, and provides real-time usage monitoring with visual breakdowns in the user center.

### Key Design Goals

1. **Accurate Tracking**: Maintain precise storage usage counters for each resource type
2. **Performance**: Minimize overhead of storage checks through caching and indexing
3. **User Isolation**: Ensure complete separation of storage data between users
4. **Real-time Updates**: Provide instant feedback on storage usage via WebSocket
5. **Scalability**: Support efficient queries as user base and storage data grows
6. **Data Integrity**: Prevent race conditions and ensure consistency during concurrent operations

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                          │
├─────────────────────────────────────────────────────────────┤
│  UserCenterPage  │  UploadComponents  │  StorageVisualization│
└────────┬─────────────────┬──────────────────────┬───────────┘
         │                 │                      │
         │ REST API        │ REST API             │ WebSocket
         │                 │                      │
┌────────▼─────────────────▼──────────────────────▼───────────┐
│                     Backend Layer                            │
├─────────────────────────────────────────────────────────────┤
│  StorageService  │  StorageQuotaService  │  StorageAlertService│
│  ├─ Track Usage  │  ├─ Check Quota       │  ├─ Monitor Thresholds│
│  ├─ Calculate    │  ├─ Enforce Limits    │  ├─ Send Alerts      │
│  └─ Cleanup      │  └─ Validate Files    │  └─ WebSocket Notify │
└────────┬─────────────────┬──────────────────────┬───────────┘
         │                 │                      │
         │ SQL Queries     │ Redis Cache          │ WebSocket
         │                 │                      │
┌────────▼─────────────────▼──────────────────────▼───────────┐
│                     Data Layer                               │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL                │  Redis Cache                    │
│  ├─ user_storage_usage     │  ├─ storage:user:{id}          │
│  ├─ storage_usage_history  │  └─ storage:quota:{id}         │
│  ├─ plan_features          │                                 │
│  └─ quota_alerts           │                                 │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

#### Upload Flow
```
1. User initiates file upload
2. Frontend sends file metadata to backend
3. StorageQuotaService checks available quota
4. If quota available:
   a. File is saved to disk
   b. StorageService records usage
   c. Cache is invalidated
   d. WebSocket notifies user of updated usage
5. If quota exceeded:
   a. Upload is rejected
   b. Error message returned to user
```

#### Deletion Flow
```
1. User deletes resource
2. Backend validates ownership
3. StorageService decrements usage counter
4. File is removed from disk
5. Cache is invalidated
6. WebSocket notifies user of updated usage
```

## Components and Interfaces

### 1. Database Schema

#### user_storage_usage Table
```sql
CREATE TABLE user_storage_usage (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Storage usage by resource type (in bytes)
  image_storage_bytes BIGINT DEFAULT 0,
  document_storage_bytes BIGINT DEFAULT 0,
  article_storage_bytes BIGINT DEFAULT 0,
  total_storage_bytes BIGINT GENERATED ALWAYS AS 
    (image_storage_bytes + document_storage_bytes + article_storage_bytes) STORED,
  
  -- Item counts
  image_count INTEGER DEFAULT 0,
  document_count INTEGER DEFAULT 0,
  article_count INTEGER DEFAULT 0,
  
  -- Quota information (in bytes)
  storage_quota_bytes BIGINT NOT NULL, -- -1 for unlimited
  purchased_storage_bytes BIGINT DEFAULT 0, -- Additional purchased storage
  
  -- Timestamps
  last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_user_storage UNIQUE (user_id),
  CONSTRAINT check_non_negative_storage CHECK (
    image_storage_bytes >= 0 AND 
    document_storage_bytes >= 0 AND 
    article_storage_bytes >= 0
  ),
  CONSTRAINT check_non_negative_counts CHECK (
    image_count >= 0 AND 
    document_count >= 0 AND 
    article_count >= 0
  )
);

CREATE INDEX idx_user_storage_user_id ON user_storage_usage(user_id);
CREATE INDEX idx_user_storage_quota_exceeded ON user_storage_usage(user_id) 
  WHERE total_storage_bytes >= storage_quota_bytes AND storage_quota_bytes != -1;
```

#### storage_usage_history Table
```sql
CREATE TABLE storage_usage_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Snapshot of usage at this point in time
  image_storage_bytes BIGINT NOT NULL,
  document_storage_bytes BIGINT NOT NULL,
  article_storage_bytes BIGINT NOT NULL,
  total_storage_bytes BIGINT NOT NULL,
  
  -- Snapshot date
  snapshot_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_user_snapshot UNIQUE (user_id, snapshot_date)
);

CREATE INDEX idx_storage_history_user_date ON storage_usage_history(user_id, snapshot_date DESC);
```

#### storage_transactions Table
```sql
CREATE TABLE storage_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Transaction details
  resource_type VARCHAR(20) NOT NULL CHECK (resource_type IN ('image', 'document', 'article')),
  resource_id INTEGER NOT NULL,
  operation VARCHAR(10) NOT NULL CHECK (operation IN ('add', 'remove')),
  size_bytes BIGINT NOT NULL,
  
  -- Metadata
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_storage_transactions_user ON storage_transactions(user_id, created_at DESC);
CREATE INDEX idx_storage_transactions_resource ON storage_transactions(resource_type, resource_id);
```

### 2. StorageService

```typescript
interface StorageUsage {
  userId: number;
  imageStorageBytes: number;
  documentStorageBytes: number;
  articleStorageBytes: number;
  totalStorageBytes: number;
  imageCount: number;
  documentCount: number;
  articleCount: number;
  storageQuotaBytes: number;
  purchasedStorageBytes: number;
  availableBytes: number;
  usagePercentage: number;
}

interface StorageBreakdown {
  images: {
    sizeBytes: number;
    count: number;
    percentage: number;
  };
  documents: {
    sizeBytes: number;
    count: number;
    percentage: number;
  };
  articles: {
    sizeBytes: number;
    count: number;
    percentage: number;
  };
}

class StorageService {
  /**
   * Get current storage usage for a user
   */
  async getUserStorageUsage(userId: number): Promise<StorageUsage>;
  
  /**
   * Get storage breakdown by resource type
   */
  async getStorageBreakdown(userId: number): Promise<StorageBreakdown>;
  
  /**
   * Record storage usage for a new resource
   */
  async recordStorageUsage(
    userId: number,
    resourceType: 'image' | 'document' | 'article',
    resourceId: number,
    sizeBytes: number,
    metadata?: any
  ): Promise<void>;
  
  /**
   * Remove storage usage for a deleted resource
   */
  async removeStorageUsage(
    userId: number,
    resourceType: 'image' | 'document' | 'article',
    resourceId: number,
    sizeBytes: number
  ): Promise<void>;
  
  /**
   * Initialize storage tracking for a new user
   */
  async initializeUserStorage(
    userId: number,
    quotaBytes: number
  ): Promise<void>;
  
  /**
   * Update user's storage quota (e.g., after plan change)
   */
  async updateStorageQuota(
    userId: number,
    newQuotaBytes: number
  ): Promise<void>;
  
  /**
   * Add purchased storage to user's quota
   */
  async addPurchasedStorage(
    userId: number,
    additionalBytes: number
  ): Promise<void>;
  
  /**
   * Get storage usage history for a date range
   */
  async getStorageHistory(
    userId: number,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{
    date: Date;
    totalBytes: number;
    imageBytes: number;
    documentBytes: number;
    articleBytes: number;
  }>>;
  
  /**
   * Create daily storage snapshot (called by cron job)
   */
  async createDailySnapshot(userId: number): Promise<void>;
  
  /**
   * Reconcile storage usage with actual files on disk
   */
  async reconcileStorage(userId: number): Promise<{
    calculated: StorageUsage;
    actual: StorageUsage;
    discrepancy: number;
  }>;
}
```

### 3. StorageQuotaService

```typescript
interface QuotaCheckResult {
  allowed: boolean;
  currentUsageBytes: number;
  quotaBytes: number;
  availableBytes: number;
  usagePercentage: number;
  reason?: string;
}

class StorageQuotaService {
  /**
   * Check if a file upload would exceed quota
   */
  async checkQuota(
    userId: number,
    fileSizeBytes: number
  ): Promise<QuotaCheckResult>;
  
  /**
   * Validate file size against maximum limits
   */
  async validateFileSize(
    resourceType: 'image' | 'document' | 'article',
    fileSizeBytes: number
  ): Promise<{
    valid: boolean;
    maxSizeBytes: number;
    reason?: string;
  }>;
  
  /**
   * Get user's effective storage quota (plan + purchased)
   */
  async getEffectiveQuota(userId: number): Promise<number>;
  
  /**
   * Check if user has unlimited storage
   */
  async hasUnlimitedStorage(userId: number): Promise<boolean>;
}
```

### 4. StorageAlertService

```typescript
interface StorageAlert {
  id: number;
  userId: number;
  alertType: 'warning' | 'critical' | 'depleted';
  thresholdPercentage: number;
  currentUsageBytes: number;
  quotaBytes: number;
  isSent: boolean;
  createdAt: Date;
}

class StorageAlertService {
  /**
   * Check storage usage and create alerts if thresholds exceeded
   */
  async checkAndCreateAlerts(userId: number): Promise<StorageAlert[]>;
  
  /**
   * Send storage alert via WebSocket
   */
  async sendStorageAlert(userId: number, alert: StorageAlert): Promise<void>;
  
  /**
   * Get pending alerts for a user
   */
  async getPendingAlerts(userId: number): Promise<StorageAlert[]>;
  
  /**
   * Mark alert as sent
   */
  async markAlertSent(alertId: number): Promise<void>;
}
```

### 5. REST API Endpoints

```typescript
// Get current storage usage
GET /api/storage/usage
Response: {
  success: boolean;
  data: StorageUsage;
}

// Get storage breakdown
GET /api/storage/breakdown
Response: {
  success: boolean;
  data: StorageBreakdown;
}

// Check if file upload is allowed
POST /api/storage/check-quota
Body: {
  fileSizeBytes: number;
  resourceType: 'image' | 'document' | 'article';
}
Response: {
  success: boolean;
  data: QuotaCheckResult;
}

// Get storage usage history
GET /api/storage/history?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
Response: {
  success: boolean;
  data: Array<HistoryEntry>;
}

// Get storage transactions
GET /api/storage/transactions?page=1&pageSize=20
Response: {
  success: boolean;
  data: {
    transactions: Array<Transaction>;
    pagination: PaginationInfo;
  };
}

// Admin: Get all users' storage usage
GET /api/admin/storage/users?page=1&pageSize=20
Response: {
  success: boolean;
  data: {
    users: Array<UserStorageInfo>;
    pagination: PaginationInfo;
  };
}

// Admin: Update user's storage quota
PUT /api/admin/storage/quota/:userId
Body: {
  quotaBytes: number;
  reason: string;
}
Response: {
  success: boolean;
  message: string;
}

// Admin: Reconcile user's storage
POST /api/admin/storage/reconcile/:userId
Response: {
  success: boolean;
  data: ReconciliationResult;
}
```

### 6. WebSocket Events

```typescript
// Storage usage updated
Event: 'storage_updated'
Payload: {
  userId: number;
  usage: StorageUsage;
  breakdown: StorageBreakdown;
}

// Storage alert triggered
Event: 'storage_alert'
Payload: {
  userId: number;
  alert: StorageAlert;
  message: string;
}

// Storage quota changed
Event: 'storage_quota_changed'
Payload: {
  userId: number;
  oldQuotaBytes: number;
  newQuotaBytes: number;
  reason: string;
}
```

## Data Models

### Storage Usage Calculation

Storage usage is calculated as the sum of all resource sizes:

```
total_storage_bytes = image_storage_bytes + document_storage_bytes + article_storage_bytes
```

Effective quota includes both plan-based and purchased storage:

```
effective_quota_bytes = storage_quota_bytes + purchased_storage_bytes
```

Usage percentage:

```
usage_percentage = (total_storage_bytes / effective_quota_bytes) * 100
```

For unlimited storage (quota = -1), usage_percentage is always 0.

### File Size Limits

```typescript
const FILE_SIZE_LIMITS = {
  image: 50 * 1024 * 1024,      // 50 MB
  document: 100 * 1024 * 1024,  // 100 MB
  article: 10 * 1024 * 1024     // 10 MB (calculated from content)
};
```

### Default Quotas

```typescript
const DEFAULT_QUOTAS = {
  regular_user: 20 * 1024 * 1024,  // 20 MB
  admin: -1                         // Unlimited
};
```

### Alert Thresholds

```typescript
const ALERT_THRESHOLDS = {
  warning: 80,   // 80% usage
  critical: 95,  // 95% usage
  depleted: 100  // 100% usage
};
```

## Error Handling

### Error Types

```typescript
class StorageQuotaExceededError extends Error {
  constructor(
    public currentUsage: number,
    public quota: number,
    public attemptedSize: number
  ) {
    super(`Storage quota exceeded. Current: ${currentUsage}, Quota: ${quota}, Attempted: ${attemptedSize}`);
  }
}

class FileSizeLimitExceededError extends Error {
  constructor(
    public fileSize: number,
    public maxSize: number,
    public resourceType: string
  ) {
    super(`File size ${fileSize} exceeds maximum ${maxSize} for ${resourceType}`);
  }
}

class StorageReconciliationError extends Error {
  constructor(
    public userId: number,
    public discrepancy: number
  ) {
    super(`Storage reconciliation failed for user ${userId}. Discrepancy: ${discrepancy} bytes`);
  }
}
```

### Error Handling Strategy

1. **Quota Exceeded**: Return 403 Forbidden with detailed error message and upgrade link
2. **File Too Large**: Return 413 Payload Too Large with maximum size information
3. **Storage Reconciliation Failure**: Log error, notify admin, continue with database values
4. **Concurrent Update Conflicts**: Use database transactions with retry logic
5. **Cache Failures**: Fall back to database queries, log warning

## Testing Strategy

### Unit Tests

Unit tests will verify specific behaviors and edge cases:

1. **Storage Calculation Tests**
   - Test total storage calculation with various resource combinations
   - Test usage percentage calculation
   - Test effective quota calculation with purchased storage
   - Test unlimited storage handling (quota = -1)

2. **Quota Enforcement Tests**
   - Test upload rejection when quota exceeded
   - Test upload allowed when quota available
   - Test unlimited storage allows all uploads
   - Test file size limit enforcement

3. **Storage Update Tests**
   - Test storage increment on resource creation
   - Test storage decrement on resource deletion
   - Test storage remains unchanged on update operations
   - Test negative storage values are prevented

4. **Alert Generation Tests**
   - Test warning alert at 80% threshold
   - Test critical alert at 95% threshold
   - Test depleted alert at 100% threshold
   - Test no duplicate alerts within same period

5. **User Isolation Tests**
   - Test users can only access their own storage data
   - Test storage queries filter by authenticated user
   - Test admin can access all users' storage data

### Property-Based Tests

Property-based tests will verify universal correctness properties across all inputs. Each property will be implemented as a separate test with minimum 100 iterations.


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Storage Addition Invariant

*For any* user and any resource (image, document, or article), adding a resource with size S bytes should increase the corresponding resource type storage counter by exactly S bytes and increase the total storage by exactly S bytes.

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 2: Storage Deletion Round-Trip

*For any* user and any resource, adding a resource and then immediately deleting it should return the user's storage usage to its original state (both resource-specific and total storage).

**Validates: Requirements 3.4**

### Property 3: Storage Counter Independence

*For any* user, adding an image should only affect image_storage_bytes and total_storage_bytes, not document_storage_bytes or article_storage_bytes. Similarly for documents and articles.

**Validates: Requirements 3.5**

### Property 4: Total Storage Calculation

*For any* user at any point in time, total_storage_bytes should always equal the sum of image_storage_bytes + document_storage_bytes + article_storage_bytes.

**Validates: Requirements 3.6**

### Property 5: Quota Enforcement for Limited Storage

*For any* user with limited storage quota (quota != -1), attempting to upload a file that would cause total_storage_bytes to exceed (storage_quota_bytes + purchased_storage_bytes) should be rejected.

**Validates: Requirements 4.1, 4.2**

### Property 6: Unlimited Storage Never Rejects

*For any* user with unlimited storage quota (quota = -1), all file uploads should be accepted regardless of file size or current storage usage.

**Validates: Requirements 4.3**

### Property 7: Quota Check Returns Remaining Space

*For any* user and any quota check request, the response should include remaining_bytes calculated as (effective_quota_bytes - total_storage_bytes), where effective_quota_bytes = storage_quota_bytes + purchased_storage_bytes.

**Validates: Requirements 4.7**

### Property 8: User Storage Isolation

*For any* two different users A and B, querying storage usage for user A should never return data about user B's resources, and user A's storage calculations should never include user B's resources.

**Validates: Requirements 5.1, 5.2, 5.4**

### Property 9: Ownership Validation for Deletion

*For any* user attempting to delete a resource, the deletion should only succeed if the resource's owner_id matches the authenticated user's id.

**Validates: Requirements 5.3, 5.5**

### Property 10: Usage Percentage Calculation

*For any* user with limited storage quota, usage_percentage should equal (total_storage_bytes / effective_quota_bytes) * 100, rounded to 2 decimal places.

**Validates: Requirements 6.2**

### Property 11: File Size Unit Formatting

*For any* file size in bytes, the formatted display should use KB for sizes < 1MB, MB for sizes < 1GB, and GB for sizes >= 1GB, with appropriate decimal precision.

**Validates: Requirements 6.4**

### Property 12: Alert Deduplication

*For any* user and any alert threshold (80%, 95%, 100%), creating an alert at that threshold should not create a duplicate alert if an alert of the same type already exists for the current usage period.

**Validates: Requirements 7.6**

### Property 13: API Authentication Enforcement

*For any* storage API endpoint, requests without a valid authentication token should be rejected with 401 Unauthorized status.

**Validates: Requirements 8.5**

### Property 14: API Response Completeness

*For any* storage API response, it should include both raw values in bytes and formatted display values, plus remaining storage space.

**Validates: Requirements 8.6, 8.7**

### Property 15: Admin Quota Modification Logging

*For any* admin action that modifies a user's storage quota, a log entry should be created recording the admin_id, user_id, old_quota, new_quota, and timestamp.

**Validates: Requirements 9.6**

### Property 16: Resource Deletion Cleanup

*For any* resource deletion (image, document, or article), both the file on disk and the storage usage counter should be updated, and if file deletion fails, the usage counter should not be decremented.

**Validates: Requirements 10.1, 10.2, 10.3, 10.4**

### Property 17: Purchased Storage Addition

*For any* user purchasing additional storage of X bytes, their effective quota should increase by exactly X bytes, and multiple purchases should stack cumulatively.

**Validates: Requirements 12.2, 12.3**

### Property 18: Purchased Storage Persistence

*For any* user with purchased storage, changing their subscription plan should not affect the purchased_storage_bytes value.

**Validates: Requirements 12.5**

### Property 19: Storage Growth Rate Calculation

*For any* user and any time period, the storage growth rate should be calculated as (end_storage - start_storage) / number_of_days in the period.

**Validates: Requirements 13.3**

### Property 20: File Size Limit Rejection

*For any* file upload where file_size_bytes exceeds the maximum limit for its resource type, the upload should be rejected with an error message indicating the maximum allowed size.

**Validates: Requirements 14.3**

### Property 21: Cache Invalidation on Update

*For any* storage usage update (add or remove resource), the Redis cache entry for that user's storage data should be deleted or updated.

**Validates: Requirements 15.2**

### Property 22: Transaction Atomicity

*For any* storage usage update operation, either all database changes (usage counters, transaction log, alerts) should be committed together, or none should be committed if any part fails.

**Validates: Requirements 15.5**

### Property 23: Concurrent Update Safety

*For any* two concurrent storage update operations for the same user, the final storage usage should reflect both updates correctly without data loss or corruption.

**Validates: Requirements 3.7, 15.7**

### Property 24: Plan Quota Update Propagation

*For any* user whose subscription plan changes, their storage_quota_bytes should be updated to match the new plan's storage_space feature value.

**Validates: Requirements 2.4**

### Property 25: Resource Preservation on Quota Change

*For any* user whose storage quota changes (increase or decrease), the counts of their existing resources (image_count, document_count, article_count) should remain unchanged.

**Validates: Requirements 2.5**

## Testing Strategy

### Dual Testing Approach

The storage space management system will be validated using both unit tests and property-based tests:

- **Unit Tests**: Verify specific examples, edge cases, and error conditions
- **Property Tests**: Verify universal properties across all inputs

Both testing approaches are complementary and necessary for comprehensive coverage. Unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across a wide range of inputs.

### Property-Based Testing Configuration

We will use **fast-check** (for TypeScript/JavaScript) as our property-based testing library. Each property test will:

- Run a minimum of **100 iterations** to ensure thorough coverage
- Generate random but valid test data (user IDs, file sizes, resource types, etc.)
- Reference the specific design document property being tested
- Use the tag format: **Feature: storage-space-management, Property N: [property_text]**

### Test Organization

```
server/src/__tests__/
├── unit/
│   ├── storage-service.test.ts
│   ├── storage-quota-service.test.ts
│   ├── storage-alert-service.test.ts
│   └── storage-api.test.ts
└── properties/
    ├── storage-invariants.property.test.ts
    ├── storage-quota.property.test.ts
    ├── storage-isolation.property.test.ts
    └── storage-concurrency.property.test.ts
```

### Unit Test Coverage

Unit tests will focus on:

1. **Specific Examples**
   - Default quota allocation (20MB for users, unlimited for admins)
   - Alert generation at exact thresholds (80%, 95%, 100%)
   - File size limit enforcement (50MB images, 100MB documents)
   - API endpoint existence and response format

2. **Edge Cases**
   - Zero-byte files
   - Exactly at quota limit
   - Negative file sizes (should be rejected)
   - Missing or null user IDs
   - Concurrent updates to same user's storage

3. **Error Conditions**
   - Quota exceeded errors
   - File size limit exceeded errors
   - Authentication failures
   - Database transaction failures
   - File system errors during deletion

4. **Integration Points**
   - WebSocket notification delivery
   - Redis cache operations
   - Database transaction handling
   - Plan feature integration

### Property Test Coverage

Property tests will verify:

1. **Invariants** (Properties 1, 3, 4, 25)
   - Storage counters always reflect actual resource sizes
   - Total storage always equals sum of parts
   - Resource type counters are independent

2. **Round-Trip Properties** (Property 2)
   - Add then delete returns to original state

3. **Idempotence** (Property 12)
   - Alert creation doesn't create duplicates

4. **Metamorphic Properties** (Properties 5, 6, 7, 10)
   - Quota enforcement behaves consistently
   - Usage percentage calculation is correct
   - Remaining space calculation is accurate

5. **Model-Based Testing** (Properties 8, 9)
   - User isolation is maintained
   - Ownership validation works correctly

6. **Error Conditions** (Properties 5, 20)
   - Quota exceeded is properly detected
   - File size limits are enforced

7. **Concurrency** (Property 23)
   - Concurrent updates maintain consistency

### Test Data Generators

Property tests will use custom generators for:

```typescript
// Generate random user with storage data
const userWithStorageGen = fc.record({
  userId: fc.integer({ min: 1, max: 10000 }),
  quotaBytes: fc.oneof(
    fc.constant(-1), // unlimited
    fc.integer({ min: 1024 * 1024, max: 1024 * 1024 * 1024 }) // 1MB to 1GB
  ),
  currentUsageBytes: fc.integer({ min: 0, max: 1024 * 1024 * 100 }) // 0 to 100MB
});

// Generate random file upload
const fileUploadGen = fc.record({
  resourceType: fc.constantFrom('image', 'document', 'article'),
  sizeBytes: fc.integer({ min: 1, max: 1024 * 1024 * 150 }), // 1 byte to 150MB
  metadata: fc.object()
});

// Generate random storage operation
const storageOperationGen = fc.oneof(
  fc.record({ type: fc.constant('add'), file: fileUploadGen }),
  fc.record({ type: fc.constant('remove'), resourceId: fc.integer({ min: 1, max: 10000 }) })
);
```

### Performance Testing

While not part of property-based testing, we will also conduct:

- Load testing with 1000+ concurrent users
- Storage query performance benchmarks
- Cache hit rate monitoring
- Database query optimization validation

### Continuous Integration

All tests (unit and property) will run on every commit via CI/CD pipeline:

- Unit tests must pass 100%
- Property tests must pass all 100+ iterations
- Code coverage target: 85% for storage-related code
- Performance regression tests for critical paths

