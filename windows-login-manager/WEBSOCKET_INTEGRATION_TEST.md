# WebSocket Integration Testing Guide

## 测试目标
验证Windows客户端和网页端之间的实时账号同步功能。

## 前置条件
1. 后端服务器正在运行
2. Windows客户端已配置正确的服务器URL
3. 网页端已部署并可访问
4. 两端都已登录（有有效的访问令牌）

## 测试场景

### 场景1：Windows端创建账号 → 网页端自动更新

**步骤：**
1. 打开Windows客户端
2. 打开网页端（浏览器）
3. 在Windows客户端点击"平台登录"
4. 选择一个平台并完成登录
5. 观察网页端的账号列表

**预期结果：**
- Windows端成功添加账号
- 网页端**无需刷新**，账号列表自动显示新账号
- 控制台显示WebSocket事件日志

### 场景2：网页端创建账号 → Windows端自动更新

**步骤：**
1. 保持Windows客户端和网页端都打开
2. 在网页端点击"添加账号"
3. 完成账号添加流程
4. 观察Windows客户端的账号列表

**预期结果：**
- 网页端成功添加账号
- Windows端**无需刷新**，账号列表自动显示新账号
- Windows端控制台显示WebSocket事件日志

### 场景3：删除账号同步

**步骤：**
1. 在Windows端删除一个账号
2. 观察网页端

**预期结果：**
- Windows端账号被删除
- 网页端账号列表自动移除该账号

### 场景4：网络断线重连

**步骤：**
1. 断开网络连接
2. 等待30秒
3. 重新连接网络
4. 在任一端添加账号

**预期结果：**
- WebSocket自动重连
- 账号同步恢复正常

### 场景5：配置更改后重连

**步骤：**
1. 在Windows端打开设置
2. 修改服务器URL（如果有测试服务器）
3. 保存配置
4. 观察WebSocket状态

**预期结果：**
- WebSocket断开旧连接
- WebSocket连接到新服务器
- 账号同步正常工作

## 调试检查点

### Windows端日志检查
打开Windows客户端的开发者工具（F12），查看控制台：

```
✅ 应该看到：
- "Initializing WebSocket connection..."
- "WebSocket connected"
- "WebSocket authenticated"
- "Received account event: account.created"
- "Setting up WebSocket account event listener..."

❌ 不应该看到：
- "Failed to initialize WebSocket"
- "WebSocket error"
- "Authentication failed"
```

### 网页端日志检查
打开浏览器开发者工具，查看控制台：

```
✅ 应该看到：
- "WebSocket connected"
- "WebSocket authenticated"
- "Received account event: account.created"

❌ 不应该看到：
- "WebSocket connection failed"
- "Authentication failed"
```

### 后端日志检查
查看后端服务器日志：

```
✅ 应该看到：
- "新的WebSocket连接"
- "用户 xxx 认证成功"
- "广播账号事件: account.created"
- "广播账号事件: account.updated"
- "广播账号事件: account.deleted"
```

## 常见问题排查

### 问题1：Windows端无法连接WebSocket

**检查：**
1. 服务器URL是否正确配置？
2. 是否有有效的访问令牌？
3. 后端WebSocket服务是否正在运行？
4. 防火墙是否阻止了WebSocket连接？

**解决：**
- 检查Windows端日志：`%APPDATA%/windows-login-manager/logs`
- 验证服务器URL格式：`http://localhost:3000` → `ws://localhost:3000/ws`
- 确认后端日志显示WebSocket服务已启动

### 问题2：事件不同步

**检查：**
1. WebSocket是否已连接？
2. WebSocket是否已认证？
3. 两端是否使用相同的API端点？

**解决：**
- 在Windows端运行：`window.electronAPI.getWebSocketStatus()`
- 检查返回的状态：`{ connected: true, authenticated: true }`
- 如果未连接，尝试：`window.electronAPI.reconnectWebSocket()`

### 问题3：重复的账号

**检查：**
- 是否同时收到了API响应和WebSocket事件？

**解决：**
- 这是正常的，代码已经处理了去重逻辑
- 检查AppContext中的事件处理代码

## 性能指标

### 同步延迟
- **目标：** < 100ms
- **测量方法：** 在一端创建账号，记录另一端显示的时间差

### WebSocket连接稳定性
- **目标：** 99.9% 在线时间
- **测量方法：** 长时间运行（24小时），检查断线次数

### 重连时间
- **目标：** < 5秒
- **测量方法：** 断开网络后重连，记录恢复时间

## 测试完成标准

✅ 所有5个测试场景通过
✅ 无控制台错误
✅ 同步延迟 < 100ms
✅ 网络断线后能自动重连
✅ 配置更改后能正确重连

## 下一步

如果所有测试通过，可以：
1. 部署到生产环境
2. 监控WebSocket连接质量
3. 收集用户反馈
4. 优化性能（如果需要）
