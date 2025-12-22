# Design Document: Windows Platform Login Manager

## Overview

Windows平台登录管理器是一个基于Electron + React + TypeScript构建的桌面应用程序，用于在Windows系统上完成各平台账号的登录，并将登录信息同步到项目后端数据库。该应用采用混合架构（Hybrid Architecture），使用REST API进行数据操作，使用WebSocket进行实时通知，确保Web前端能够立即看到账号更新。

### 核心技术栈

- **Electron**: 跨平台桌面应用框架，提供原生能力
- **React**: UI框架，复用现有Web项目的组件
- **TypeScript**: 类型安全的开发语言
- **Vite**: 快速的构建工具
- **electron-builder**: 应用打包和分发工具
- **Puppeteer-core**: 浏览器自动化（复用现有登录逻辑）

### 设计原则

1. **代码复用**: 最大化复用现有Web项目的React组件和业务逻辑
2. **安全第一**: 所有敏感数据加密存储和传输
3. **用户体验**: 提供流畅的Windows原生应用体验
4. **可维护性**: 清晰的架构分层，易于扩展和维护
5. **云端友好**: 设计支持未来云端部署和多端同步

## Architecture

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                  Windows Login Manager (Electron)            │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Main Process │  │   Renderer   │  │  BrowserView │      │
│  │   (Node.js)  │  │   (React)    │  │  (Chromium)  │      │
│  │              │  │              │  │              │      │
│  │ - IPC Handler│  │ - UI Layer   │  │ - Login Page │      │
│  │ - API Client │  │ - State Mgmt │  │ - Cookie Cap │      │
│  │ - Storage    │  │ - Components │  │              │      │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘      │
│         │                  │                                 │
│         └──────────────────┘                                 │
│                    │                                          │
└────────────────────┼──────────────────────────────────────────┘
                     │
                     │ HTTPS (REST API)
                     │ + WebSocket
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                    Backend Server (Node.js)                  │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  REST API    │  │  WebSocket   │  │  Database    │      │
│  │              │  │   Service    │  │ (PostgreSQL) │      │
│  │ - Auth       │  │              │  │              │      │
│  │ - Accounts   │  │ - Broadcast  │  │ - Accounts   │      │
│  │ - Platforms  │  │ - Heartbeat  │  │ - Tokens     │      │
│  └──────────────┘  └──────┬───────┘  └──────────────┘      │
│                            │                                  │
└────────────────────────────┼──────────────────────────────────┘
                             │
                             │ WebSocket
                             ↓
┌─────────────────────────────────────────────────────────────┐
│                    Web Frontend (React)                      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  UI Layer    │  │  WebSocket   │  │  API Client  │      │
│  │              │  │   Client     │  │              │      │
│  │ - Dashboard  │  │              │  │ - REST Calls │      │
│  │ - Accounts   │  │ - Subscribe  │  │ - Auth       │      │
│  │ - Publishing │  │ - Auto Sync  │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 进程架构

Electron应用包含两个主要进程：

1. **Main Process (主进程)**
   - 运行在Node.js环境
   - 管理应用生命周期
   - 创建和管理窗口
   - 处理系统级操作
   - 与后端API通信
   - 管理本地存储

2. **Renderer Process (渲染进程)**
   - 运行在Chromium环境
   - 渲染React UI
   - 处理用户交互
   - 通过IPC与主进程通信

3. **BrowserView (浏览器视图)**
   - 独立的Chromium实例
   - 显示平台登录页面
   - 捕获Cookie和会话数据

## Components and Interfaces

### 1. Main Process Components

#### 1.1 Application Manager
```typescript
// electron/main.ts
interface ApplicationManager {
  // 应用生命周期管理
  initialize(): Promise<void>;
  createMainWindow(): BrowserWindow;
  handleAppReady(): void;
  handleAppQuit(): void;
  
  // 窗口管理
  getMainWindow(): BrowserWindow | null;
  focusMainWindow(): void;
}
```

#### 1.2 IPC Handler
```typescript
// electron/ipc/handler.ts
interface IPCHandler {
  // 平台登录
  handlePlatformLogin(platformId: string): Promise<LoginResult>;
  
  // 账号管理
  handleGetAccounts(): Promise<Account[]>;
  handleDeleteAccount(accountId: number): Promise<void>;
  handleSetDefaultAccount(platformId: string, accountId: number): Promise<void>;
  
  // 配置管理
  handleGetConfig(): Promise<AppConfig>;
  handleSetConfig(config: AppConfig): Promise<void>;
  
  // 日志管理
  handleGetLogs(): Promise<string[]>;
  handleExportLogs(): Promise<string>;
}
```

