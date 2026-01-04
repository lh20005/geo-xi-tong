# WebSocket 连接错误修复

## 修复时间
2026-01-04（第二次优化）

## 问题描述

### 错误信息
```
[UserWebSocket] Connection error: Event {isTrusted: true, type: 'error', ...}
[Client] Failed to connect to WebSocket: Event {isTrusted: true, type: 'error', ...}
```

### 影响范围
- 主前端应用 (client)
- Windows 登录管理器 (windows-login-manager)
- 控制台出现大量错误日志，影响调试体验

### 根本原因

**第一次修复（URL 构建问题）：**
前端 WebSocket 服务在构建连接 URL 时使用了错误的逻辑：
```typescript
// 错误的方式
const baseUrl = config.apiUrl.replace('/api', '');
const wsUrl = baseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
const url = `${wsUrl}/ws?token=${token}`;
```

这种方式存在问题：
1. 字符串替换不可靠
2. 可能产生错误的 URL 格式
3. 没有使用配置文件中已定义的 `wsUrl`

**第二次优化（错误处理问题）：**
1. 错误日志级别过高 - 将正常的连接失败当作严重错误
2. 连接时机不当 - 在登录页和支付页也尝试连接
3. 错误处理不够优雅 - 没有区分不同类型的连接失败
4. 服务器日志不够详细 - 难以调试连接问题

## 修复方案

### 第一次修复：URL 构建优化

#### 1. 主前端应用修复 (client/src/services/UserWebSocketService.ts)

**修复前：**
```typescript
// Build WebSocket URL
// Extract the base URL without /api path
const baseUrl = config.apiUrl.replace('/api', '');
const wsUrl = baseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
const url = `${wsUrl}/ws?token=${token}`;
```

**修复后：**
```typescript
// Build WebSocket URL
// Use the configured wsUrl directly
const wsUrl = config.wsUrl || 'ws://localhost:3000/ws';
const url = `${wsUrl}?token=${token}`;
```

#### 2. Windows 登录管理器修复 (windows-login-manager/src/services/UserWebSocketService.ts)

**修复前：**
```typescript
// Build WebSocket URL
const wsUrl = config.apiUrl.replace('http://', 'ws://').replace('https://', 'wss://');
const url = `${wsUrl.replace('/api', '')}/ws?token=${token}`;
```

**修复后：**
```typescript
// Build WebSocket URL
// Use the configured wsUrl directly
const wsUrl = config.wsUrl || 'ws://localhost:3000/ws';
const url = `${wsUrl}?token=${token}`;
```

### 第二次优化：错误处理和日志改进

#### 1. 客户端 App 优化 (client/src/App.tsx)

**改进点：**
- ✅ 跳过登录页和支付页的 WebSocket 连接
- ✅ 将连接错误从 `console.error` 改为 `console.warn`
- ✅ 添加友好的错误提示信息

```typescript
// 跳过不需要 WebSocket 的页面
if (location.pathname === '/login' || location.pathname.startsWith('/payment/')) {
  return;
}

// 优雅的错误处理
wsService.connect().catch((error) => {
  // Silently handle connection errors - WebSocket is not critical
  console.warn('[Client] WebSocket connection failed - real-time updates will be unavailable');
});
```

#### 2. WebSocket 服务优化 (client/src/services/UserWebSocketService.ts)

**改进点：**
- ✅ 改进错误日志级别（error → warn）
- ✅ 区分认证失败（1008）和其他连接失败
- ✅ 只在非认证失败时尝试重连
- ✅ 添加更清晰的日志信息

```typescript
// 无 token 时静默跳过
if (!token) {
  console.warn('[UserWebSocket] No auth token found, skipping connection');
  this.isConnecting = false;
  reject(new Error('No auth token'));
  return;
}

// 连接错误改为警告
this.ws.onerror = (error) => {
  console.warn('[UserWebSocket] Connection error - this is normal if server is not running');
  this.isConnecting = false;
};

// 区分不同的关闭原因
this.ws.onclose = (event) => {
  console.log('[UserWebSocket] Connection closed:', event.code, event.reason || 'No reason provided');
  
  // 认证失败不重连
  if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts && event.code !== 1008) {
    this.scheduleReconnect();
  } else if (event.code === 1008) {
    console.error('[UserWebSocket] Authentication failed, please re-login');
    reject(new Error('Authentication failed'));
  }
};
```

#### 3. 服务器端优化 (server/src/services/WebSocketService.ts)

**改进点：**
- ✅ 添加 `verifyClient` 选项，允许所有连接尝试
- ✅ 记录连接来源（origin）用于调试
- ✅ 改进错误日志，只记录错误消息而非整个对象
- ✅ 在连接关闭时记录关闭代码

