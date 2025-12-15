# Design Document - 转化目标管理模块

## Overview

转化目标管理模块是一个完整的CRUD系统，用于管理公司画像信息。该模块集成到现有的GEO优化系统中，作为工作台的子功能模块。系统采用前后端分离架构，前端使用React + TypeScript + Ant Design，后端使用Node.js + Express + PostgreSQL。

该模块的核心功能包括：
- 创建和管理公司画像（转化目标）
- 表单验证和数据持久化
- 列表展示、分页、排序和搜索
- 完整的CRUD操作（创建、读取、更新、删除）

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ConversionTargetPage (React Component)              │   │
│  │  - 列表展示                                           │   │
│  │  - 表单对话框                                         │   │
│  │  - 分页、排序、搜索                                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓ HTTP/REST                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                        Server Layer                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Express Router (/api/conversion-targets)            │   │
│  │  - GET    /api/conversion-targets (列表+分页+搜索)   │   │
│  │  - POST   /api/conversion-targets (创建)             │   │
│  │  - GET    /api/conversion-targets/:id (详情)         │   │
│  │  - PATCH  /api/conversion-targets/:id (更新)         │   │
│  │  - DELETE /api/conversion-targets/:id (删除)         │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Validation & Business Logic                         │   │
│  │  - 输入验证                                           │   │
│  │  - 重复检查                                           │   │
│  │  - 错误处理                                           │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      Database Layer                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  PostgreSQL - conversion_targets table               │   │
│  │  - 数据持久化                                         │   │
│  │  - 索引优化                                           │   │
│  │  - 事务支持                                           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend:**
- React 18 with TypeScript
- Ant Design 5.x (UI组件库)
- React Router 6 (路由管理)
- Axios (HTTP客户端)

**Backend:**
- Node.js with Express
- TypeScript
- PostgreSQL (数据库)

**Integration Points:**
- 侧边栏导航：在 `Sidebar.tsx` 中添加新菜单项
- 路由配置：在 `App.tsx` 中添加新路由
- API路由：在 `server/src/routes/index.ts` 中注册新路由

## Components and Interfaces

### Frontend Components

#### 1. ConversionTargetPage (主页面组件)

**职责：**
- 展示转化目标列表
- 管理页面状态（加载、分页、搜索）
- 协调子组件交互

**State:**
```typescript
interface PageState {
  targets: ConversionTarget[];
  loading: boolean;
  currentPage: number;
  pageSize: number;
  total: number;
  searchKeyword: string;
  sortField: string | null;
  sortOrder: 'ascend' | 'descend' | null;
  modalVisible: boolean;
  modalMode: 'create' | 'edit' | 'view';
  selectedTarget: ConversionTarget | null;
}
```

#### 2. ConversionTargetModal (表单对话框组件)

**职责：**
- 处理创建、编辑、查看三种模式
- 表单验证
- 数据提交

**Props:**
```typescript
interface ModalProps {
  visible: boolean;
  mode: 'create' | 'edit' | 'view';
  target: ConversionTarget | null;
  onSubmit: (data: ConversionTargetFormData) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}
```

#### 3. ConversionTargetTable (表格组件)

**职责：**
- 展示转化目标列表
- 处理排序
- 操作按钮（查看、编辑、删除）

**Props:**
```typescript
interface TableProps {
  dataSource: ConversionTarget[];
  loading: boolean;
  pagination: PaginationConfig;
  onPageChange: (page: number, pageSize: number) => void;
  onSort: (field: string, order: 'ascend' | 'descend') => void;
  onView: (target: ConversionTarget) => void;
  onEdit: (target: ConversionTarget) => void;
  onDelete: (id: number) => void;
}
```

### Backend API Endpoints

#### 1. GET /api/conversion-targets

**功能：** 获取转化目标列表（支持分页、搜索、排序）

**Query Parameters:**
```typescript
{
  page?: number;        // 页码，默认1
  pageSize?: number;    // 每页数量，默认10
  search?: string;      // 搜索关键词
  sortField?: string;   // 排序字段
  sortOrder?: 'asc' | 'desc';  // 排序方向
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    targets: ConversionTarget[];
    total: number;
    page: number;
    pageSize: number;
  }
}
```

#### 2. POST /api/conversion-targets

**功能：** 创建新的转化目标

