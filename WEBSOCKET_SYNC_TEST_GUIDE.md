# WebSocket 实时同步测试指南

## 🎯 测试目标

验证用户管理系统的实时同步功能在所有三个平台（营销网站、客户端应用、Windows 应用）上正常工作。

## 📋 前置条件

### 1. 启动所有服务

#### 后端服务器
```bash
cd server
npm run dev
```
服务器运行在 `http://localhost:3000`
WebSocket 运行在 `ws://localhost:3000/ws`

#### 营销网站
```bash
cd landing
npm run dev
```
运行在 `http://localhost:5174`

#### 客户端应用
```bash
cd client
npm run dev
```
运行在 `http://localhost:5173`

#### Windows 应用（可选）
```bash
cd windows-login-manager
pnpm dev
```

### 2. 准备测试账号

需要至少两个账号：
- **管理员账号**: 用于管理用户
- **普通用户账号**: 用于测试实时同步

创建管理员账号（在数据库中执行）：
```sql
UPDATE users SET role = 'admin' WHERE username = 'your_username';
```

## 🧪 测试场景

### 测试 1: 用户信息更新同步

**目标**: 验证用户信息更新时，所有平台实时同步

**步骤**:
1. **营销网站**: 以管理员身份登录
2. **客户端应用**: 以普通用户（testuser）身份登录
3. **Windows 应用**: 以同一用户（testuser）身份登录（可选）
4. **营销网站**: 
   - 访问用户管理页面
   - 找到 testuser
   - 点击"查看详情"
   - 点击"编辑信息"
   - 修改用户名为 "testuser_updated"
   - 保存

**预期结果**:
- ✅ 营销网站: 用户列表自动刷新，显示新用户名
- ✅ 客户端应用: 
  - 控制台显示 `[UserWebSocket] User updated`
  - 显示消息 "您的账户信息已更新"
  - 页面自动刷新
  - 用户名更新为 "testuser_updated"
- ✅ Windows 应用:
  - 日志显示 `[UserWebSocketManager] User updated`
  - 本地存储更新
  - 渲染进程收到 IPC 消息

**验证方法**:
- 打开浏览器开发者工具 → Console
- 查看 WebSocket 消息
- 检查 localStorage 中的 user_info

---

### 测试 2: 用户删除同步

**目标**: 验证用户被删除时，该用户在所有平台自动登出

**步骤**:
1. **营销网站**: 以管理员身份登录
2. **客户端应用**: 以普通用户（testuser2）身份登录
3. **Windows 应用**: 以同一用户（testuser2）身份登录（可选）
4. **营销网站**:
   - 访问用户管理页面
   - 找到 testuser2
   - 点击"查看详情"
   - 点击"删除用户"
   - 确认删除

**预期结果**:
- ✅ 营销网站: 用户列表自动刷新，testuser2 消失
- ✅ 客户端应用:
  - 控制台显示 `[UserWebSocket] User deleted`
  - 显示错误消息 "您的账户已被删除，即将退出登录"
  - localStorage 被清除
  - 2秒后自动跳转到登录页
- ✅ Windows 应用:
  - 日志显示 `[UserWebSocketManager] Current user deleted, logging out...`
  - 本地存储被清除
  - 渲染进程收到 IPC 消息
  - 2秒后应用自动关闭

**验证方法**:
- 观察客户端应用的自动跳转
- 检查 localStorage 是否被清除
- 观察 Windows 应用是否自动关闭

---

### 测试 3: 密码重置同步

**目标**: 验证密码被重置时，用户在所有平台被强制重新登录

**步骤**:
1. **营销网站**: 以管理员身份登录
2. **客户端应用**: 以普通用户（testuser3）身份登录
3. **Windows 应用**: 以同一用户（testuser3）身份登录（可选）
4. **营销网站**:
   - 访问用户管理页面
   - 找到 testuser3
   - 点击"查看详情"
   - 点击"重置密码"
   - 确认重置
   - 记录临时密码

