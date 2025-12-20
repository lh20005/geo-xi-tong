# Design Document

## Overview

本设计文档描述了账号名称显示改进的技术实现方案。主要涉及前端页面的列定义修改和后端API的数据查询优化。

## Architecture

### 系统层次
```
Frontend (React + TypeScript)
    ↓
API Layer (Express Routes)
    ↓
Service Layer (TypeScript Services)
    ↓
Database (PostgreSQL)
```

### 数据流
```
1. 前端请求任务/记录列表
2. 后端执行LEFT JOIN查询获取账号信息
3. 返回包含real_username的数据
4. 前端优先显示real_username，回退到account_name
```

## Components and Interfaces

### 1. Frontend Components

#### PlatformManagementPage.tsx
**修改内容：**
- 移除"备注名称"列的定义
- 保留"真实用户名"列

**列定义：**
```typescript
const accountColumns = [
  {
    title: '真实用户名',
    dataIndex: 'real_username',
    key: 'real_username',
    render: (text: string, record: Account) => (
      <span style={{ color: '#1890ff', fontWeight: 'bold' }}>
        {text || record.account_name || '未知'}
      </span>
    )
  },
  // 移除备注名称列
  {
    title: '操作',
    // ...
  }
];
```

#### PublishingTasksPage.tsx
**修改内容：**
- 将"账号"列改名为"账号名称"
- 显示real_username，回退到account_name

**列定义：**
```typescript
{
  title: '账号名称',
  dataIndex: 'real_username',
  key: 'real_username',
  width: 150,
  render: (text: string, record: PublishingTask) => 
    text || record.account_name || '-'
}
```

#### PublishingRecordsPage.tsx
**修改内容：**
- 将"账号"列改名为"账号名称"
- 显示real_username，回退到account_name

**列定义：**
```typescript
{
  title: '账号名称',
  dataIndex: 'real_username',
  key: 'real_username',
  width: 150,
  render: (text: string, record: PublishingRecord) => 
    text || record.account_name || '-'
}
```

### 2. Backend API

#### GET /api/publishing/tasks
**响应数据结构：**
```typescript
interface PublishingTask {
  id: number;
  account_id: number;
  account_name: string;      // 备注名称（后备）
  real_username: string;     // 真实用户名（新增）
  platform_id: string;
  platform_name: string;
  // ... 其他字段
}
```

**SQL查询：**
```sql
SELECT 
  pt.*,
  pa.account_name,
  pa.credentials->>'userInfo'->>'username' as real_username,
  p.platform_name
FROM publishing_tasks pt
LEFT JOIN platform_accounts pa ON pt.account_id = pa.id
LEFT JOIN platforms p ON pt.platform_id = p.platform_id
ORDER BY pt.created_at DESC
```

#### GET /api/publishing/records
**响应数据结构：**
```typescript
interface PublishingRecord {
  id: number;
  account_id: number;
  account_name: string;      // 备注名称（后备）
  real_username: string;     // 真实用户名（新增）
  platform_id: string;
  platform_name: string;
  // ... 其他字段
}
```

**SQL查询：**
```sql
SELECT 
  pr.*,
  pa.account_name,
  pa.credentials->>'userInfo'->>'username' as real_username,
  p.platform_name
FROM publishing_records pr
LEFT JOIN platform_accounts pa ON pr.account_id = pa.id
LEFT JOIN platforms p ON pr.platform_id = p.platform_id
ORDER BY pr.published_at DESC
```

### 3. TypeScript Types

#### client/src/api/publishing.ts
```typescript
export interface PublishingTask {
  id: number;
  account_id: number;
  account_name: string;
  real_username?: string;  // 新增
  platform_id: string;
  platform_name: string;
  // ... 其他字段
}

export interface PublishingRecord {
  id: number;
  account_id: number;
  account_name: string;
  real_username?: string;  // 新增
  platform_id: string;
  platform_name: string;
  // ... 其他字段
}
```

## Data Models

### platform_accounts 表
```sql
CREATE TABLE platform_accounts (
  id SERIAL PRIMARY KEY,
  platform_id VARCHAR(50) NOT NULL,
  account_name VARCHAR(255) NOT NULL,  -- 备注名称
  credentials JSONB NOT NULL,          -- 包含 userInfo.username（真实用户名）
  -- ... 其他字段
);
```

### credentials JSONB 结构
```json
{
  "username": "browser_login",
  "password": "cookie_auth",
  "cookies": [...],
  "userInfo": {
    "username": "细品茶香韵"  // 真实用户名
  }
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 真实用户名优先显示
*For any* 任务或记录，如果存在real_username，则应该显示real_username；如果不存在，则显示account_name作为后备
**Validates: Requirements 2.2, 2.3, 3.2, 3.3**

### Property 2: 列名称一致性
*For all* 发布任务和发布记录页面，账号相关的列名称应该统一为"账号名称"
**Validates: Requirements 2.1, 3.1**

### Property 3: 数据完整性
*For any* API响应，如果account_id存在且账号未被删除，则应该返回对应的账号信息（account_name和real_username）
**Validates: Requirements 4.1, 4.2, 4.4**

### Property 4: 查询性能
*For any* 列表查询，应该使用单次JOIN查询获取所有账号信息，避免N+1查询问题
**Validates: Requirements 5.1, 5.2, 5.3**

## Error Handling

### 前端错误处理
1. **账号信息缺失**：显示"-"或"未知"
2. **API请求失败**：显示错误提示，保持现有数据
3. **数据格式错误**：使用默认值，记录错误日志

### 后端错误处理
1. **数据库查询失败**：返回500错误，记录详细日志
2. **账号不存在**：返回null值，前端处理显示
3. **JSON解析失败**：返回空字符串，不影响其他数据

## Testing Strategy

### Unit Tests
- 测试列定义的render函数正确处理各种输入
- 测试API响应数据结构符合预期
- 测试SQL查询返回正确的字段

### Integration Tests
- 测试完整的数据流：数据库 → API → 前端显示
- 测试账号删除后的显示行为
- 测试大量数据的查询性能

### Manual Tests
- 在三个页面验证列名称和显示内容
- 验证真实用户名和备注名称的回退逻辑
- 验证不同账号状态的显示效果

## Implementation Plan

### Phase 1: 后端API修改
1. 修改 `server/src/routes/publishing.ts` 中的任务和记录查询
2. 更新SQL查询，添加real_username字段
3. 测试API响应数据

### Phase 2: 前端类型定义
1. 更新 `client/src/api/publishing.ts` 中的类型定义
2. 添加real_username字段

### Phase 3: 前端页面修改
1. 修改 `PlatformManagementPage.tsx`：移除备注名称列
2. 修改 `PublishingTasksPage.tsx`：更新列名和显示逻辑
3. 修改 `PublishingRecordsPage.tsx`：更新列名和显示逻辑

### Phase 4: 测试验证
1. 测试三个页面的显示效果
2. 验证数据回退逻辑
3. 检查性能和错误处理