#### 1.3 API Client
```typescript
// electron/api/client.ts
interface APIClient {
  // 认证
  login(username: string, password: string): Promise<AuthResponse>;
  refreshToken(): Promise<AuthResponse>;
  
  // 账号操作
  createAccount(account: CreateAccountInput): Promise<Account>;
  updateAccount(accountId: number, account: UpdateAccountInput): Promise<Account>;
  deleteAccount(accountId: number): Promise<void>;
  getAccounts(): Promise<Account[]>;
  
  // 平台配置
  getPlatforms(): Promise<Platform[]>;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
```

#### 1.4 Storage Manager
```typescript
// electron/storage/manager.ts
interface StorageManager {
  // Token管理
  saveTokens(accessToken: string, refreshToken: string): Promise<void>;
  getTokens(): Promise<{ accessToken: string; refreshToken: string } | null>;
  clearTokens(): Promise<void>;
  
  // 配置管理
  saveConfig(config: AppConfig): Promise<void>;
  getConfig(): Promise<AppConfig | null>;
  
  // 账号缓存（加密）
  saveAccountsCache(accounts: Account[]): Promise<void>;
  getAccountsCache(): Promise<Account[]>;
  clearCache(): Promise<void>;
}
```

#### 1.5 Login Manager
```typescript
// electron/login/manager.ts
interface LoginManager {
  // 浏览器登录
  loginWithBrowser(platform: Platform): Promise<LoginResult>;
  
  // Cookie捕获
  captureCookies(view: BrowserView): Promise<Cookie[]>;
  
  // 用户信息提取
  extractUserInfo(view: BrowserView, platformId: string): Promise<UserInfo>;
  
  // 登录状态检测
  waitForLoginSuccess(view: BrowserView, platformId: string): Promise<void>;
}

interface LoginResult {
  success: boolean;
  account?: Account;
  message?: string;
}

interface UserInfo {
  username: string;
  avatar?: string;
  [key: string]: any;
}
```

### 2. Renderer Process Components

#### 2.1 App Component
```typescript
// src/App.tsx
interface AppProps {}

const App: React.FC<AppProps> = () => {
  // 应用根组件
  // - 路由配置
  // - 全局状态管理
  // - 主题配置
};
```

#### 2.2 Platform Selection View
```typescript
// src/components/PlatformSelection.tsx
interface PlatformSelectionProps {
  platforms: Platform[];
  onPlatformSelect: (platform: Platform) => void;
}

const PlatformSelection: React.FC<PlatformSelectionProps> = ({
  platforms,
  onPlatformSelect
}) => {
  // 平台选择界面
  // - 平台图标网格
  // - 搜索过滤
  // - 平台状态显示
};
```

#### 2.3 Account List View
```typescript
// src/components/AccountList.tsx
interface AccountListProps {
  accounts: Account[];
  onDelete: (accountId: number) => void;
  onSetDefault: (platformId: string, accountId: number) => void;
  onRefresh: () => void;
}

const AccountList: React.FC<AccountListProps> = ({
  accounts,
  onDelete,
  onSetDefault,
  onRefresh
}) => {
  // 账号列表界面
  // - 账号卡片展示
  // - 操作按钮（删除、设为默认）
  // - 同步状态指示
};
```

#### 2.4 Settings View
```typescript
// src/components/Settings.tsx
interface SettingsProps {
  config: AppConfig;
  onSave: (config: AppConfig) => void;
}

const Settings: React.FC<SettingsProps> = ({ config, onSave }) => {
  // 设置界面
  // - 后端服务器地址
  // - 自动同步开关
  // - 日志级别
  // - 清除缓存
};
```

#### 2.5 IPC Bridge
```typescript
// src/services/ipc.ts
interface IPCBridge {
  // 平台登录
  loginPlatform(platformId: string): Promise<LoginResult>;
  
  // 账号管理
  getAccounts(): Promise<Account[]>;
  deleteAccount(accountId: number): Promise<void>;
  setDefaultAccount(platformId: string, accountId: number): Promise<void>;
  
  // 配置管理
  getConfig(): Promise<AppConfig>;
  setConfig(config: AppConfig): Promise<void>;
  
  // 日志管理
  getLogs(): Promise<string[]>;
  exportLogs(): Promise<string>;
}
```