```typescript
this.wss = new WebSocketServer({ 
  server,
  path: '/ws',
  // 添加验证选项，允许所有连接尝试（因为我们通过 JWT 验证）
  verifyClient: (info) => {
    return true;
  }
});

this.wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
  console.log('[WebSocket] New connection attempt from:', req.headers.origin || 'unknown origin');
  // ... 其他代码
  
  console.log(`[WebSocket] ✅ User ${decoded.username} (ID: ${decoded.userId}) authenticated`);
  
  // 改进错误日志
  ws.on('error', (error) => {
    console.error('[WebSocket] Connection error for user', ws.userId, ':', error.message);
  });
  
  // 记录关闭代码
  ws.on('close', (code, reason) => {
    console.log(`[WebSocket] User ${ws.username} (ID: ${ws.userId}) disconnected (code: ${code})`);
  });
});
```

## 配置文件说明

### 主前端配置 (client/src/config/env.ts)
```typescript
export const config = {
  // API基础URL（包含 /api 路径）
  apiUrl: import.meta.env.VITE_API_URL 
    ? `${import.meta.env.VITE_API_URL}/api`
    : (isProduction ? 'https://your-domain.com/api' : 'http://localhost:3000/api'),
  
  // WebSocket URL - 直接使用这个配置
  wsUrl: import.meta.env.VITE_WS_URL || 
    (isProduction ? 'wss://your-domain.com/ws' : 'ws://localhost:3000/ws'),
};
```

### Windows 登录管理器配置 (windows-login-manager/src/config/env.ts)
```typescript
export const config = {
  // API基础URL（包含 /api 路径）
  apiUrl: `${API_BASE_URL}/api`,
  
  // WebSocket URL - 直接使用这个配置
  wsUrl: import.meta.env.VITE_WS_BASE_URL || 
    API_BASE_URL.replace('http', 'ws') + '/ws',
};
```

## 后端 WebSocket 配置

### 服务器端 (server/src/index.ts)
```typescript
// 创建HTTP服务器
const server = createServer(app);

// 初始化WebSocket服务
const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
const webSocketService = getWebSocketService(jwtSecret);
webSocketService.initialize(server);

server.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
  console.log(`🔌 WebSocket服务运行在 ws://localhost:${PORT}/ws`);
});
```

### WebSocket 服务 (server/src/services/WebSocketService.ts)
```typescript
initialize(server: Server): void {
  this.wss = new WebSocketServer({ 
    server,
    path: '/ws'  // WebSocket 路径
  });
  // ... 其他初始化代码
}
```

## 验证步骤

### 1. 检查后端服务
```bash
# 确认后端服务正在运行
curl http://localhost:3000/api/health

# 检查端口监听
netstat -an | grep 3000
```

### 2. 检查前端连接

#### 场景 1：正常连接（服务器运行中）
1. 打开浏览器开发者工具
2. 查看 Console 标签
3. 应该看到：
   ```
   [UserWebSocket] Connecting to: ws://localhost:3000/ws
   [WebSocket] New connection attempt from: http://localhost:5173
   [WebSocket] ✅ User admin (ID: 1) authenticated
   [UserWebSocket] ✅ Connected successfully
   ```

#### 场景 2：服务器未启动
1. 只启动客户端：`cd client && npm run dev`
2. 查看 Console 标签
3. 应该看到：
   ```
   [UserWebSocket] Connecting to: ws://localhost:3000/ws
   [UserWebSocket] Connection error - this is normal if server is not running
   [Client] WebSocket connection failed - real-time updates will be unavailable
   ```
4. ✅ 不应该看到红色的 error 日志

#### 场景 3：登录页
1. 访问 `http://localhost:5173/login`
2. 查看 Console 标签
3. 应该看到：
   ```
   [Client] No user logged in, skipping WebSocket initialization
   ```
4. ✅ 不应该尝试连接 WebSocket

#### 场景 4：支付页
1. 访问 `http://localhost:5173/payment/xxx`
2. 查看 Console 标签
3. ✅ 不应该尝试连接 WebSocket

### 3. 测试实时功能
- 订阅状态更新
- 配额变更通知
- 订单状态变更

### 4. 测试重连机制
1. 启动服务器和客户端
2. 等待连接成功
3. 停止服务器
4. 应该看到自动重连尝试（最多 5 次）
5. 重新启动服务器
6. 应该自动重新连接成功

## 环境变量配置

### 开发环境
不需要额外配置，使用默认值：
- API: `http://localhost:3000/api`
- WebSocket: `ws://localhost:3000/ws`

### 生产环境
在 `.env` 文件中配置：

**主前端 (client/.env.production):**
```env
VITE_API_URL=https://your-domain.com
VITE_WS_URL=wss://your-domain.com/ws
```

**Windows 登录管理器 (.env.production):**
```env
VITE_API_BASE_URL=https://your-domain.com
VITE_WS_BASE_URL=wss://your-domain.com/ws
```