**预期结果**:
- ✅ 营销网站: 显示临时密码
- ✅ 客户端应用:
  - 控制台显示 `[UserWebSocket] Password changed`
  - 显示警告消息 "您的密码已被修改，请重新登录"
  - localStorage 被清除
  - 2秒后自动跳转到登录页
- ✅ Windows 应用:
  - 日志显示 `[UserWebSocketManager] Current user password changed, logging out...`
  - 本地存储被清除
  - 渲染进程收到 IPC 消息
  - WebSocket 断开连接

**验证方法**:
- 使用临时密码重新登录
- 验证强制修改密码流程
- 检查 localStorage 是否被清除

---

### 测试 4: 用户自己修改密码

**目标**: 验证用户自己修改密码时的同步行为

**步骤**:
1. **营销网站**: 以普通用户（testuser4）身份登录
2. **客户端应用**: 以同一用户（testuser4）身份登录
3. **Windows 应用**: 以同一用户（testuser4）身份登录（可选）
4. **营销网站**:
   - 访问个人资料页面
   - 点击"修改密码"
   - 输入当前密码和新密码
   - 确认修改

**预期结果**:
- ✅ 营销网站: 
  - 显示成功消息
  - 当前会话保持登录
- ✅ 客户端应用:
  - 控制台显示 `[UserWebSocket] Password changed`
  - 显示警告消息 "您的密码已被修改，请重新登录"
  - localStorage 被清除
  - 2秒后自动跳转到登录页
- ✅ Windows 应用:
  - 日志显示 `[UserWebSocketManager] Current user password changed, logging out...`
  - 本地存储被清除
  - WebSocket 断开连接

**验证方法**:
- 使用新密码重新登录客户端应用
- 验证营销网站当前会话仍然有效

---

### 测试 5: WebSocket 重连机制

**目标**: 验证 WebSocket 断开后的自动重连功能

**步骤**:
1. 启动所有服务并登录
2. 打开浏览器开发者工具 → Network → WS
3. 观察 WebSocket 连接状态
4. **停止后端服务器**:
   ```bash
   # 在 server 目录按 Ctrl+C
   ```
5. 观察客户端的重连尝试
6. **重新启动后端服务器**:
   ```bash
   cd server
   npm run dev
   ```
7. 观察客户端是否自动重连

**预期结果**:
- ✅ 服务器停止后:
  - 控制台显示 `[UserWebSocket] Connection closed`
  - 开始重连尝试（指数退避）
  - 显示重连日志: `Scheduling reconnect attempt 1/5 in 1000ms`
- ✅ 服务器重启后:
  - 客户端自动重连成功
  - 控制台显示 `[UserWebSocket] Connected successfully`
  - WebSocket 连接恢复正常

**验证方法**:
- 观察控制台日志
- 检查 Network → WS 标签
- 验证重连后功能正常

---

### 测试 6: 心跳保持连接

**目标**: 验证心跳机制保持 WebSocket 连接活跃

**步骤**:
1. 启动所有服务并登录
2. 打开浏览器开发者工具 → Network → WS
3. 点击 WebSocket 连接查看消息
4. 等待至少 30 秒

**预期结果**:
- ✅ 每 30 秒发送一次 ping 消息:
  ```json
  {"type":"ping","data":{"timestamp":1234567890}}
  ```
- ✅ 服务器响应 pong 消息:
  ```json
  {"type":"pong","data":{"timestamp":1234567890}}
  ```
- ✅ 连接保持活跃，不会超时断开

**验证方法**:
- 在 Network → WS 标签中查看消息
- 验证 ping/pong 消息的时间间隔

---

### 测试 7: 多窗口同步

**目标**: 验证同一用户在多个浏览器窗口的同步

**步骤**:
1. 打开两个浏览器窗口
2. 在两个窗口都以同一用户登录客户端应用
3. 在营销网站以管理员身份登录
4. 修改该用户的信息

