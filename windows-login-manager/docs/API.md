# API文档

## IPC通信协议

本应用使用Electron的IPC（Inter-Process Communication）机制进行主进程和渲染进程之间的通信。

### 通信架构

```
Renderer Process (React)
    ↓ (invoke)
Preload Script (contextBridge)
    ↓ (ipcRenderer.invoke)
Main Process (IPC Handler)
    ↓
Business Logic (Services)
```

## IPC API

所有IPC调用都通过 `window.electronAPI` 对象访问。

### 平台登录

#### loginToPlatform

启动平台登录流程。

**调用**:
```typescript
window.electronAPI.loginToPlatform(platformId: string): Promise<Account>
```

**参数**:
- `platformId` (string): 平台ID

**返回**:
```typescript
interface Account {
  id: string;
  platformId: string;
  username: string;
  displayName?: string;
  avatar?: string;
  cookies: Cookie[];
  localStorage?: Record<string, string>;
  sessionStorage?: Record<string, string>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
```

**错误**:
- `LOGIN_TIMEOUT`: 登录超时
- `LOGIN_FAILED`: 登录失败
- `NETWORK_ERROR`: 网络错误

**示例**:
```typescript
try {
  const account = await window.electronAPI.loginToPlatform('douyin');
  console.log('登录成功:', account);
} catch (error) {
  console.error('登录失败:', error);
}
```

---

#### cancelLogin

取消正在进行的登录流程。

**调用**:
```typescript
window.electronAPI.cancelLogin(): Promise<void>
```

**示例**:
```typescript
await window.electronAPI.cancelLogin();
```

---

### 账号管理

#### getAccounts

获取所有账号列表。

**调用**:
```typescript
window.electronAPI.getAccounts(): Promise<Account[]>
```

**返回**: Account数组

**示例**:
```typescript
const accounts = await window.electronAPI.getAccounts();
```

---

#### getAccount

获取单个账号详情。

**调用**:
```typescript
window.electronAPI.getAccount(accountId: string): Promise<Account>
```

**参数**:
- `accountId` (string): 账号ID

**返回**: Account对象

---

#### deleteAccount

删除账号。

**调用**:
```typescript
window.electronAPI.deleteAccount(accountId: string): Promise<void>
```

**参数**:
- `accountId` (string): 账号ID

**示例**:
```typescript
await window.electronAPI.deleteAccount('account-123');
```

---

#### setDefaultAccount

设置默认账号。

**调用**:
```typescript
window.electronAPI.setDefaultAccount(
  platformId: string,
  accountId: string
): Promise<void>
```

**参数**:
- `platformId` (string): 平台ID
- `accountId` (string): 账号ID

---

#### refreshAccount

刷新账号（重新登录）。

**调用**:
```typescript
window.electronAPI.refreshAccount(accountId: string): Promise<Account>
```

**参数**:
- `accountId` (string): 账号ID

**返回**: 更新后的Account对象

---

### 配置管理

#### getConfig

获取应用配置。

**调用**:
```typescript
window.electronAPI.getConfig(): Promise<AppConfig>
```

**返回**:
```typescript
interface AppConfig {
  serverUrl: string;
  autoSync: boolean;
  syncInterval: number;
  theme: 'light' | 'dark' | 'auto';
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}
```

---

#### setConfig

设置应用配置。

**调用**:
```typescript
window.electronAPI.setConfig(config: Partial<AppConfig>): Promise<void>
```

**参数**:
- `config` (Partial<AppConfig>): 配置对象（部分）

**示例**:
```typescript
await window.electronAPI.setConfig({
  serverUrl: 'https://api.example.com',
  autoSync: true,
});
```

---

### 同步管理

#### syncNow

立即执行同步。

**调用**:
```typescript
window.electronAPI.syncNow(): Promise<void>
```

---

#### getSyncStatus

获取同步状态。

**调用**:
```typescript
window.electronAPI.getSyncStatus(): Promise<SyncStatus>
```

**返回**:
```typescript
interface SyncStatus {
  isSyncing: boolean;
  lastSyncTime?: string;
  pendingItems: number;
  failedItems: number;
}
```

---

#### clearSyncQueue

清除同步队列。

**调用**:
```typescript
window.electronAPI.clearSyncQueue(): Promise<void>
```

---

### 日志管理

#### getLogs

获取日志列表。

**调用**:
```typescript
window.electronAPI.getLogs(): Promise<string[]>
```

**返回**: 日志文件名数组

---

#### readLog

读取日志文件内容。

**调用**:
```typescript
window.electronAPI.readLog(filename: string): Promise<string>
```

