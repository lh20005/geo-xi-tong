# Design Document

## Overview

本设计文档旨在修复蒸馏结果模块中批量删除功能的ID验证问题。问题的根本原因是前端表格组件的 `selectedRowKeys` 可能返回字符串类型的键值，而服务端的验证逻辑使用 `Number.isInteger()` 进行严格的类型检查，导致字符串类型的数字ID被错误地判定为无效。

### Problem Analysis

1. **前端问题**: Ant Design Table 组件的 `rowKey` 属性设置为 `"id"`，但 `selectedRowKeys` 的类型是 `React.Key[]`，可能包含字符串或数字
2. **类型转换问题**: 虽然前端使用 `Number(key)` 进行转换，但如果数据源的 `id` 字段本身是字符串，转换可能不完整
3. **服务端验证问题**: 使用 `Number.isInteger(id)` 进行严格验证，不接受字符串类型的数字
4. **错误信息不明确**: 返回的错误信息"话题ID必须是正整数"没有指出具体哪些ID无效

## Architecture

### Component Interaction Flow

```
用户选择行 → Table组件生成selectedRowKeys → 
handleDeleteSelected处理 → 类型转换 → 
API调用 → 服务端验证 → 数据库删除
```

### Key Components

1. **DistillationResultsPage (前端)**: 管理表格状态和删除操作
2. **distillationResultsApi (前端API层)**: 封装删除API调用
3. **distillation.ts (后端路由)**: 处理删除请求和参数验证
4. **distillationService (后端服务层)**: 执行删除业务逻辑
5. **database.ts (数据访问层)**: 执行数据库删除操作

## Components and Interfaces

### Frontend Components

#### DistillationResultsPage

**State Management**:
- `selectedRowKeys: React.Key[]` - 选中的行键数组
- `data: TopicWithReference[]` - 表格数据源

**Key Methods**:
- `handleDeleteSelected()` - 处理删除操作，需要确保ID类型正确

#### API Client

```typescript
export async function deleteTopics(topicIds: number[]): Promise<DeleteResponse>
```

### Backend Components

#### Route Handler

```typescript
distillationRouter.delete('/topics', async (req, res) => {
  // 接收 { topicIds: number[] }
  // 验证并调用服务层
})
```

#### Service Layer

```typescript
async deleteTopics(topicIds: number[]): Promise<{
  success: boolean;
  deletedCount: number;
}>
```

## Data Models

### TopicWithReference (Frontend)

```typescript
interface TopicWithReference {
  id: number;              // 话题ID，应为数字类型
  distillationId: number;
  keyword: string;
  question: string;
  provider: 'deepseek' | 'gemini' | 'ollama';
  createdAt: string;
  referenceCount: number;
}
```

### Delete Request Payload

```typescript
{
  topicIds: number[]  // 必须是数字数组
}
```

### Delete Response

```typescript
{
  success: boolean;
  deletedCount: number;
}
```

## 
Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis, we have identified the following testable properties. Note that properties 1.1 and 2.1 are redundant (both test that row keys match data source IDs), and properties 1.2 and 2.2 are redundant (both test ID conversion). We will consolidate these into comprehensive properties.

**Property 1: ID Capture Consistency**
*For any* set of selected topics in the table, the captured ID values should exactly match the ID values in the data source for those topics.
**Validates: Requirements 1.1, 2.1**

**Property 2: ID Type Conversion**
*For any* set of selected row keys (whether strings or numbers), the conversion to number array should produce valid numeric IDs that match the original ID values.
**Validates: Requirements 1.2, 2.2**

**Property 3: ID Validation Correctness**
*For any* array of numeric IDs where all values are positive integers, the server validation should accept the request.
**Validates: Requirements 1.3, 2.3**

**Property 4: String ID Tolerance**
*For any* valid numeric ID represented as a string (e.g., "123"), the server should successfully convert and validate it as a valid ID.
**Validates: Requirements 2.4**

**Property 5: Invalid ID Rejection**
*For any* ID value that cannot be converted to a valid positive integer (e.g., "abc", null, -1, 0), the server should reject it with a clear error message.
**Validates: Requirements 2.5**

**Property 6: Deletion Completeness**
*For any* set of valid topic IDs, after successful deletion, querying the database for those IDs should return no results.
**Validates: Requirements 1.4**

**Property 7: Deletion Count Accuracy**
*For any* successful deletion operation with N valid IDs, the response should indicate exactly N records were deleted.
**Validates: Requirements 1.5**

**Property 8: Error Logging**
*For any* error that occurs during the deletion process, the system should log detailed error information to the console.
**Validates: Requirements 3.5**

## Error Handling

### Frontend Error Handling

1. **Empty Selection**: Display warning message before attempting deletion
2. **API Errors**: Catch and display user-friendly error messages from the server
3. **Network Errors**: Handle network failures gracefully with retry suggestions
4. **Type Conversion Errors**: Ensure all IDs are properly converted before sending

### Backend Error Handling

1. **Invalid Request Format**: Return 400 with clear message about expected format
2. **Invalid ID Types**: Return 400 with specific information about which IDs are invalid
3. **Database Errors**: Return 500 with user-friendly message, log technical details
4. **Partial Failures**: Currently not supported, but should be considered for future enhancement

