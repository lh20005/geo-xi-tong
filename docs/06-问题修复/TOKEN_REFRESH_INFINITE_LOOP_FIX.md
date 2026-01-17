# Token 刷新无限循环问题修复

**日期**: 2026-01-17  
**问题**: Windows 桌面客户端出现大量 401 错误，token 刷新陷入无限循环  
**状态**: ✅ 已修复

---

## 问题描述

用户在使用 Windows 桌面客户端时，遇到以下问题：

1. **大量 401 错误**: 所有 API 请求都返回 401 Unauthorized
2. **Token 刷新循环**: 每个 401 错误都触发 token 刷新，但刷新本身也返回 401
3. **WebSocket 断开**: 认证失败导致 WebSocket 连接断开
4. **用户体验差**: 页面无法加载数据，需要重新登录

### 错误日志示例

```
[API Client] ❌ 响应错误: {url: '/agent/status', status: 401}
[API Client] 🔄 检测到 401，尝试刷新 token...
[API Client] 🔄 使用 refresh token 刷新...
[API Client] ❌ 响应错误: {url: '/subscription/current', status: 401}
[API Client] 🔄 检测到 401，尝试刷新 token...
[API Client] 🔄 使用 refresh token 刷新...
... (重复数十次)
```

---

## 根本原因

### 1. Token 刷新逻辑缺陷

**问题代码** (`windows-login-manager/src/api/client.ts`):

```typescript
// 处理401错误（token过期）
if (error.response?.status === 401 && !originalRequest._retry) {
  console.log('[API Client] 🔄 检测到 401，尝试刷新 token...');
  originalRequest._retry = true;
  
  // 尝试刷新 token
  const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, { 
    refreshToken 
  });
  // ...
}
```

**缺陷**:
- ❌ 没有检查是否是刷新接口本身返回 401
- ❌ 没有防止多个请求同时触发刷新
- ❌ 刷新失败后没有立即停止重试

### 2. 并发请求问题

当页面加载时，多个组件同时发起 API 请求：
- Dashboard 数据请求
- 订阅信息请求
- Agent 状态请求
- WebSocket 连接

如果 token 已过期，这些请求都会返回 401，导致：
- 多个刷新请求同时发送
- 刷新接口被频繁调用
- 可能触发服务器限流

---

## 修复方案

### 1. 添加刷新接口检测

```typescript
// 如果是刷新接口本身返回 401，直接登出
if (originalRequest.url?.includes('/auth/refresh')) {
  console.error('[API Client] ❌ Refresh token 已失效，需要重新登录');
  
  // 清除所有认证信息
  if (window.electron) {
    await window.electron.storage.clearTokens();
  }
  localStorage.clear();
  
  // 触发登出事件
  window.dispatchEvent(new CustomEvent('auth:logout', { 
    detail: { message: '登录已过期，请重新登录' } 
  }));
  
  return Promise.reject(new Error('登录已过期，请重新登录'));
}
```

### 2. 实现请求队列机制

```typescript
// 用于防止多个请求同时刷新 token
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// 如果正在刷新，将请求加入队列
if (isRefreshing) {
  console.log('[API Client] 🔄 Token 刷新中，请求加入队列...');
  return new Promise((resolve, reject) => {
    failedQueue.push({ resolve, reject });
  })
    .then((token) => {
      originalRequest.headers.Authorization = `Bearer ${token}`;
      return apiClient.request(originalRequest);
    })
    .catch((err) => {
      return Promise.reject(err);
    });
}
```

### 3. 改进刷新流程

```typescript
originalRequest._retry = true;
isRefreshing = true;

try {
  // 刷新 token
  const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, { 
    refreshToken 
  });
  
  if (response.data.success) {
    const newToken = response.data.data.token;
    
    // 保存新 token
    if (window.electron) {
      await window.electron.storage.saveTokens({
        authToken: newToken,
        refreshToken: refreshToken
      });
    }
    localStorage.setItem('auth_token', newToken);
    
    // 处理队列中的请求
    processQueue(null, newToken);
    
    // 重试原始请求
    originalRequest.headers.Authorization = `Bearer ${newToken}`;
    return apiClient.request(originalRequest);
  }
} catch (refreshError) {
  // 处理队列中的请求
  processQueue(refreshError, null);
  
  // 清除认证信息并登出
  // ...
} finally {
  isRefreshing = false;
}
```