**Request Body:**
```typescript
{
  companyName: string;
  industry: string;
  companySize: string;
  features: string;
  contactInfo: string;
  website: string;
  targetAudience: string;
  coreProducts: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    id: number;
    ...ConversionTarget
  }
}
```

#### 3. GET /api/conversion-targets/:id

**功能：** 获取单个转化目标详情

**Response:**
```typescript
{
  success: boolean;
  data: ConversionTarget;
}
```

#### 4. PATCH /api/conversion-targets/:id

**功能：** 更新转化目标

**Request Body:** 同POST，所有字段可选

**Response:**
```typescript
{
  success: boolean;
  data: ConversionTarget;
}
```

#### 5. DELETE /api/conversion-targets/:id

**功能：** 删除转化目标

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

## Data Models

### ConversionTarget (转化目标)

```typescript
interface ConversionTarget {
  id: number;
  companyName: string;          // 公司名称（必填）
  industry: string;             // 行业类型（必填）
  companySize: string;          // 公司规模（必填）
  features: string;             // 公司特色（可选）
  contactInfo: string;          // 联系方式（必填）
  website: string;              // 官方网站（可选）
  targetAudience: string;       // 目标客户群（可选）
  coreProducts: string;         // 核心产品服务（可选）
  createdAt: Date;              // 创建时间
  updatedAt: Date;              // 更新时间
}
```

### Database Schema

```sql
CREATE TABLE conversion_targets (
  id SERIAL PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  industry VARCHAR(100) NOT NULL,
  company_size VARCHAR(50) NOT NULL,
  features TEXT,
  contact_info VARCHAR(255) NOT NULL,
  website VARCHAR(500),
  target_audience TEXT,
  core_products TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_company_name UNIQUE (company_name)
);

-- 索引
CREATE INDEX idx_conversion_targets_company_name ON conversion_targets(company_name);
CREATE INDEX idx_conversion_targets_industry ON conversion_targets(industry);
CREATE INDEX idx_conversion_targets_created_at ON conversion_targets(created_at DESC);
```

### Form Validation Rules

```typescript
const validationRules = {
  companyName: {
    required: true,
    minLength: 2,
    maxLength: 255,
    message: '公司名称为必填项，长度2-255字符'
  },
  industry: {
    required: true,
    enum: ['互联网', '金融', '制造业', '教育', '医疗', '零售', '其他'],
    message: '请选择行业类型'
  },
  companySize: {
    required: true,
    enum: ['1-50人', '51-200人', '201-500人', '501-1000人', '1000人以上'],
    message: '请选择公司规模'
  },
  contactInfo: {
    required: true,
    pattern: /^1[3-9]\d{9}$|^[\w-]+(\.[\w-]+)*@[\w-]+(\.[\w-]+)+$/,
    message: '请输入有效的手机号或邮箱'
  },
  website: {
    required: false,
    pattern: /^https?:\/\/.+/,
    message: '请输入有效的网址（以http://或https://开头）'
  },
  features: {
    required: false,
    maxLength: 1000
  },
  targetAudience: {
    required: false,
    maxLength: 500
  },
  coreProducts: {
    required: false,
    maxLength: 1000
  }
};
```

## 
Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified several areas where properties can be consolidated:

**Redundancy Analysis:**
1. Properties 3.1, 3.3, 3.4 (validation for different fields) can be combined into a single comprehensive validation property
2. Properties 3.2, 3.7, 3.8 (text input acceptance) are similar and can be combined
3. Properties 5.2, 5.3, 5.4 (post-save UI updates) can be combined into a single property about UI state consistency
4. Properties 6.2-6.7 (table column display) are testing the same rendering behavior and can be combined
5. Properties 7.3, 7.4, 7.5 (pagination navigation) can be combined into a single pagination property
6. Properties 9.4 and 9.5 (update and refresh) can be combined
7. Properties 10.3 and 10.4 (delete and refresh) can be combined
8. Properties 12.2 and 12.3 (search matching) can be combined into the general search property 12.1
9. Properties 13.1, 13.2, 13.3, 13.4 (database operations) represent the same persistence guarantee

**Consolidated Properties:**

Property 1: Form field validation consistency
*For any* form input data, the validation result should match the defined validation rules for each field type (company name length, contact format, URL format, etc.)
**Validates: Requirements 3.1, 3.3, 3.4, 4.2, 4.3**

Property 2: Text input acceptance
*For any* text or multi-line text input within the maximum length limit, the system should accept and store the input without modification
**Validates: Requirements 3.2, 3.7, 3.8**

