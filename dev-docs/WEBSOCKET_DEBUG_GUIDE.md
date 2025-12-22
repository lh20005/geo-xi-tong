# WebSocket自动刷新调试指南

## 问题描述

网页端账户管理列表不能自动同步信息，需要手动刷新。

## 调试步骤

### 1. 检查后端WebSocket服务

#### 启动后端并查看日志

```bash
cd server
npm run dev
```

**预期日志**：
```
✅ WebSocket服务器初始化成功
🚀 服务器运行在 http://localhost:3000
🔌 WebSocket服务运行在 ws://localhost:3000/ws
```

### 2. 检查前端WebSocket连接

#### 打开浏览器控制台

1. 访问：http://localhost:5173
2. 登录系统
3. 进入"平台管理"页面
4. 按 F12 打开开发者工具
5. 切换到 Console 标签页

**预期日志**：
```
[WebSocket] Initializing connection to: ws://localhost:3000/ws
[WebSocket] Auth token found, length: XXX
[WebSocket] Connecting...
[WebSocket] ✅ Connected successfully
[WebSocket] ✅ Authenticated successfully
[WebSocket] Subscribing to channels: [accounts]
```

#### 检查Network标签页

1. 切换到 Network 标签页
2. 筛选 WS (WebSocket)
3. 应该看到一个到 `ws://localhost:3000/ws` 的连接
4. 状态应该是 `101 Switching Protocols`（绿色）

### 3. 测试账号创建事件

#### 使用Windows登录管理器登录

1. 启动Windows登录管理器
   ```bash
   cd windows-login-manager
   npm run dev
   ```

2. 选择一个平台进行登录

3. 完成登录流程

#### 查看后端日志

**预期日志**：
```
[WebSocket] 📢 Broadcasting account event: account.created { accountId: XXX, clientCount: 1 }
[WebSocket] 📤 Message sent to 1 authenticated clients
[WebSocket] ✅ Broadcast complete for: account.created
```

#### 查看前端控制台

**预期日志**：
```
[WebSocket] 🎉 Account created event received: { id: XXX, platform_id: 'xxx', ... }
检测到新账号创建，正在刷新列表...
```

### 4. 常见问题排查

#### 问题1：前端显示"未连接"

**可能原因**：
- 后端服务未启动
- WebSocket URL配置错误
- 认证token不存在

**解决方法**：
```bash
# 1. 检查后端服务
lsof -i :3000

# 2. 检查localStorage中的auth_token
# 在浏览器控制台执行：
localStorage.getItem('auth_token')

# 3. 如果token不存在，重新登录
```

#### 问题2：连接成功但未收到事件

**可能原因**：
- 未订阅accounts频道
- 认证失败
- 后端未广播事件

**检查步骤**：

1. **检查订阅**
   在浏览器控制台查找：
   ```
   [WebSocket] Subscribing to channels: [accounts]
   ```

2. **检查认证**
   在浏览器控制台查找：
   ```
   [WebSocket] ✅ Authenticated successfully
   ```

3. **检查后端广播**
   在后端日志查找：
   ```
   [WebSocket] 📢 Broadcasting account event
   ```

#### 问题3：后端显示0个客户端

**可能原因**：
- 前端未认证成功
- WebSocket连接断开

**解决方法**：

1. 刷新网页重新连接
2. 检查JWT_SECRET是否一致
3. 检查token是否过期

### 5. 手动测试WebSocket

#### 使用wscat工具

```bash
# 安装wscat
npm install -g wscat

# 连接到WebSocket
wscat -c ws://localhost:3000/ws

# 发送认证消息（替换YOUR_TOKEN）
{"type":"auth","data":{"token":"YOUR_TOKEN"}}

# 订阅频道
{"type":"subscribe","data":{"channels":["accounts"]}}

# 等待接收事件
```

#### 使用浏览器控制台

