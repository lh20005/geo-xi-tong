# 后端API集成完成文档

## 概述

本文档记录了Windows平台登录管理器与后端服务器的API集成工作。所有后端API功能已完成实现并集成到现有的GEO优化系统服务器中。

## 完成的工作

### 1. 认证API (Auth API)

**文件**: `server/src/routes/auth.ts`

实现了完整的JWT认证系统：

- **POST /api/auth/login** - 用户登录，返回访问令牌和刷新令牌
- **POST /api/auth/refresh** - 刷新访问令牌
- **POST /api/auth/logout** - 用户登出
- **GET /api/auth/verify** - 验证令牌有效性

**特性**:
- JWT访问令牌（1小时有效期）
- JWT刷新令牌（7天有效期）
- 环境变量配置的密钥
- 完整的错误处理

**集成**: 已在 `server/src/routes/index.ts` 中注册为 `/api/auth` 路由

### 2. 账号管理API (Account API)

**文件**: `server/src/routes/platformAccounts.ts`

复用并增强了现有的账号管理API：

- **GET /api/publishing/platforms** - 获取所有平台配置
- **GET /api/publishing/accounts** - 获取所有账号
- **GET /api/publishing/accounts/platform/:platformId** - 获取指定平台的账号
- **GET /api/publishing/accounts/:id** - 获取账号详情
- **POST /api/publishing/accounts** - 创建新账号
- **PUT /api/publishing/accounts/:id** - 更新账号
- **DELETE /api/publishing/accounts/:id** - 删除账号
- **POST /api/publishing/accounts/:id/set-default** - 设置默认账号
- **POST /api/publishing/browser-login** - 浏览器登录

**增强**: 
- 添加了WebSocket事件广播
- 账号创建、更新、删除时自动通知所有连接的客户端

### 3. WebSocket服务 (WebSocket Service)

**文件**: `server/src/services/WebSocketService.ts`

实现了完整的WebSocket实时通信服务：

**核心功能**:
- WebSocket服务器（路径: `/ws`）
- 客户端连接管理
- JWT认证支持
- 心跳检测（30秒间隔）
- 消息广播
- 账号事件通知

**消息类型**:
- `connected` - 连接成功
- `auth` / `auth_success` - 认证
- `subscribe` / `subscribed` - 频道订阅
- `ping` / `pong` - 心跳
- `account.created` - 账号创建事件
- `account.updated` - 账号更新事件
- `account.deleted` - 账号删除事件
- `error` - 错误消息

**集成**: 已在 `server/src/index.ts` 中初始化并与HTTP服务器集成

### 4. 服务器启动集成

**文件**: `server/src/index.ts`

更新了服务器启动流程：

```typescript
// 创建HTTP服务器
const server = createServer(app);

// 初始化WebSocket服务
webSocketService.initialize(server);

server.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
  console.log(`🔌 WebSocket服务运行在 ws://localhost:${PORT}/ws`);
});
```

**优雅关闭**:
- SIGTERM和SIGINT信号处理
- 自动关闭WebSocket连接
- 停止任务调度器

### 5. Electron WebSocket客户端

**文件**: `windows-login-manager/electron/websocket/client.ts`

为Electron应用创建了WebSocket客户端：

**功能**:
- 自动连接和重连（最多5次尝试）
- JWT认证
- 心跳保持
- 事件发射器模式
- 账号事件监听

**API**:
```typescript
const wsClient = getWebSocketClient('ws://localhost:3000/ws');
wsClient.connect(token);
wsClient.on('account_event', (event) => {
  // 处理账号事件
});
```

## 依赖安装

已安装的npm包：

```bash
# 生产依赖
npm install jsonwebtoken ws