Property 3: Valid form submission enables action
*For any* form data where all required fields are filled and all validations pass, the submit button should be enabled
**Validates: Requirements 4.5**

Property 4: Data persistence round trip
*For any* valid conversion target data, creating it in the system and then querying it back should return equivalent data
**Validates: Requirements 5.1, 13.1, 13.4**

Property 5: Successful save triggers UI updates
*For any* successful save operation, the system should close the modal, refresh the list to include the new record, and display a success message
**Validates: Requirements 5.2, 5.3, 5.4**

Property 6: List display completeness
*For any* conversion target in the database, when displayed in the table, all required columns (company name, industry, company size, contact info, created time, actions) should be present
**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7**

Property 7: Pagination consistency
*For any* list of conversion targets, the system should display exactly 10 records per page (or fewer on the last page), and the total count across all pages should equal the total number of records
**Validates: Requirements 7.1, 7.6**

Property 8: Pagination navigation correctness
*For any* page number within valid range, navigating to that page should display the correct subset of records based on page size
**Validates: Requirements 7.3, 7.4, 7.5**

Property 9: Detail view completeness
*For any* conversion target, when viewed in detail mode, all fields should be displayed in read-only format with their correct values
**Validates: Requirements 8.2, 8.3**

Property 10: Edit form pre-population
*For any* existing conversion target, opening the edit form should pre-populate all fields with the current values from the database
**Validates: Requirements 9.1, 9.2**

Property 11: Update operation consistency
*For any* valid update to a conversion target, the system should persist the changes to the database and refresh the list to display the updated values
**Validates: Requirements 9.3, 9.4, 9.5**

Property 12: Delete operation consistency
*For any* conversion target, after successful deletion, the record should be removed from the database and no longer appear in the list
**Validates: Requirements 10.3, 10.4**

Property 13: Sort order correctness
*For any* sortable column, clicking to sort should order all records by that column's values in the specified direction (ascending or descending)
**Validates: Requirements 11.1, 11.2**

Property 14: Sort preserves pagination
*For any* sorted list, pagination should continue to work correctly with the sorted order maintained across pages
**Validates: Requirements 11.3**

Property 15: Sort indicator consistency
*For any* sorted column, the UI should display the correct sort indicator (ascending or descending arrow) matching the current sort state
**Validates: Requirements 11.4**

Property 16: Search filter correctness
*For any* search keyword, the filtered results should only include records where the keyword appears in the company name or industry fields (case-insensitive)
**Validates: Requirements 12.1, 12.2, 12.3**

Property 17: Search clear restores full list
*For any* list state, applying a search filter and then clearing it should restore the original full list of records
**Validates: Requirements 12.4**

Property 18: Database operation persistence
*For any* create, update, or delete operation, the changes should be persisted to the database and survive application restarts
**Validates: Requirements 13.1, 13.2, 13.3**

## Error Handling

### Client-Side Error Handling

**Form Validation Errors:**
- Display inline error messages below invalid fields
- Prevent form submission until all errors are resolved
- Use Ant Design's Form validation feedback (red border, error icon, error text)

**Network Errors:**
- Display toast notifications for failed API calls
- Provide retry options for transient failures
- Show user-friendly error messages (avoid technical jargon)

**Loading States:**
- Show loading spinners during API calls
- Disable action buttons during operations to prevent duplicate submissions
- Display skeleton screens for initial page loads

### Server-Side Error Handling

**Validation Errors (400):**
```typescript
{
  success: false,
  error: 'Validation failed',
  details: {
    field: 'companyName',
    message: '公司名称为必填项'
  }
}
```

**Duplicate Entry (409):**
```typescript
{
  success: false,
  error: 'Company name already exists',
  code: 'DUPLICATE_ENTRY'
}
```

**Not Found (404):**
```typescript
{
  success: false,
  error: 'Conversion target not found',
  code: 'NOT_FOUND'
}
```

**Database Errors (500):**
```typescript
{
  success: false,
  error: 'Internal server error',
  code: 'DATABASE_ERROR'
}
```

**Error Logging:**
- Log all errors to console with stack traces
- Include request context (user action, timestamp, request ID)
- For production: integrate with error tracking service (e.g., Sentry)

## Testing Strategy

### Unit Testing

**Frontend Unit Tests:**
- Form validation logic
- Data transformation functions
- Component rendering with different props
- Event handler functions