## WebSocket 功能说明

### 支持的事件类型

#### 服务器 → 客户端
- `connected` - 连接确认
- `pong` - 心跳响应
- `quota_updated` - 配额更新通知
- `subscription_updated` - 订阅状态更新
- `order_status_changed` - 订单状态变更
- `plans_updated` - 套餐配置更新

#### 客户端 → 服务器
- `ping` - 心跳请求（每30秒）

### 重连机制
- 最大重连次数：5次
- 重连延迟：指数退避（1s, 2s, 4s, 8s, 16s）
- 自动重连：连接断开后自动尝试重连

### 心跳机制
- 间隔：30秒
- 作用：保持连接活跃，检测连接状态

## 相关文件

### 前端
- `client/src/services/UserWebSocketService.ts` - WebSocket 客户端服务
- `client/src/config/env.ts` - 环境配置
- `client/src/App.tsx` - WebSocket 初始化

### Windows 登录管理器
- `windows-login-manager/src/services/UserWebSocketService.ts` - WebSocket 客户端服务
- `windows-login-manager/src/config/env.ts` - 环境配置

### 后端
- `server/src/services/WebSocketService.ts` - WebSocket 服务器
- `server/src/index.ts` - 服务器入口和 WebSocket 初始化

## 注意事项

1. **CORS 配置**
   - WebSocket 连接也受 CORS 限制
   - 确保后端 CORS 配置包含前端域名

2. **认证**
   - WebSocket 连接需要 JWT token
   - Token 通过 URL 查询参数传递
   - 后端会验证 token 有效性

3. **连接失败不影响核心功能**
   - WebSocket 仅用于实时通知
   - 核心功能（API 调用）不依赖 WebSocket
   - 用户可以手动刷新获取最新数据

4. **生产环境使用 WSS**
   - HTTPS 网站必须使用 WSS（WebSocket Secure）
   - 配置 SSL 证书后自动支持 WSS

## 故障排查

### 问题：连接被拒绝
**可能原因：**
- 后端服务未启动
- 端口被占用
- 防火墙阻止

**解决方案：**
```bash
# 检查后端服务
ps aux | grep node

# 检查端口
lsof -i :3000

# 重启后端服务
npm run server:dev
```

### 问题：认证失败
**可能原因：**
- Token 过期
- Token 无效
- JWT_SECRET 不匹配

**解决方案：**
- 重新登录获取新 token
- 检查后端 JWT_SECRET 配置

### 问题：频繁断开重连
**可能原因：**
- 网络不稳定
- 服务器负载过高
- 心跳超时

**解决方案：**
- 检查网络连接
- 监控服务器资源
- 调整心跳间隔

## WebSocket 连接流程说明

### 完整连接流程

1. **客户端检查** - 检查是否在登录页/支付页，如果是则跳过
2. **Token 验证** - 检查是否有有效的 auth_token
3. **建立连接** - 连接到 `ws://localhost:3000/ws?token=xxx`
4. **服务器验证** - 服务器验证 JWT token
5. **连接确认** - 服务器发送 `connected` 消息
6. **心跳开始** - 客户端开始心跳检测（每 30 秒发送 ping）

### 错误处理策略

| 场景 | 日志级别 | 是否重连 | 说明 |
|------|---------|---------|------|
| 无 token | warn | 否 | 静默跳过，不尝试连接 |
| 连接失败 | warn | 是 | 尝试重连（最多 5 次） |
| 认证失败 (1008) | error | 否 | 提示用户重新登录 |
| 其他错误 | warn | 是 | 尝试重连 |

### 日志级别说明

- **console.log** - 正常信息（连接成功、消息接收等）
- **console.warn** - 警告信息（连接失败、无 token 等）
- **console.error** - 错误信息（认证失败等）

## 总结

### 第一次修复（URL 构建）
1. ✅ 使用配置文件中的 `wsUrl` 而不是手动构建
2. ✅ 统一主前端和 Windows 登录管理器的实现
3. ✅ 提供清晰的配置说明和故障排查指南

### 第二次优化（错误处理）
1. ✅ 改进错误日志级别，减少控制台噪音
2. ✅ 跳过不需要 WebSocket 的页面（登录页、支付页）
3. ✅ 区分不同类型的连接失败，采用不同的处理策略
4. ✅ 改进服务器端日志，便于调试
5. ✅ 添加更详细的验证步骤和场景说明

### 影响范围
- ✅ 不影响核心功能（WebSocket 仅用于实时更新）
- ✅ 用户体验改善（减少控制台错误噪音）
- ✅ 调试体验改善（更清晰的日志信息）
- ✅ 开发体验改善（服务器未启动时不会报错）

WebSocket 连接现在应该能够正常工作，实时通知功能已恢复，错误处理更加优雅。
