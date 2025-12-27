# 桌面客户端迁移设计文档

## 概述

本文档描述将 Web 前端完整迁移到 Windows 桌面客户端的技术设计方案。采用渐进式迁移策略，确保现有功能不受影响的同时，逐步集成所有 Web 端功能。

### 设计目标

1. **功能完整性**: 所有 Web 端功能在桌面端可用
2. **界面一致性**: 保持与 Web 端完全相同的 UI/UX
3. **性能优越性**: 利用本地渲染提升性能
4. **代码复用性**: 最大化复用现有代码
5. **可维护性**: 清晰的架构便于后续开发

## 架构设计

### 整体架构

```
Desktop Application (Electron)
├── Main Process (Node.js)
│   ├── Window Management
│   ├── IPC Handlers
│   ├── Storage (electron-store)
│   └── WebSocket Client
│
└── Renderer Process (Chromium)
    └── React Application
        ├── Router (react-router-dom)
        ├── Layout (Sidebar + Header)
        ├── Pages (30+ pages)
        ├── Components (Ant Design + Custom)
        ├── State (Zustand)
        ├── Services (API + WebSocket)
        └── Utils
```

### 迁移策略

采用**增量迁移**策略，分 3 个阶段：

**阶段 1: 基础设施准备**
- 安装所有必需的依赖包
- 配置构建工具（Vite、TypeScript、Tailwind）
- 设置 Electron 主进程架构

**阶段 2: 核心功能迁移**
- 复制 Web 端源代码结构
- 适配 API 层和认证
- 迁移布局和路由系统
- 集成状态管理

**阶段 3: 页面和功能集成**
- 逐个迁移所有页面
- 集成富文本、图表等特殊功能
- 性能优化和测试
- 构建打包

## 组件和接口

### 1. 主进程组件

#### 1.1 窗口管理器

```typescript
interface WindowManager {
  createMainWindow(): BrowserWindow;
  getMainWindow(): BrowserWindow | null;
  saveWindowState(): void;
  restoreWindowState(): void;
}
```

#### 1.2 IPC 处理器

```typescript
interface IPCHandler {
  // 认证
  handleLogin(credentials: Credentials): Promise<AuthResult>;
  handleLogout(): Promise<void>;
  handleCheckAuth(): Promise<AuthStatus>;
  
  // 存储
  handleGetConfig(): Promise<Config>;
  handleSaveConfig(config: Config): Promise<void>;
  
  // 系统
  handleOpenExternal(url: string): Promise<void>;
}
```

#### 1.3 存储管理器

```typescript
interface StorageManager {
  // Token 管理
  getTokens(): Promise<Tokens | null>;
  saveTokens(tokens: Tokens): Promise<void>;
  clearTokens(): Promise<void>;
  
  // 配置管理
  getConfig(): Promise<Config>;
  saveConfig(config: Config): Promise<void>;
  
  // 窗口状态
  getWindowState(): Promise<WindowState>;
  saveWindowState(state: WindowState): Promise<void>;
}
```

### 2. 渲染进程组件

#### 2.1 路由系统

```typescript
// 路由配置
const routes = [
  { path: '/', component: Dashboard },
  { path: '/distillation', component: DistillationPage },
  { path: '/articles', component: ArticleListPage },
  // ... 30+ 个路由
];

// 路由保护
<ProtectedRoute>
  <AdminRoute>
    <Component />
  </AdminRoute>
</ProtectedRoute>
```

#### 2.2 布局系统

```typescript
interface LayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
}

// Layout 组件
<Layout>
  <Sidebar />
  <Layout>
    <Header />
    <Content>{children}</Content>
  </Layout>
</Layout>
```

#### 2.3 API 服务层

```typescript
interface APIService {
  // HTTP 请求
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T>;
  post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
  put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
  delete<T>(url: string, config?: AxiosRequestConfig): Promise<T>;
  
  // 认证
  setAuthToken(token: string): void;
  clearAuthToken(): void;
}
```

#### 2.4 状态管理

```typescript
// Zustand Store
interface AppStore {
  user: User | null;
  setUser: (user: User | null) => void;
  
  config: Config;
  setConfig: (config: Config) => void;
  
  // ... 其他状态
}
```

### 3. WebSocket 集成

```typescript
interface WebSocketService {
  connect(): Promise<void>;
  disconnect(): void;
  
  on(event: string, handler: EventHandler): void;
  off(event: string, handler: EventHandler): void;
  
  // 事件类型
  // - user:updated
  // - user:deleted
  // - user:password-changed
}
```

## 数据模型

### 认证数据