**参数**:
- `filename` (string): 日志文件名

**返回**: 日志内容（字符串）

---

#### clearLogs

清除所有日志。

**调用**:
```typescript
window.electronAPI.clearLogs(): Promise<void>
```

---

#### exportLogs

导出日志到指定位置。

**调用**:
```typescript
window.electronAPI.exportLogs(destination: string): Promise<boolean>
```

**参数**:
- `destination` (string): 导出目标路径

**返回**: 是否成功

---

#### openLogFolder

打开日志文件夹。

**调用**:
```typescript
window.electronAPI.openLogFolder(): Promise<void>
```

---

### 数据管理

#### clearCache

清除本地缓存。

**调用**:
```typescript
window.electronAPI.clearCache(): Promise<void>
```

---

## 后端API

应用与后端服务器通信使用RESTful API。

### 基础信息

- **Base URL**: 配置在应用设置中
- **认证方式**: Bearer Token (JWT)
- **Content-Type**: application/json

### 认证

#### 登录

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "string",
  "password": "string"
}
```

**响应**:
```json
{
  "token": "string",
  "refreshToken": "string",
  "expiresIn": 3600
}
```

---

#### 刷新Token

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "string"
}
```

**响应**:
```json
{
  "token": "string",
  "expiresIn": 3600
}
```

---

### 账号管理

#### 创建账号

```http
POST /api/accounts
Authorization: Bearer {token}
Content-Type: application/json

{
  "platformId": "string",
  "username": "string",
  "displayName": "string",
  "avatar": "string",
  "cookies": [...],
  "localStorage": {...},
  "sessionStorage": {...}
}
```

**响应**:
```json
{
  "id": "string",
  "platformId": "string",
  "username": "string",
  ...
}
```

---

#### 获取账号列表

```http
GET /api/accounts
Authorization: Bearer {token}
```

**响应**:
```json
[
  {
    "id": "string",
    "platformId": "string",
    "username": "string",
    ...
  }
]
```

---

#### 获取单个账号

```http
GET /api/accounts/:id
Authorization: Bearer {token}
```

---

#### 更新账号

```http
PUT /api/accounts/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "displayName": "string",
  "avatar": "string",
  ...
}
```

---

#### 删除账号

```http
DELETE /api/accounts/:id
Authorization: Bearer {token}
```

---

#### 设置默认账号

```http
POST /api/accounts/:id/set-default
Authorization: Bearer {token}
```

---

## WebSocket通知

应用支持通过WebSocket接收实时通知。

### 连接

```javascript
const ws = new WebSocket('ws://server-url/ws');
ws.onopen = () => {
  // 发送认证
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your-token'
  }));
};
```

### 消息格式

```json
{
  "type": "account.created" | "account.updated" | "account.deleted",
  "data": {
    "accountId": "string",
    "platformId": "string",
    ...
  },
  "timestamp": "ISO8601"
}
```

### 事件类型

- `account.created`: 账号创建
- `account.updated`: 账号更新
- `account.deleted`: 账号删除
- `sync.completed`: 同步完成
- `sync.failed`: 同步失败

---

## 错误处理

### 错误格式

所有API错误遵循统一格式：

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {...}
  }
}
```

### 错误代码

- `NETWORK_ERROR`: 网络错误
- `AUTH_FAILED`: 认证失败
- `TOKEN_EXPIRED`: Token过期
- `INVALID_INPUT`: 无效输入
- `NOT_FOUND`: 资源不存在
- `PERMISSION_DENIED`: 权限不足
- `SERVER_ERROR`: 服务器错误
- `LOGIN_TIMEOUT`: 登录超时
- `LOGIN_FAILED`: 登录失败
- `STORAGE_ERROR`: 存储错误
- `SYNC_ERROR`: 同步错误

---

## 类型定义

### Cookie

```typescript
interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  expirationDate?: number;
}
```

### Platform

```typescript
interface Platform {
  id: string;
  name: string;
  icon: string;
  loginUrl: string;
  selectors: {
    username?: string;
    displayName?: string;
    avatar?: string;
  };
}
```

---

## 安全注意事项

1. **Token管理**: Token存储在加密存储中，不要在日志中输出
2. **HTTPS**: 生产环境必须使用HTTPS
3. **输入验证**: 所有输入都经过验证和清理
4. **错误信息**: 不要在错误信息中暴露敏感信息
5. **日志记录**: 不要记录密码、Token等敏感信息

---

## 版本控制

API版本通过URL路径控制：

- v1: `/api/v1/...`
- v2: `/api/v2/...`

当前版本: v1
