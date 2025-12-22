# WebSocket实时同步 - 快速启动指南

## 🚀 快速开始

### 1. 确保后端服务运行

```bash
cd server
npm install
npm run dev
```

后端应该显示：
```
✅ WebSocket服务器初始化成功
Server running on http://localhost:3000
```

### 2. 启动Windows客户端

```bash
cd windows-login-manager
npm install
npm run dev
```

### 3. 打开网页端

在浏览器中访问：`http://localhost:5173`

### 4. 验证WebSocket连接

#### 在Windows客户端控制台（F12）：
```javascript
// 检查WebSocket状态
await window.electronAPI.getWebSocketStatus()

// 应该返回：
{
  connected: true,
  authenticated: true,
  reconnectAttempts: 0
}
```

#### 在网页端控制台：
查看是否有以下日志：
```
WebSocket connected
WebSocket authenticated
```

## 🧪 快速测试

### 测试1：Windows → Web 同步

1. 在Windows客户端点击"平台登录"
2. 选择任意平台并完成登录
3. **立即**查看网页端 - 新账号应该自动出现！

### 测试2：Web → Windows 同步

1. 在网页端添加一个账号
2. **立即**查看Windows客户端 - 新账号应该自动出现！

### 测试3：删除同步

1. 在任一端删除账号
2. 另一端应该自动移除该账号

## ✅ 成功标志

如果看到以下内容，说明WebSocket工作正常：

### Windows端日志：
```
✅ Initializing WebSocket connection...
✅ WebSocket connected
✅ WebSocket authenticated
✅ Received account event: account.created
✅ Account created in cache: 123
```

### 网页端日志：
```
✅ WebSocket connected
✅ WebSocket authenticated  
✅ Received account event: account.created
```

### 后端日志：
```
✅ 新的WebSocket连接
✅ 用户 xxx 认证成功
✅ 广播账号事件: account.created
```

## ❌ 故障排查

### 问题：WebSocket未连接

**检查1：服务器URL配置**
```javascript
// Windows端
await window.electronAPI.getConfig()
// 应该返回：{ serverUrl: "http://localhost:3000", ... }
```

**检查2：访问令牌**
```javascript
// 确保已登录
// 如果没有token，先登录
```

**检查3：后端WebSocket服务**
```bash
# 检查后端日志，应该看到：
✅ WebSocket服务器初始化成功
```

### 问题：事件不同步

**手动重连：**
```javascript
// Windows端
await window.electronAPI.reconnectWebSocket()
```

**检查事件监听：**
```javascript
// 在AppContext中应该有：
useEffect(() => {
  const cleanup = window.electronAPI.onAccountEvent((event) => {
    console.log('Event received:', event);
  });
  return cleanup;
}, []);
```

## 📊 性能检查

### 测量同步延迟

1. 打开两个客户端的控制台
2. 在一端添加账号，记录时间戳
3. 在另一端看到账号出现，记录时间戳
4. 计算差值

**目标：< 100ms**

### 检查WebSocket连接质量

```javascript
// Windows端
setInterval(async () => {
  const status = await window.electronAPI.getWebSocketStatus();
  console.log('WebSocket Status:', status);
}, 5000);
```

应该始终显示：
```javascript
{
  connected: true,
  authenticated: true,
  reconnectAttempts: 0
}
```

## 🔧 高级调试

### 启用详细日志

在Windows端，打开 `electron/websocket/manager.ts`，所有日志已经启用。

### 监控WebSocket消息

在浏览器开发者工具的Network标签：
1. 筛选 `WS`（WebSocket）
2. 点击WebSocket连接
3. 查看Messages标签
4. 应该看到 `account.created`, `account.updated`, `account.deleted` 消息

### 检查本地缓存

```javascript
// Windows端
const accounts = await window.electronAPI.getAccounts();
console.log('Cached accounts:', accounts);
```

## 📝 配置示例

### 开发环境配置
```json
{
  "serverUrl": "http://localhost:3000",
  "autoSync": true,
  "logLevel": "debug",
  "theme": "system"
}
```

### 生产环境配置
```json
{
  "serverUrl": "https://your-server.com",
  "autoSync": true,
  "logLevel": "info",
  "theme": "system"
}
```

## 🎯 下一步

1. ✅ 验证基本同步功能
2. ✅ 测试网络断线重连
3. ✅ 测试配置更改
4. ✅ 性能测试
5. ✅ 部署到生产环境

## 💡 提示

- WebSocket连接是自动的，无需手动操作
- 如果连接失败，应用会降级到手动刷新模式
- 配置更改会自动触发WebSocket重连
- 所有WebSocket错误都会被记录到日志文件

## 📞 需要帮助？

查看详细文档：
- `WEBSOCKET_IMPLEMENTATION_SUMMARY.md` - 实现总结
- `WEBSOCKET_INTEGRATION_TEST.md` - 完整测试指南
- Windows端日志：`%APPDATA%/windows-login-manager/logs`