```typescript
interface Tokens {
  authToken: string;
  refreshToken: string;
}

interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
  email?: string;
}

interface AuthStatus {
  isAuthenticated: boolean;
  user: User | null;
}
```

### 配置数据

```typescript
interface Config {
  apiBaseUrl: string;
  wsBaseUrl: string;
  theme: 'light' | 'dark';
  language: 'zh-CN' | 'en-US';
}

interface WindowState {
  width: number;
  height: number;
  x: number;
  y: number;
  isMaximized: boolean;
}
```

## 正确性属性

*属性是应该在系统所有有效执行中保持为真的特征或行为——本质上是关于系统应该做什么的正式陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### 属性 1: 功能完整性

*对于任何* Web 端存在的页面，桌面端应该有对应的可访问页面，且功能行为一致

**验证需求: 2.1, 2.2, 2.4**

### 属性 2: 认证状态一致性

*对于任何* 认证操作（登录、登出、token 刷新），主进程和渲染进程的认证状态应该保持同步

**验证需求: 4.2, 4.3, 4.4**

### 属性 3: 数据持久化

*对于任何* 需要持久化的数据（token、配置、窗口状态），应用重启后应该能够正确恢复

**验证需求: 4.4**

### 属性 4: 路由保护

*对于任何* 受保护的路由，未认证用户应该被重定向到登录页面，非管理员用户不能访问管理员页面

**验证需求: 6.2, 6.3, 6.4**

### 属性 5: WebSocket 事件处理

*对于任何* WebSocket 事件（用户更新、删除、密码修改），应该触发相应的 UI 更新或用户通知

**验证需求: 5.2, 5.3, 5.4, 5.5**

### 属性 6: API 错误处理

*对于任何* API 请求失败，应该显示用户友好的错误消息，且不应导致应用崩溃

**验证需求: 4.5**

### 属性 7: 组件渲染一致性

*对于任何* 从 Web 端迁移的组件，在桌面端应该渲染相同的 UI 结构和样式

**验证需求: 2.2, 2.3, 2.5**

## 错误处理

### 错误类型

1. **网络错误**: API 请求失败、WebSocket 断连
2. **认证错误**: Token 过期、权限不足
3. **数据错误**: 数据格式错误、验证失败
4. **系统错误**: 文件读写失败、IPC 通信失败

### 错误处理策略

```typescript
// 全局错误边界
<ErrorBoundary fallback={<ErrorPage />}>
  <App />
</ErrorBoundary>

// API 错误处理
try {
  const data = await api.get('/endpoint');
} catch (error) {
  if (error.response?.status === 401) {
    // Token 过期，刷新或重新登录
  } else if (error.response?.status === 403) {
    // 权限不足
  } else {
    // 其他错误
    message.error('操作失败，请重试');
  }
}

// WebSocket 错误处理
wsService.on('error', (error) => {
  console.error('WebSocket error:', error);
  // 自动重连
});
```

## 测试策略

### 单元测试

- 测试工具函数和业务逻辑
- 测试 API 服务层
- 测试状态管理

### 集成测试

- 测试 IPC 通信
- 测试认证流程
- 测试路由导航

### 端到端测试

- 测试完整的用户工作流
- 测试页面交互
- 测试数据持久化

### 手动测试清单

- [ ] 所有页面可访问
- [ ] 登录/登出功能正常
- [ ] 路由保护生效
- [ ] WebSocket 实时更新
- [ ] 数据正确保存和恢复
- [ ] 窗口状态持久化
- [ ] 应用性能流畅
- [ ] 打包后的应用正常运行

## 性能优化

### 优化策略

1. **代码分割**: 使用 React.lazy 和 Suspense 实现路由懒加载
2. **打包优化**: 使用 Vite 的 tree-shaking 和代码压缩
3. **缓存策略**: 缓存 API 响应和静态资源
4. **虚拟滚动**: 大列表使用虚拟滚动
5. **图片优化**: 压缩图片，使用 WebP 格式

### 性能指标

- 应用启动时间: < 5 秒
- 页面切换时间: < 500ms
- API 响应时间: < 2 秒
- 内存使用: < 500MB
- 打包大小: < 300MB

## 构建和部署

### 开发环境

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run electron:dev
```

### 生产构建

```bash
# 构建应用
npm run build

# 打包 Windows 安装程序
npm run build:win
```

### 自动更新

使用 electron-updater 实现自动更新：

```typescript
import { autoUpdater } from 'electron-updater';

autoUpdater.checkForUpdatesAndNotify();

autoUpdater.on('update-available', () => {
  // 通知用户有新版本
});

autoUpdater.on('update-downloaded', () => {
  // 提示用户重启应用
});
```
