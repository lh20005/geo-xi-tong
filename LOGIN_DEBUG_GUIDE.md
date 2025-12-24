# 登录跳转调试指南

## 🔍 问题诊断步骤

### 步骤 1: 检查服务是否正常运行

确认所有服务都在运行：
- ✅ Server API: http://localhost:3000
- ✅ Client 应用: http://localhost:5173
- ✅ Landing 网站: http://localhost:8080

### 步骤 2: 打开浏览器开发者工具

1. 访问 http://localhost:8080/login
2. 按 `F12` 或 `Cmd+Option+I` (Mac) 打开开发者工具
3. 切换到 **Console** 标签

### 步骤 3: 查看配置信息

页面加载时应该看到以下日志：

```
[Landing Config] 环境配置: {
  apiUrl: "http://localhost:3000/api",
  clientUrl: "http://localhost:5173",
  isDevelopment: true,
  isProduction: false,
  appName: "GEO优化SaaS系统",
  version: "1.0.0"
}

[Landing Login] 页面加载
[Landing Login] API URL: http://localhost:3000/api
[Landing Login] Client URL: http://localhost:5173
[Landing Login] 当前 localStorage: {...}
```

**如果看不到这些日志**：
- 刷新页面 (Cmd+R 或 F5)
- 检查 Console 是否有错误信息

### 步骤 4: 尝试登录

使用测试账号登录：
- 用户名: `admin`
- 密码: `admin123`

点击"登录"按钮后，应该看到以下日志：

```
[Landing Login] 开始登录，API URL: http://localhost:3000/api
[Landing Login] 登录响应: {success: true, data: {...}}
[Landing Login] Token已保存到localStorage
[Landing Login] 准备跳转到: http://localhost:5173
[Landing Login] 正在跳转到 Client 应用...
```

### 步骤 5: 检查跳转

**预期行为**：
1. 显示"登录成功！正在跳转..."提示（绿色）
2. 800ms 后自动跳转到 http://localhost:5173
3. Client 应用检测到 token，直接进入系统

**如果没有跳转**：
- 检查 Console 是否有错误
- 检查 Network 标签，看登录请求是否成功
- 手动访问 http://localhost:5173 看是否能进入系统

## 🐛 常见问题排查

### 问题 1: 登录请求失败

**症状**：显示"登录失败，请检查用户名和密码"

**检查**：
1. 打开 Network 标签
2. 查看 `/auth/login` 请求
3. 检查 Status Code 和 Response

**可能原因**：
- Server API 未启动
- 数据库连接失败
- 用户名或密码错误

**解决方案**：
```bash
# 检查 Server 是否运行
curl http://localhost:3000/api/health

# 查看 Server 日志
# 在 server 进程的终端查看输出
```

### 问题 2: 登录成功但不跳转

**症状**：显示"登录成功！正在跳转..."但没有跳转

**检查**：
1. Console 中查看 `[Landing Login] 准备跳转到:` 的 URL
2. 确认 URL 是 `http://localhost:5173`
3. 手动访问该 URL 看是否能打开

**可能原因**：
- Client 应用未启动
- 端口被占用
- 浏览器阻止了跳转

**解决方案**：
```bash
# 检查 Client 是否运行
curl http://localhost:5173

# 如果没有响应，重启 Client
cd client
npm run dev
```

### 问题 3: 跳转后又回到登录页

**症状**：跳转到 Client 后立即又跳回 Landing 登录页

**检查**：
1. 在 Client 应用的 Console 查看日志
2. 检查 localStorage 中是否有 `auth_token`

**可能原因**：
- Token 没有正确保存
- localStorage 被清除
- 跨域问题导致 localStorage 不共享

**解决方案**：
```javascript
// 在 Console 中手动检查
console.log('auth_token:', localStorage.getItem('auth_token'));
console.log('refresh_token:', localStorage.getItem('refresh_token'));
console.log('user_info:', localStorage.getItem('user_info'));
```

### 问题 4: localStorage 不共享

**症状**：在 Landing 保存的 token，在 Client 读取不到

**原因**：
- localhost:8080 和 localhost:5173 的 localStorage 是独立的
- 这是浏览器的安全机制

**这是正常的！** 我们的实现就是这样设计的：
1. Landing (8080) 登录后保存 token
2. 跳转到 Client (5173)
3. Client 会重新从 Landing 跳转过来，带着 token

**验证方法**：
```javascript
// 在 Landing (localhost:8080) 的 Console
console.log('Landing token:', localStorage.getItem('auth_token'));

// 在 Client (localhost:5173) 的 Console
console.log('Client token:', localStorage.getItem('auth_token'));

// 这两个应该是不同的！
```

## 🔧 手动测试流程

### 测试 1: 完整登录流程

1. **清除所有 localStorage**
   ```javascript
   // 在两个应用的 Console 都执行
   localStorage.clear();
   ```

2. **访问 Client 应用**
   - 打开 http://localhost:5173
   - 应该自动跳转到 http://localhost:8080/login

3. **登录**
   - 输入 admin / admin123
   - 点击登录
   - 应该显示成功提示
   - 应该自动跳转回 Client

4. **验证登录状态**
   - 应该能看到系统界面
   - 不应该再跳转到登录页

### 测试 2: 已登录状态

1. **确保已登录**
   - 完成测试 1

2. **刷新 Client 页面**
   - 按 F5 或 Cmd+R
   - 应该直接显示系统界面
   - 不应该跳转到登录页

3. **直接访问 Client 的 /login**
   - 访问 http://localhost:5173/login
   - 应该自动跳转到首页 (/)

### 测试 3: 退出登录

1. **在 Client 应用点击退出**
   - 点击右上角用户头像
   - 点击"退出登录"
   - 确认退出

2. **验证跳转**
   - 应该跳转到 http://localhost:8080 (Landing 首页)
   - 不是登录页，是首页！

3. **再次访问 Client**
   - 访问 http://localhost:5173
   - 应该跳转到登录页

## 📊 调试检查清单

- [ ] Server API 正在运行 (http://localhost:3000)
- [ ] Client 应用正在运行 (http://localhost:5173)
- [ ] Landing 网站正在运行 (http://localhost:8080)
- [ ] 浏览器 Console 没有错误
- [ ] 登录请求返回 200 状态码
- [ ] localStorage 中保存了 auth_token
- [ ] config.clientUrl 的值是 http://localhost:5173
- [ ] 跳转 URL 正确

## 🆘 如果还是不行

请提供以下信息：

1. **Console 日志**
   - 完整的 Console 输出（截图或复制）

2. **Network 请求**
   - 登录请求的详细信息
   - Status Code
   - Response Body

3. **localStorage 内容**
   ```javascript
   console.log(JSON.stringify(localStorage));
   ```

4. **具体症状**
   - 在哪一步卡住了？
   - 有什么错误提示？
   - 页面有什么反应？

## 💡 临时解决方案

如果跳转一直有问题，可以临时使用这个方法：

**在 Landing 登录成功后，手动复制 token 到 Client**：

1. 在 Landing 登录成功后，打开 Console
2. 复制 token：
   ```javascript
   console.log('Token:', localStorage.getItem('auth_token'));
   ```
3. 访问 Client (http://localhost:5173)
4. 在 Client 的 Console 粘贴 token：
   ```javascript
   localStorage.setItem('auth_token', '你复制的token');
   localStorage.setItem('refresh_token', '你复制的refresh_token');
   localStorage.setItem('user_info', '你复制的user_info');
   ```
5. 刷新页面

这样可以验证 token 本身是否有效。