# 开发依赖
npm install --save-dev @types/jsonwebtoken @types/ws
```

## API端点总览

### 认证端点
```
POST   /api/auth/login      - 登录
POST   /api/auth/refresh    - 刷新令牌
POST   /api/auth/logout     - 登出
GET    /api/auth/verify     - 验证令牌
```

### 账号管理端点
```
GET    /api/publishing/platforms                    - 获取平台列表
GET    /api/publishing/accounts                     - 获取所有账号
GET    /api/publishing/accounts/platform/:id        - 获取平台账号
GET    /api/publishing/accounts/:id                 - 获取账号详情
POST   /api/publishing/accounts                     - 创建账号
PUT    /api/publishing/accounts/:id                 - 更新账号
DELETE /api/publishing/accounts/:id                 - 删除账号
POST   /api/publishing/accounts/:id/set-default     - 设置默认账号
POST   /api/publishing/browser-login                - 浏览器登录
```

### WebSocket端点
```
WS     /ws                  - WebSocket连接
```

## 使用流程

### 1. 启动服务器

```bash
cd server
npm run dev
```

服务器将在以下端口启动：
- HTTP API: `http://localhost:3000`
- WebSocket: `ws://localhost:3000/ws`

### 2. 认证流程

```typescript
// 1. 登录获取令牌
const response = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'admin123'
  })
});

const { token, refreshToken } = await response.json();

// 2. 使用令牌访问API
const accounts = await fetch('http://localhost:3000/api/publishing/accounts', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### 3. WebSocket连接

```typescript
// 1. 建立连接
const ws = new WebSocket('ws://localhost:3000/ws');

// 2. 认证
ws.send(JSON.stringify({
  type: 'auth',
  data: { token: accessToken }
}));

// 3. 订阅频道
ws.send(JSON.stringify({
  type: 'subscribe',
  data: { channels: ['accounts'] }
}));

// 4. 监听事件
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'account.created') {
    console.log('新账号创建:', message.data);
  }
};
```

## 环境变量配置

在 `.env` 文件中添加以下配置：

```env
# JWT配置
JWT_SECRET=your-secret-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key

# 管理员账号（可选）
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# 服务器端口
PORT=3000
```

## 安全考虑

1. **JWT密钥**: 生产环境必须使用强密钥
2. **HTTPS**: 生产环境应使用HTTPS和WSS
3. **令牌过期**: 访问令牌1小时，刷新令牌7天
4. **WebSocket认证**: 所有WebSocket连接必须先认证
5. **CORS**: 已配置CORS中间件

## 测试建议

### 1. 测试认证API

```bash
# 登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 验证令牌
curl http://localhost:3000/api/auth/verify \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. 测试账号API

```bash
# 获取所有账号
curl http://localhost:3000/api/publishing/accounts \
  -H "Authorization: Bearer YOUR_TOKEN"

# 创建账号
curl -X POST http://localhost:3000/api/publishing/accounts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "platform_id": "xiaohongshu",
    "account_name": "测试账号",
    "credentials": {"cookies": []}
  }'
```

### 3. 测试WebSocket

使用浏览器控制台或WebSocket客户端工具：

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  console.log('Connected');
  ws.send(JSON.stringify({
    type: 'auth',
    data: { token: 'YOUR_TOKEN' }
  }));
};

ws.onmessage = (event) => {
  console.log('Message:', JSON.parse(event.data));
};
```

## 下一步工作

虽然后端API已完成，但以下工作可以进一步增强系统：

1. **Electron应用集成**: 在Electron应用中集成WebSocket客户端
2. **实时UI更新**: 账号列表页面监听WebSocket事件并自动刷新
3. **错误处理**: 增强网络错误和重连逻辑
4. **用户管理**: 实现完整的用户表和权限系统
5. **日志记录**: 添加详细的API访问日志

## 故障排除

### WebSocket连接失败

1. 检查服务器是否正常运行
2. 确认端口3000未被占用
3. 检查防火墙设置
4. 验证WebSocket URL格式正确

### 认证失败

1. 检查用户名密码是否正确
2. 验证JWT_SECRET环境变量已设置
3. 确认令牌未过期
4. 检查Authorization头格式

### 账号操作失败

1. 确认已登录并有有效令牌
2. 检查请求数据格式
3. 验证平台ID存在
4. 查看服务器日志获取详细错误

## 总结

后端API集成已全部完成，包括：

✅ JWT认证系统
✅ 账号管理API
✅ WebSocket实时通信
✅ 服务器集成
✅ Electron WebSocket客户端
✅ 依赖安装

系统现在支持完整的账号管理和实时同步功能，可以在Electron应用和Web前端之间实现数据同步。