### Error Response Format

```typescript
{
  error: string;           // User-friendly error message
  details?: string;        // Technical details (optional)
  invalidIds?: any[];      // List of invalid IDs (optional)
}
```

## Testing Strategy

### Unit Testing

We will write unit tests for:

1. **Frontend ID Conversion**: Test that `selectedRowKeys.map(key => Number(key))` correctly converts various input types
2. **Backend ID Validation**: Test the validation logic with various input types (numbers, strings, invalid values)
3. **Service Layer**: Test the `deleteTopics` method with valid and invalid inputs
4. **Database Layer**: Test the `deleteTopicsByIds` function with various ID arrays

### Property-Based Testing

We will use **fast-check** (for TypeScript/JavaScript) as our property-based testing library. Each property-based test should run a minimum of 100 iterations.

Property-based tests will be written for:

1. **Property 1 (ID Capture Consistency)**: Generate random topic data and selection states, verify captured IDs match
2. **Property 2 (ID Type Conversion)**: Generate random arrays of mixed string/number IDs, verify conversion correctness
3. **Property 3 (ID Validation Correctness)**: Generate random arrays of valid positive integers, verify all pass validation
4. **Property 4 (String ID Tolerance)**: Generate random valid numeric IDs as strings, verify server accepts them
5. **Property 5 (Invalid ID Rejection)**: Generate random invalid ID values, verify server rejects them with clear errors
6. **Property 6 (Deletion Completeness)**: Generate random valid ID sets, verify all are deleted from database
7. **Property 7 (Deletion Count Accuracy)**: Generate random valid ID sets, verify returned count matches input count
8. **Property 8 (Error Logging)**: Generate random error conditions, verify console logs contain error details

Each property-based test must be tagged with: **Feature: distillation-delete-fix, Property {number}: {property_text}**

### Integration Testing

Integration tests will verify:

1. End-to-end deletion flow from frontend to database
2. Error propagation from backend to frontend
3. UI state updates after successful deletion

## Implementation Approach

### Phase 1: Backend Robustness

1. Improve ID validation to handle string-to-number conversion
2. Enhance error messages to include specific invalid IDs
3. Add comprehensive logging

### Phase 2: Frontend Type Safety

1. Ensure proper type conversion in `handleDeleteSelected`
2. Add type guards to verify ID types before API calls
3. Improve error message display

### Phase 3: Testing

1. Write unit tests for validation logic
2. Write property-based tests for all identified properties
3. Write integration tests for end-to-end flow

## Solution Design

### Backend Changes

**Current Validation Logic**:
```typescript
const invalidIds = topicIds.filter(id => !Number.isInteger(id) || id <= 0);
```

**Improved Validation Logic**:
```typescript
// First, attempt to convert all IDs to numbers
const convertedIds = topicIds.map(id => {
  const num = typeof id === 'string' ? parseInt(id, 10) : Number(id);
  return { original: id, converted: num };
});

// Then validate the converted values
const invalidIds = convertedIds.filter(
  ({ converted }) => !Number.isInteger(converted) || converted <= 0
);

if (invalidIds.length > 0) {
  return res.status(400).json({ 
    error: '部分话题ID无效', 
    details: '话题ID必须是正整数',
    invalidIds: invalidIds.map(({ original }) => original)
  });
}

// Use the converted numeric IDs
const validIds = convertedIds.map(({ converted }) => converted);
```

### Frontend Changes

**Current Implementation**:
```typescript
const topicIds = selectedRowKeys.map(key => Number(key));
```

**Improved Implementation**:
```typescript
// Ensure all keys are properly converted and validated
const topicIds = selectedRowKeys
  .map(key => {
    const num = typeof key === 'string' ? parseInt(key, 10) : Number(key);
    return num;
  })
  .filter(id => Number.isInteger(id) && id > 0);

// Validate before sending
if (topicIds.length !== selectedRowKeys.length) {
  message.error('部分选中的记录ID无效，请刷新页面后重试');
  return;
}
```

### Data Flow Diagram

```
[User Selection] 
    ↓ (React.Key[])
[selectedRowKeys State]
    ↓ (map to number[])
[topicIds Array]
    ↓ (API call)
[Backend Validation]
    ↓ (convert & validate)
[Service Layer]
    ↓ (number[])
[Database Deletion]
    ↓ (SQL DELETE)
[Response]
    ↓ (success/error)
[UI Update]
```

## Performance Considerations

1. **Batch Deletion**: Current implementation supports batch deletion, which is efficient
2. **Transaction Safety**: Database deletion should be wrapped in a transaction (already implemented)
3. **Frontend Optimization**: Use `useCallback` for handlers (already implemented)

## Security Considerations

1. **SQL Injection**: Using parameterized queries (already implemented)
2. **Authorization**: Should verify user has permission to delete topics (future enhancement)
3. **Input Validation**: Strict validation of ID types and values

## Future Enhancements

1. **Partial Deletion Support**: Handle cases where some IDs are valid and others are not
2. **Soft Delete**: Implement soft delete with recovery option
3. **Audit Trail**: Log who deleted what and when
4. **Batch Size Limits**: Prevent deletion of too many records at once
