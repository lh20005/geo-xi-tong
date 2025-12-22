# 网页端快速测试指南

## 🚀 当前状态

✅ 服务端运行中: http://localhost:3000
✅ 客户端运行中: http://localhost:5173
✅ 所有API测试通过
✅ WebSocket服务正常

## 📋 测试步骤

### 1. 打开浏览器测试登录

```
访问: http://localhost:5173
账号: admin
密码: admin123
```

**预期结果:**
- 自动跳转到登录页 `/login`
- 输入账号密码后成功登录
- 跳转到首页
- 顶部显示用户信息和头像

### 2. 检查WebSocket连接

1. 按 F12 打开开发者工具
2. 切换到 Console 标签
3. 查找以下日志:
   ```
   [WebSocket] 初始化WebSocket连接
   [WebSocket] 连接成功
   [WebSocket] 认证成功
   ```
4. 切换到 Network 标签
5. 筛选 WS (WebSocket)
6. 应该看到一个到 `ws://localhost:3000/ws` 的连接
7. 状态应该是 `101 Switching Protocols`

### 3. 测试实时同步

**方法1: 使用测试脚本**
1. 保持浏览器打开在平台管理页面
2. 在终端运行: `./test-login-and-sync.sh`
3. 观察网页端是否自动显示新账号被创建和删除

**方法2: 打开两个浏览器窗口**
1. 打开两个浏览器窗口
2. 都登录并进入平台管理页面
3. 在窗口A删除一个账号
4. 观察窗口B是否自动更新（无需刷新）

### 4. 测试退出登录

1. 点击顶部的用户头像
2. 选择"退出登录"
3. 应该跳转回登录页
4. 尝试访问其他页面，应该被重定向到登录页

## 🔍 检查要点

### Console日志应该显示:
- ✅ `[Auth] 登录成功`
- ✅ `[WebSocket] 初始化WebSocket连接`
- ✅ `[WebSocket] 连接成功`
- ✅ `[WebSocket] 认证成功`
- ✅ `[WebSocket] 收到账号删除事件` (删除时)

### Network标签应该显示:
- ✅ WebSocket连接到 `ws://localhost:3000/ws`
- ✅ 状态: 101 Switching Protocols
- ✅ 连接保持打开状态

### 服务端日志应该显示:
- ✅ `新的WebSocket连接`
- ✅ `用户 admin 认证成功`
- ✅ `客户端订阅频道: accounts`
- ✅ `[WebSocket] 广播账号事件: account.deleted`

## ✅ 成功标准

- [ ] 登录功能正常
- [ ] WebSocket连接成功
- [ ] WebSocket认证成功
- [ ] 删除账号时网页端实时更新
- [ ] 退出登录功能正常
- [ ] 没有Console错误

## 🎉 如果所有测试通过

恭喜！系统已经完全正常工作：
- ✅ 统一认证系统
- ✅ WebSocket实时同步
- ✅ Windows端和网页端同步

**问题已解决:** Windows端删除账号后，网页端可以实时同步更新，无需刷新页面！