```javascript
// 在浏览器控制台执行

// 1. 获取token
const token = localStorage.getItem('auth_token');
console.log('Token:', token);

// 2. 创建WebSocket连接
const ws = new WebSocket('ws://localhost:3000/ws');

// 3. 监听事件
ws.onopen = () => {
  console.log('Connected');
  // 认证
  ws.send(JSON.stringify({
    type: 'auth',
    data: { token }
  }));
};

ws.onmessage = (event) => {
  console.log('Message:', JSON.parse(event.data));
};

// 4. 认证成功后订阅
// 等待收到 auth_success 消息后执行：
ws.send(JSON.stringify({
  type: 'subscribe',
  data: { channels: ['accounts'] }
}));
```

### 6. 验证清单

使用以下清单逐项检查：

- [ ] 后端服务运行正常（端口3000）
- [ ] 前端服务运行正常（端口5173）
- [ ] 浏览器控制台显示 "WebSocket connected"
- [ ] 浏览器控制台显示 "Authenticated successfully"
- [ ] 浏览器控制台显示 "Subscribing to channels: [accounts]"
- [ ] Network标签显示WebSocket连接（绿色）
- [ ] 页面右上角显示"已连接"标签
- [ ] Windows端登录后，后端日志显示广播事件
- [ ] 前端控制台显示接收到事件
- [ ] 页面显示提示消息并自动刷新

### 7. 完整测试流程

```bash
# 终端1：启动后端
cd server
npm run dev
# 等待看到：✅ WebSocket服务器初始化成功

# 终端2：启动前端
cd client
npm run dev
# 等待看到：Local: http://localhost:5173

# 终端3：启动Windows登录管理器
cd windows-login-manager
npm run dev

# 浏览器：
# 1. 打开 http://localhost:5173
# 2. 登录系统
# 3. 进入平台管理页面
# 4. 按F12打开控制台
# 5. 确认看到 WebSocket 连接成功的日志

# Windows登录管理器：
# 1. 选择一个平台
# 2. 完成登录

# 验证：
# - 后端日志显示广播事件
# - 前端控制台显示接收事件
# - 页面自动刷新
# - 新账号出现在列表中
```

### 8. 日志对照表

| 阶段 | 前端日志 | 后端日志 |
|------|---------|---------|
| 初始化 | `[WebSocket] Initializing connection` | - |
| 连接 | `[WebSocket] ✅ Connected successfully` | `新的WebSocket连接` |
| 认证 | `[WebSocket] ✅ Authenticated successfully` | `[WebSocket] ✅ User authenticated` |
| 订阅 | `[WebSocket] Subscribing to channels` | `[WebSocket] ✅ Client subscribed` |
| 创建账号 | `[WebSocket] 🎉 Account created event received` | `[WebSocket] 📢 Broadcasting account event` |
| 刷新列表 | `检测到新账号创建，正在刷新列表...` | - |

### 9. 故障排除命令

```bash
# 检查端口占用
lsof -i :3000  # 后端
lsof -i :5173  # 前端

# 查看进程
ps aux | grep node

# 重启所有服务
# 终端1
cd server && npm run dev

# 终端2
cd client && npm run dev

# 终端3
cd windows-login-manager && npm run dev

# 清除浏览器缓存
# Chrome: Ctrl+Shift+Delete
# 或在控制台执行：
localStorage.clear()
location.reload()
```

### 10. 获取帮助

如果以上步骤都无法解决问题，请收集以下信息：

1. **后端日志**（完整的启动日志和错误日志）
2. **前端控制台日志**（包括所有WebSocket相关日志）
3. **Network标签截图**（显示WebSocket连接状态）
4. **操作步骤**（详细描述你的操作）

然后查看：
- `dev-docs/ACCOUNT_AUTO_REFRESH_FEATURE.md` - 详细技术文档
- `dev-docs/TROUBLESHOOTING.md` - 故障排除指南

## 快速诊断命令

```bash
# 运行诊断脚本
./debug-websocket-connection.sh

# 查看实时日志
# 后端
cd server && npm run dev | grep -i websocket

# 前端（在浏览器控制台）
# 筛选 "WebSocket" 关键字
```

## 成功标准

✅ 所有验证清单项通过
✅ 前端和后端日志匹配
✅ Windows端登录后网页端自动刷新
✅ 无错误日志
✅ 用户体验流畅
