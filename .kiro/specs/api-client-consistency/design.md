# Design Document

## Overview

本设计文档描述了统一前端 API 客户端的实现方案。当前系统存在两种不同的 API 调用方式：
1. 使用未配置 baseURL 的 axios（如 ArticleListPage）
2. 使用带完整 URL 的 fetch API（如 ArticleSettingsPage 的 articleSettings.ts）

这种不一致导致页面切换时出现"列表加载失败"错误。解决方案是创建一个统一的 API 客户端模块，利用 Vite 的代理配置，使用相对路径 `/api` 进行所有 API 调用。

## Architecture

### Current State
```
ArticleListPage → axios (no baseURL) → /api/articles (相对路径)
ArticleSettingsPage → fetch → http://localhost:3000/api/article-settings (绝对路径)
ArticleGenerationApi → axios → /api/article-generation (相对路径) ✓
```

### Target State
```
All Pages → Unified API Client (axios) → /api/* (相对路径)
                ↓
         Vite Proxy (dev)
                ↓
    http://localhost:3000/api/*
```

### Design Principles
1. **Single Source of Truth**: 所有 API 配置集中在一个模块
2. **Type Safety**: 使用 TypeScript 提供完整的类型定义
3. **Consistency**: 所有 API 调用使用相同的客户端和错误处理
4. **Leverage Existing Infrastructure**: 利用已配置的 Vite 代理
5. **Minimal Changes**: 尽量减少对现有代码的修改

## Components and Interfaces

### 1. API Client Module (`client/src/api/client.ts`)

统一的 axios 实例配置：

```typescript
import axios, { AxiosInstance, AxiosError } from 'axios';

// 创建 axios 实例
export const apiClient: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 响应拦截器 - 统一错误处理
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // 统一错误处理逻辑
    const message = error.response?.data?.error || error.message || '请求失败';
    return Promise.reject(new Error(message));
  }
);
```

### 2. Updated Article Settings API (`client/src/api/articleSettings.ts`)

将 fetch 调用替换为 axios：

```typescript
import { apiClient } from './client';
import type {
  ArticleSetting,
  ArticleSettingFormData,
  ArticleSettingsListResponse,
  ArticleSettingResponse,
  DeleteResponse,
} from '../types/articleSettings';

export async function fetchArticleSettings(
  page: number = 1,
  pageSize: number = 10
): Promise<ArticleSettingsListResponse> {
  const response = await apiClient.get('/article-settings', {
    params: { page, pageSize }
  });
  return response.data;
}

export async function createArticleSetting(
  data: ArticleSettingFormData
): Promise<ArticleSettingResponse> {
  const response = await apiClient.post('/article-settings', data);
  return response.data;
}

// ... 其他函数类似
```

### 3. Updated Article List Page

将直接的 axios 导入替换为统一的 apiClient：

```typescript
import { apiClient } from '../api/client';

const loadArticles = async () => {
  setLoading(true);
  try {
    const response = await apiClient.get('/articles');
    setArticles(response.data);
  } catch (error: any) {
    message.error(error.message || '加载文章列表失败');
  } finally {
    setLoading(false);
  }
};
```

## Data Models

### API Response Types

所有 API 响应类型已在各自的 types 文件中定义：
- `client/src/types/articleSettings.ts`
- `client/src/types/articleGeneration.ts`

无需修改现有类型定义。

### Error Response

```typescript
interface APIError {
  error: string;
  details?: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified the following testable properties and performed redundancy elimination:

**Identified Properties:**
1. All API requests use relative paths (1.2)
2. Error handling is consistent across all requests (1.5)
3. Failed requests display error messages (2.4)
4. API behavior is consistent across navigation (2.5)

**Redundancy Analysis:**
- Properties 2 and 3 are related but not redundant: Property 2 tests error object consistency, while Property 3 tests error message extraction
- Property 4 is a higher-level property that encompasses Property 1, but we keep both because Property 1 is more specific and easier to test

**Final Properties:**

Property 1: Relative path consistency
*For any* API endpoint call through the unified client, the request URL should be a relative path starting with '/api'
**Validates: Requirements 1.2**

Property 2: Error handling consistency
*For any* API request that fails (network error, HTTP error, or timeout), the error should be transformed into a consistent Error object with a message property
**Validates: Requirements 1.5**

Property 3: Error message extraction
*For any* failed API request with a server response, the error message should be extracted from response.data.error or fallback to error.message
**Validates: Requirements 2.4**

Property 4: Navigation consistency
*For any* sequence of page navigations, making the same API call should produce the same request configuration (URL, headers, timeout) regardless of navigation history
**Validates: Requirements 2.5**

## Error Handling

### Client-Side Error Handling Strategy

1. **Network Errors**: axios 拦截器捕获并转换为统一的 Error 对象
2. **HTTP Errors**: 从 response.data.error 提取错误消息
3. **Timeout Errors**: 30秒超时，返回友好的错误消息
4. **Component Level**: 组件使用 try-catch 捕获错误并显示 message.error()

### Error Flow
```
API Request → axios interceptor → Error occurs
                                      ↓
                              Extract error message
                                      ↓
                              Reject with Error
                                      ↓
                          Component catch block
                                      ↓
                          Display message.error()
```

## Testing Strategy

### Unit Tests

测试统一 API 客户端的核心功能：

1. **API Client Configuration Test**
   - 验证 baseURL 设置为 '/api'
   - 验证 timeout 设置为 30000ms
   - 验证默认 headers 包含 'Content-Type': 'application/json'

2. **Error Interceptor Test**
   - 验证成功响应直接返回
   - 验证错误响应提取 error 字段
   - 验证网络错误返回 error.message

3. **Article Settings API Test**
   - 验证 fetchArticleSettings 使用正确的端点和参数
   - 验证 createArticleSetting 发送正确的 POST 请求
   - 验证 updateArticleSetting 发送正确的 PATCH 请求
   - 验证 deleteArticleSetting 发送正确的 DELETE 请求

### Integration Tests

测试页面组件与 API 的集成：

1. **ArticleListPage Integration Test**
   - 验证页面加载时调用 /api/articles
   - 验证错误时显示正确的错误消息
   - 验证成功时渲染文章列表

2. **ArticleSettingsPage Integration Test**
   - 验证页面加载时调用 /api/article-settings
   - 验证错误时显示正确的错误消息
   - 验证成功时渲染设置列表

3. **Page Navigation Test**
   - 验证从 ArticleListPage 切换到 ArticleSettingsPage 成功加载
   - 验证从 ArticleSettingsPage 切换到 ArticleListPage 成功加载
   - 验证多次切换不会出现错误

## Implementation Notes

### Migration Strategy

1. **Phase 1**: 创建统一的 API 客户端模块
2. **Phase 2**: 更新 articleSettings.ts 使用新客户端
3. **Phase 3**: 更新 ArticleListPage 使用新客户端
4. **Phase 4**: 验证所有页面切换正常工作
5. **Phase 5**: 清理未使用的导入

### Backward Compatibility

- 保持所有 API 函数签名不变
- 保持所有类型定义不变
- 只修改内部实现（从 fetch 到 axios）

### Development vs Production

- **Development**: Vite 代理将 `/api` 转发到 `http://localhost:3000/api`
- **Production**: 需要配置 nginx 或其他反向代理将 `/api` 转发到后端服务器

## Dependencies

- **axios**: 已安装（^1.6.2）
- **TypeScript**: 已安装（^5.3.3）
- **Vite**: 已配置代理

无需安装新的依赖。
