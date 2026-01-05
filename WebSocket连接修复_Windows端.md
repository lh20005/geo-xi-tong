# WebSocket 连接修复 - Windows 登录管理器

## 问题描述

Windows 登录管理器的用户管理页面无法连接到 WebSocket 服务器，控制台报错：

```
WebSocket connection to 'ws://localhost:3000/?token=...' failed
```

## 根本原因

1. **环境变量配置错误**：`.env` 文件中 `VITE_WS_BASE_URL` 配置为 `ws://localhost:3000`，缺少 `/ws` 路径
2. **后端 WebSocket 路径**：后端 WebSocket 服务运行在 `ws://localhost:3000/ws`
3. **路径不匹配**：前端尝试连接 `ws://localhost:3000/?token=...`，但后端监听的是 `/ws` 路径

## 修复方案

### 1. 更新环境变量配置 ✅

**文件**: `windows-login-manager/.env` 和 `.env.example`

```env
# 修复前
VITE_WS_BASE_URL=ws://localhost:3000

# 修复后
VITE_WS_BASE_URL=ws://localhost:3000/ws
```

### 2. 增强配置处理逻辑 ✅

**文件**: `windows-login-manager/src/config/env.ts`

添加自动路径补全逻辑，确保即使环境变量配置错误，代码也能正确处理：

```typescript
// 构建 WebSocket URL，确保包含 /ws 路径
let wsBaseUrl = import.meta.env.VITE_WS_BASE_URL || API_BASE_URL.replace('http', 'ws');
if (!wsBaseUrl.endsWith('/ws')) {
  wsBaseUrl = wsBaseUrl.replace(/\/$/, '') + '/ws';
}
```

### 3. 增强连接逻辑 ✅

**文件**: `windows-login-manager/src/services/UserWebSocketService.ts`

添加双重保护，确保 WebSocket URL 始终包含 `/ws` 路径：

```typescript
// 确保 wsUrl 有 /ws 路径
let wsUrl = config.wsUrl || 'ws://localhost:3000/ws';

// 如果 wsUrl 没有 /ws 路径，添加它
if (!wsUrl.endsWith('/ws')) {
  wsUrl = wsUrl.replace(/\/$/, '') + '/ws';
}

const url = `${wsUrl}?token=${token}`;
```

## 验证步骤

### 1. 重启 Windows 登录管理器

```bash
# 停止当前运行的应用
# 然后重新启动
npm run dev
```

### 2. 检查控制台日志

打开开发者工具，应该看到：

```
[Config] 环境配置: { wsUrl: 'ws://localhost:3000/ws', ... }
[UserWebSocket] Connecting to: ws://localhost:3000/ws?token=...
[UserWebSocket] ✅ Connected successfully
[UserWebSocket] Server confirmed connection
```

### 3. 测试用户管理功能

1. 登录 Windows 登录管理器
2. 进入"用户管理"页面
3. 执行用户操作（编辑、删除等）
4. 验证实时更新是否正常工作

## 技术细节

### WebSocket 服务器配置

**后端**: `server/src/index.ts`

```typescript
const webSocketService = getWebSocketService(jwtSecret);
webSocketService.initialize(server);
// WebSocket 服务运行在 ws://localhost:3000/ws
```

**后端**: `server/src/services/WebSocketService.ts`

```typescript
this.wss = new WebSocketServer({ 
  server,
  path: '/ws',  // 关键：WebSocket 路径
  verifyClient: (info) => true
});
```

### 前端连接流程

1. 从 `localStorage` 获取 JWT token
2. 构建 WebSocket URL：`ws://localhost:3000/ws?token=...`
3. 建立 WebSocket 连接
4. 后端验证 JWT token
5. 连接成功，开始接收实时事件

### 支持的事件类型

- `connected` - 连接确认
- `user:updated` - 用户信息更新
- `user:deleted` - 用户删除
- `quota_updated` - 配额更新
- `subscription_updated` - 订阅更新
- `order_status_changed` - 订单状态变更

## 相关文件

- `windows-login-manager/.env` - 环境变量配置
- `windows-login-manager/src/config/env.ts` - 配置处理
- `windows-login-manager/src/services/UserWebSocketService.ts` - WebSocket 客户端
- `windows-login-manager/src/pages/UserManagementPage.tsx` - 用户管理页面
- `server/src/services/WebSocketService.ts` - WebSocket 服务器
- `server/src/index.ts` - 服务器入口

## 注意事项

1. **环境变量更新后需要重启**：修改 `.env` 文件后，必须重启 Vite 开发服务器才能生效
2. **生产环境配置**：部署到生产环境时，确保 `VITE_WS_BASE_URL` 指向正确的 WebSocket 地址（如 `wss://your-domain.com/ws`）
3. **HTTPS/WSS**：生产环境使用 HTTPS 时，WebSocket 也必须使用 WSS 协议
4. **防火墙和代理**：确保 WebSocket 连接不被防火墙或反向代理阻止

## 状态

✅ **已修复** - 2026-01-05

- 环境变量配置已更新
- 配置处理逻辑已增强
- WebSocket 连接逻辑已加固
- 双重保护确保路径正确