### 3. Backend API Extensions

#### 3.1 Account API Endpoints
```typescript
// server/src/routes/account.ts
// 新增路由

// POST /api/accounts - 创建账号
// GET /api/accounts - 获取所有账号
// GET /api/accounts/:id - 获取单个账号
// PUT /api/accounts/:id - 更新账号
// DELETE /api/accounts/:id - 删除账号
// POST /api/accounts/:id/set-default - 设置默认账号
```

#### 3.2 Auth API Endpoints
```typescript
// server/src/routes/auth.ts
// 新增路由

// POST /api/auth/login - 登录获取Token
// POST /api/auth/refresh - 刷新Token
// POST /api/auth/logout - 登出
```

#### 3.3 WebSocket Service
```typescript
// server/src/services/WebSocketService.ts
interface WebSocketService {
  // 连接管理
  handleConnection(client: WebSocket): void;
  handleDisconnection(client: WebSocket): void;
  
  // 消息广播
  broadcastAccountUpdate(account: Account, action: 'create' | 'update' | 'delete'): void;
  
  // 心跳机制
  startHeartbeat(): void;
  stopHeartbeat(): void;
}

interface WebSocketMessage {
  type: 'account_update' | 'heartbeat' | 'error';
  payload: any;
  timestamp: number;
}
```

## Data Models

### Account Model
```typescript
interface Account {
  id: number;
  platform_id: string;
  account_name: string;
  real_username?: string;
  credentials?: {
    username: string;
    password: string;
    cookies?: Cookie[];
    loginTime?: string;
    userInfo?: UserInfo;
  };
  is_default: boolean;
  status: 'active' | 'inactive' | 'expired';
  created_at: Date;
  updated_at: Date;
  last_used_at?: Date;
}
```

### Platform Model
```typescript
interface Platform {
  platform_id: string;
  platform_name: string;
  icon_url?: string;
  login_url: string;
  selectors: {
    username: string[];
    loginSuccess: string[];
  };
  enabled: boolean;
}
```

### AppConfig Model
```typescript
interface AppConfig {
  serverUrl: string;
  autoSync: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  theme: 'light' | 'dark' | 'system';
}
```

### Cookie Model
```typescript
interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Account Sync Round-Trip Integrity
*For any* valid account data, saving it locally and syncing to the backend should result in the account being retrievable from both local storage and the backend API with identical data (excluding timestamps).

**Validates: Requirements 4.1, 4.7, 7.1, 7.4**

### Property 2: Encryption Round-Trip Integrity
*For any* account credentials, encrypting then decrypting should produce data equivalent to the original credentials, and stored passwords should never be in plain text.

**Validates: Requirements 7.2, 11.1, 11.4**

### Property 3: Token Refresh Maintains Authentication
*For any* expired access token with a valid refresh token, the automatic token refresh process should result in a new valid access token that can successfully authenticate API requests.

**Validates: Requirements 4.8**

### Property 4: WebSocket Notification Broadcast
*For any* account operation (create, update, delete) performed by the Login Manager, all connected web clients should receive a WebSocket notification containing the operation details.

**Validates: Requirements 5.1, 5.6**

### Property 5: Cookie Capture Completeness
*For any* successful platform login through BrowserView, all cookies set by the platform during the login process should be captured and stored in the account credentials.

**Validates: Requirements 13.3, 2.3**

### Property 6: User Info Extraction Consistency
*For any* platform with configured selectors, after successful login, the Login Manager should extract user information using the platform's selectors and store it in the account data.

**Validates: Requirements 13.4**

### Property 7: API Endpoint and Format Consistency
*For any* account operation, the Login Manager and Web Frontend should use identical API endpoints and data formats, ensuring interoperability.

**Validates: Requirements 12.1, 12.2, 4.9**

### Property 8: Sync Queue Reliability
*For any* account data queued for synchronization when the backend is unreachable, the data should be successfully transmitted once the backend becomes available again, maintaining queue order.

**Validates: Requirements 4.4**

### Property 9: WebSocket Reconnection Recovery
*For any* WebSocket connection loss, the web client should automatically attempt to reconnect with exponential backoff, and fetch missed updates upon successful reconnection.

**Validates: Requirements 5.9, 5.5**

### Property 10: Platform Support Parity
*For any* platform supported in the web publishing system, the Login Manager should also support that platform with the same platform_id and configuration.

**Validates: Requirements 1.5**

### Property 11: Account List Reactivity
*For any* change to account data (create, update, delete), the Account_List UI should update immediately to reflect the change without requiring manual refresh.

**Validates: Requirements 3.5**

### Property 12: Authentication Header Inclusion
*For any* API request to the Backend_API, the request should include a valid Access_Token in the Authorization header.

**Validates: Requirements 4.2**

### Property 13: HTTPS Protocol Enforcement
*For any* network request to the Backend_API, the request should use the HTTPS protocol.

**Validates: Requirements 11.2**

### Property 14: Error Logging Completeness
*For any* error that occurs in the application, the error should be logged to the local log file with timestamp, error type, and context information.

**Validates: Requirements 10.2, 10.7**

### Property 15: Input Validation Rejection
*For any* invalid user input (empty strings, malformed data, unsupported platforms), the application should reject the input and display a clear error message without crashing.

**Validates: Requirements 10.6**

## Error Handling

### Error Categories

1. **Network Errors**
   - Connection timeout
   - Server unreachable
   - Invalid response

2. **Authentication Errors**
   - Invalid credentials
   - Token expired
   - Unauthorized access

3. **Platform Login Errors**
   - Login page load failure
   - Cookie capture failure
   - User info extraction failure

4. **Storage Errors**
   - Encryption failure
   - Disk full
   - Permission denied

5. **Application Errors**
   - IPC communication failure
   - Window creation failure
   - Unexpected crashes

### Error Handling Strategy

```typescript
// electron/utils/errorHandler.ts
interface ErrorHandler {
  // 错误分类
  categorizeError(error: Error): ErrorCategory;
  