**Backend Unit Tests:**
- Input validation functions
- Database query builders
- Error handling middleware
- Route handler logic

**Tools:**
- Jest (test runner)
- React Testing Library (component testing)
- Supertest (API endpoint testing)

### Property-Based Testing

**Property-Based Testing Library:**
- **fast-check** (for TypeScript/JavaScript)
- Minimum 100 iterations per property test

**Property Test Implementation Requirements:**
- Each property test MUST be tagged with a comment referencing the design document
- Tag format: `// Feature: conversion-target-management, Property {number}: {property_text}`
- Each correctness property MUST be implemented by a SINGLE property-based test
- Tests should use smart generators that constrain to valid input spaces

**Key Property Tests:**

1. **Form Validation Property Test:**
   - Generate random form data (valid and invalid)
   - Verify validation results match expected rules
   - Test edge cases (empty strings, max length, special characters)

2. **Data Persistence Round Trip:**
   - Generate random valid conversion targets
   - Create in database, query back, verify equivalence
   - Test all field types and values

3. **Pagination Property Test:**
   - Generate random list sizes (0 to 1000 records)
   - Verify page size consistency (10 per page)
   - Verify total count accuracy across pages

4. **Search Filter Property Test:**
   - Generate random search keywords and data sets
   - Verify all results contain the keyword
   - Verify no false positives or false negatives

5. **Sort Order Property Test:**
   - Generate random unsorted lists
   - Apply sort, verify order is correct
   - Test ascending and descending for all sortable columns

**Generator Strategies:**
- Company names: random strings 2-255 chars, including Chinese characters
- Contact info: generate valid phone numbers and emails
- URLs: generate valid http/https URLs
- Industry/Size: select from predefined enums
- Text fields: random strings within length limits

### Integration Testing

**End-to-End Workflows:**
- Complete CRUD cycle: create → read → update → delete
- Search and filter with pagination
- Sort with pagination
- Form validation and error handling
- Concurrent operations (multiple users)

**Database Integration:**
- Test with actual PostgreSQL database
- Verify constraints (unique company name)
- Test transaction rollback on errors
- Verify indexes are used for queries

### Test Coverage Goals

- Unit test coverage: >80%
- Property-based tests: All 18 correctness properties
- Integration tests: All critical user workflows
- API endpoint tests: 100% of endpoints

## Performance Considerations

### Frontend Optimization

**List Rendering:**
- Use Ant Design Table's built-in virtualization for large lists
- Implement debouncing for search input (300ms delay)
- Lazy load images if added in future

**State Management:**
- Use React hooks for local state
- Avoid unnecessary re-renders with React.memo
- Batch state updates where possible

### Backend Optimization

**Database Queries:**
- Use indexes on frequently queried columns (company_name, industry, created_at)
- Implement pagination at database level (LIMIT/OFFSET)
- Use prepared statements to prevent SQL injection

**API Response Times:**
- Target: <200ms for list queries
- Target: <100ms for single record queries
- Target: <300ms for create/update operations

**Caching Strategy:**
- Consider Redis caching for frequently accessed data (future enhancement)
- Implement ETag headers for conditional requests (future enhancement)

## Security Considerations

**Input Validation:**
- Validate all inputs on both client and server
- Sanitize HTML to prevent XSS attacks
- Use parameterized queries to prevent SQL injection

**Authentication & Authorization:**
- Currently no authentication (single-user system)
- Future: Add user authentication and role-based access control

**Data Protection:**
- Use HTTPS in production
- Sanitize error messages (don't expose internal details)
- Implement rate limiting to prevent abuse (future enhancement)

## Deployment Considerations

**Database Migration:**
- Create migration script for conversion_targets table
- Run migration before deploying new code
- Test migration on staging environment first

**Environment Variables:**
- No new environment variables required
- Uses existing database connection from .env

**Rollback Plan:**
- Keep migration rollback script
- Database backup before migration
- Feature flag to disable new module if issues arise

## Future Enhancements

**Phase 2 Features:**
- Export conversion targets to CSV/Excel
- Import bulk conversion targets from file
- Advanced filtering (multiple criteria, date ranges)
- Tags/categories for better organization
- Duplicate detection with fuzzy matching
- Activity log (who created/modified records)

**Phase 3 Features:**
- Integration with CRM systems
- Email notifications for new targets
- Analytics dashboard (industry distribution, growth trends)
- Custom fields configuration
- Multi-user support with permissions