---

## 修复效果

### 修复前

```
❌ 多个请求同时触发刷新
❌ 刷新接口返回 401 后继续重试
❌ 用户看到大量错误日志
❌ 页面无法加载数据
```

### 修复后

```
✅ 只有第一个请求触发刷新
✅ 其他请求等待刷新完成
✅ 刷新失败立即登出
✅ 用户体验流畅
```

---

## 测试验证

### 测试场景 1: Token 过期

1. 等待 token 过期（1小时）
2. 刷新页面或发起 API 请求
3. **预期**: 自动刷新 token，请求成功

### 测试场景 2: Refresh Token 过期

1. 清除 refresh token 或等待其过期（7天）
2. 发起 API 请求
3. **预期**: 显示"登录已过期"提示，跳转到登录页

### 测试场景 3: 并发请求

1. 在 token 过期时打开 Dashboard
2. 多个组件同时发起请求
3. **预期**: 只发送一次刷新请求，所有请求成功

---

## 相关文件

### 已修改的文件

1. **`windows-login-manager/src/api/client.ts`** - API 客户端（已修复）
   - 添加请求队列机制
   - 添加刷新接口检测
   - 改进错误处理逻辑

2. **`windows-login-manager/src/App.tsx`** - 应用主组件（已修复）
   - 添加 `auth:logout` 事件监听
   - 自动触发登出流程

### 相关配置文件

- `windows-login-manager/src/config/env.ts` - 环境配置
- `windows-login-manager/src/services/UserWebSocketService.ts` - WebSocket 服务
- `windows-login-manager/.env` - 环境变量

### 新增文档

- `docs/06-问题修复/TOKEN_REFRESH_INFINITE_LOOP_FIX.md` - 修复说明
- `docs/05-测试指南/TOKEN_REFRESH_TEST_GUIDE.md` - 测试指南

---

## 后续优化建议

### 1. Token 自动续期

在 token 即将过期前（如剩余 5 分钟）主动刷新：

```typescript
// 在请求拦截器中检查 token 过期时间
const tokenExpiry = getTokenExpiry(token);
const now = Date.now();
const fiveMinutes = 5 * 60 * 1000;

if (tokenExpiry - now < fiveMinutes) {
  // 主动刷新 token
  await refreshToken();
}
```

### 2. 刷新失败重试

对于网络错误导致的刷新失败，可以重试 1-2 次：

```typescript
let retryCount = 0;
const maxRetries = 2;

while (retryCount < maxRetries) {
  try {
    const response = await axios.post('/api/auth/refresh', { refreshToken });
    break;
  } catch (error) {
    if (error.response?.status === 401) {
      // 认证失败，不重试
      throw error;
    }
    retryCount++;
    if (retryCount >= maxRetries) {
      throw error;
    }
    await sleep(1000 * retryCount);
  }
}
```

### 3. 用户友好提示

在刷新失败时，显示更友好的提示：

```typescript
window.dispatchEvent(new CustomEvent('auth:logout', { 
  detail: { 
    message: '您的登录已过期，请重新登录',
    reason: 'token_expired',
    showNotification: true
  } 
}));
```

---

## 总结

这次修复解决了 token 刷新的核心问题：

1. ✅ 防止刷新接口自身的 401 触发无限循环
2. ✅ 实现请求队列，避免并发刷新
3. ✅ 改进错误处理，快速失败并登出
4. ✅ 提升用户体验，减少错误日志

修复后，用户在 token 过期时可以无感知地自动刷新，只有在 refresh token 也过期时才需要重新登录。