  // 错误处理
  handleError(error: Error, context: string): void;
  
  // 用户通知
  notifyUser(error: Error, recoverable: boolean): void;
  
  // 错误日志
  logError(error: Error, context: string): void;
  
  // 错误恢复
  attemptRecovery(error: Error): Promise<boolean>;
}

enum ErrorCategory {
  NETWORK = 'network',
  AUTH = 'auth',
  PLATFORM_LOGIN = 'platform_login',
  STORAGE = 'storage',
  APPLICATION = 'application'
}
```

### Retry Strategy

```typescript
interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2
};

async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: RetryConfig = defaultRetryConfig
): Promise<T> {
  let lastError: Error;
  let delay = config.initialDelay;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < config.maxRetries) {
        await sleep(delay);
        delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
      }
    }
  }
  
  throw lastError!;
}
```

## Testing Strategy

### Dual Testing Approach

本项目采用双重测试策略，结合单元测试和属性测试，确保全面的代码覆盖和正确性验证。

#### Unit Tests
单元测试用于验证特定示例、边界情况和错误条件：
- 特定平台的登录流程
- API端点的请求/响应格式
- UI组件的渲染和交互
- 错误处理的特定场景

#### Property-Based Tests
属性测试用于验证通用属性在所有输入下都成立：
- 加密/解密的往返一致性
- Token刷新的认证保持
- WebSocket通知的可靠传递
- 数据同步的完整性

### Testing Tools

- **Unit Testing**: Jest + React Testing Library
- **Property Testing**: fast-check (JavaScript property testing library)
- **E2E Testing**: Playwright (for Electron)
- **API Testing**: Supertest
- **Mocking**: MSW (Mock Service Worker)

### Property Test Configuration

所有属性测试必须：
- 运行至少100次迭代
- 使用明确的标签引用设计文档中的属性
- 标签格式: `Feature: windows-platform-login-manager, Property {number}: {property_text}`

### Test Structure

```
windows-login-manager/
├── electron/
│   ├── __tests__/
│   │   ├── unit/
│   │   │   ├── api-client.test.ts
│   │   │   ├── storage-manager.test.ts
│   │   │   └── login-manager.test.ts
│   │   └── property/
│   │       ├── encryption.property.test.ts
│   │       ├── token-refresh.property.test.ts
│   │       └── sync-queue.property.test.ts
├── src/
│   ├── __tests__/
│   │   ├── unit/
│   │   │   ├── components/
│   │   │   └── services/
│   │   └── integration/
│   │       └── ipc-bridge.test.ts
└── e2e/
    ├── login-flow.spec.ts
    └── account-management.spec.ts