**预期结果**:
- ✅ 两个客户端窗口都收到更新事件
- ✅ 两个窗口都显示通知
- ✅ 两个窗口都自动刷新

**验证方法**:
- 观察两个窗口的行为是否一致
- 检查两个窗口的控制台日志

---

## 🔍 调试技巧

### 查看 WebSocket 连接状态

**浏览器**:
1. 打开开发者工具 (F12)
2. 切换到 Network 标签
3. 点击 WS 过滤器
4. 查看 WebSocket 连接和消息

**控制台日志**:
```javascript
// 客户端应用
[UserWebSocket] Connecting to: ws://localhost:3000/ws?token=...
[UserWebSocket] Connected successfully
[UserWebSocket] Received message: connected
[UserWebSocket] Subscribed to event: user:updated
```

**Windows 应用**:
```
[UserWebSocketManager] Initializing...
[UserWebSocket] Connecting to: ws://localhost:3000/ws?token=...
[UserWebSocket] Connected
[UserWebSocketManager] Authenticated
```

### 查看 localStorage

**浏览器控制台**:
```javascript
// 查看用户信息
console.log(JSON.parse(localStorage.getItem('user_info')));

// 查看 token
console.log(localStorage.getItem('auth_token'));
```

### 查看后端日志

**服务器控制台**:
```
[WebSocket] New connection attempt
[WebSocket] User testuser (ID: 123) authenticated
[WebSocket] Broadcasted user:updated to user 123 (1/1 connections)
```

### 常见问题排查

#### 问题 1: WebSocket 无法连接

**症状**: 控制台显示连接错误

**排查**:
1. 检查后端服务器是否运行
2. 检查 WebSocket URL 是否正确
3. 检查 token 是否有效
4. 查看后端日志

**解决**:
```bash
# 重启后端服务器
cd server
npm run dev
```

#### 问题 2: 事件未触发

**症状**: 修改用户信息后，客户端没有反应

**排查**:
1. 检查 WebSocket 是否连接
2. 检查是否订阅了事件
3. 查看控制台日志
4. 检查用户 ID 是否匹配

**解决**:
```javascript
// 在浏览器控制台手动测试
const ws = getUserWebSocketService();
console.log('Connected:', ws.isConnected());
```

#### 问题 3: 重连失败

**症状**: 服务器重启后，客户端无法重连

**排查**:
1. 检查重连次数是否超过限制（5次）
2. 检查 token 是否过期
3. 查看重连日志

**解决**:
```javascript
// 刷新页面重新连接
window.location.reload();
```

## ✅ 测试检查清单

### 基础功能
- [ ] WebSocket 连接成功
- [ ] JWT 认证成功
- [ ] 心跳机制正常
- [ ] 自动重连正常

### 用户更新同步
- [ ] 营销网站实时刷新
- [ ] 客户端应用收到通知
- [ ] Windows 应用更新本地存储
- [ ] 多窗口同步正常

### 用户删除同步
- [ ] 营销网站实时刷新
- [ ] 客户端应用自动登出
- [ ] Windows 应用自动关闭
- [ ] localStorage 被清除

### 密码修改同步
- [ ] 营销网站显示成功
- [ ] 客户端应用强制重新登录
- [ ] Windows 应用清除令牌
- [ ] 临时密码流程正常

### 错误处理
- [ ] 连接失败自动重试
- [ ] 重连次数限制生效
- [ ] 错误日志记录完整
- [ ] 降级模式正常工作

## 🎉 测试完成

如果所有测试都通过，恭喜！WebSocket 实时同步功能已经完全可用。

如果遇到问题，请查看：
- 浏览器控制台日志
- 后端服务器日志
- Windows 应用日志（electron-log）
- Network → WS 标签

需要帮助？查看以下文档：
- [完整实现总结](USER_MANAGEMENT_COMPLETE.md)
- [WebSocket 实现详情](WEBSOCKET_IMPLEMENTATION_COMPLETE.md)
- [快速测试指南](QUICK_TEST_USER_MANAGEMENT.md)