```

## Security Considerations

### 1. Data Encryption

```typescript
// electron/security/encryption.ts
interface EncryptionService {
  // 使用Electron safeStorage API
  encrypt(data: string): string;
  decrypt(encryptedData: string): string;
  
  // 额外的AES-256加密层
  encryptWithKey(data: string, key: string): string;
  decryptWithKey(encryptedData: string, key: string): string;
}
```

### 2. Secure Communication

- 所有API请求使用HTTPS
- SSL证书验证
- Token在Authorization header中传输
- WebSocket使用WSS (WebSocket Secure)

### 3. Content Security Policy

```typescript
// electron/main.ts
const csp = `
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://your-backend-api.com wss://your-backend-api.com;
  font-src 'self';
`;

mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [csp]
    }
  });
});
```

### 4. Context Isolation

```typescript
// electron/preload.ts
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loginPlatform: (platformId: string) => ipcRenderer.invoke('login-platform', platformId),
  getAccounts: () => ipcRenderer.invoke('get-accounts'),
  // ... 其他安全的API暴露
});
```

### 5. Input Validation

```typescript
// 所有用户输入必须验证
function validatePlatformId(platformId: string): boolean {
  const validPlatforms = ['wangyi', 'toutiao', 'douyin', /* ... */];
  return validPlatforms.includes(platformId);
}

function sanitizeInput(input: string): string {
  // 移除潜在的XSS攻击向量
  return input.replace(/<script[^>]*>.*?<\/script>/gi, '');
}
```

## Deployment and Packaging

### Build Configuration

```json
// package.json
{
  "name": "platform-login-manager",
  "version": "1.0.0",
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build && electron-builder",
    "build:win": "npm run build -- --win",
    "preview": "vite preview"
  },
  "build": {
    "appId": "com.yourcompany.platform-login-manager",
    "productName": "平台登录管理器",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "dist-electron/**/*"
    ],
    "win": {
      "target": ["nsis", "portable"],
      "icon": "build/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    }
  }
}
```

### Auto-Update Configuration

```typescript
// electron/updater.ts
import { autoUpdater } from 'electron-updater';

export function setupAutoUpdater() {
  autoUpdater.checkForUpdatesAndNotify();
  
  autoUpdater.on('update-available', () => {
    // 通知用户有新版本
  });
  
  autoUpdater.on('update-downloaded', () => {
    // 提示用户重启安装更新
  });
}
```

### Installation Flow

1. 用户下载.exe安装程序
2. 运行安装程序，选择安装位置
3. 安装程序创建桌面和开始菜单快捷方式
4. 首次启动时，引导用户配置后端服务器地址
5. 用户登录后端账号，获取访问令牌
6. 开始使用平台登录功能

## Performance Optimization

### 1. Lazy Loading

```typescript
// 延迟加载大型组件
const Settings = lazy(() => import('./components/Settings'));
const AccountList = lazy(() => import('./components/AccountList'));
```

### 2. Caching Strategy

```typescript
// 缓存平台配置和账号列表
interface CacheManager {
  // 平台配置缓存（1小时）
  getPlatforms(): Promise<Platform[]>;
  
  // 账号列表缓存（5分钟）
  getAccounts(): Promise<Account[]>;
  
  // 强制刷新
  invalidateCache(key: string): void;
}
```

### 3. IPC Optimization

```typescript
// 批量IPC调用
async function batchIPCCalls<T>(
  calls: Array<() => Promise<T>>
): Promise<T[]> {
  return Promise.all(calls.map(call => call()));
}
```

### 4. Memory Management

```typescript
// 及时清理BrowserView
function cleanupBrowserView(view: BrowserView) {
  view.webContents.session.clearCache();
  view.webContents.session.clearStorageData();
  view.webContents.destroy();
}
```

## Future Enhancements

1. **多平台支持**: 扩展到macOS和Linux
2. **批量登录**: 支持一次性登录多个平台
3. **账号分组**: 按用途或项目分组管理账号
4. **登录状态监控**: 定期检查账号登录状态
5. **云端备份**: 将加密的账号数据备份到云端
6. **多语言支持**: 支持英文、中文等多种语言
7. **插件系统**: 允许第三方开发平台适配器
8. **统计分析**: 账号使用情况统计和分析
