# 头条登录测试指南

## 当前状态

✅ Windows客户端已重新构建并运行
✅ 数据库配置已验证（包含 username、successUrls、loginSuccess）
✅ 代码已包含初始URL获取逻辑

## 测试步骤

### 1. 在Windows客户端点击"今日头条"卡片

### 2. 观察Electron终端日志

**期望看到的日志序列：**

```
[info] Starting login for platform: toutiao
[info] BrowserView created, waiting for user login...
[info] Initial login URL recorded: https://mp.toutiao.com/auth/page/login
[info] Starting login detection... Initial URL: https://mp.toutiao.com/auth/page/login
```

### 3. 完成登录操作

在弹出的浏览器窗口中：
- 扫码登录 或 账号密码登录
- 等待跳转到后台页面

### 4. 检查登录成功日志

**期望看到：**

```
[info] Login success detected by URL change: https://mp.toutiao.com/auth/page/login -> https://mp.toutiao.com/profile_v4/...
[info] Login detected, capturing data...
[info] Captured X cookies
[info] Storage data captured
[info] User info extracted: [用户名]
[info] Account saved locally
[info] Account synced to backend
[info] Login completed successfully
```

### 5. 如果看到错误

#### 错误A：Login detection timeout

```
[warn] Login detection timeout
[error] Login failed
```

**原因：** URL变化未被检测到

**检查：**
1. 初始URL是否正确记录？
2. 登录后URL是否真的变化了？
3. 是否有 "Login success detected" 日志？

#### 错误B：Failed to extract user information

```
[error] Login failed: Failed to extract user information
```

**原因：** 用户名选择器不匹配

**检查：**
1. 登录后的页面结构
2. 用户名元素的实际选择器

#### 错误C：Login failed (无具体信息)

```
[error] Login failed
```

**原因：** 可能是多种原因

**检查：**
1. 查看完整的错误堆栈
2. 检查是否有其他错误日志

## 调试命令

### 查看最近50行日志

```bash
# 在Kiro中执行
getProcessOutput(18, 50)
```

### 查看实时日志

观察运行 `npm run electron:dev` 的终端窗口

### 检查数据库配置

```bash
curl http://localhost:3000/api/platforms/toutiao | jq
```

## 如果仍然失败

请提供以下信息：

1. **完整的Electron日志**（从点击卡片到显示错误）
2. **具体的错误信息**
3. **登录前后的URL**
   - 初始URL是什么？
   - 登录后URL是什么？
4. **是否成功登录到头条后台**
   - 能看到后台页面吗？
   - 页面上有用户名显示吗？

## 常见问题

### Q: 为什么要等待2秒？

A: 确保页面加载到稳定的登录页面URL，避免获取到中间状态的URL。

### Q: 如果2秒不够怎么办？

A: 可以尝试增加到3秒：

```typescript
// login-manager.ts 第82行
await new Promise(resolve => setTimeout(resolve, 3000)); // 改为3秒
```

### Q: URL变化检测的原理是什么？

A: 
1. 记录初始登录页面URL（如 `https://mp.toutiao.com/auth/page/login`）
2. 用户登录后，URL会变化（如 `https://mp.toutiao.com/profile_v4/home`）
3. 检测到 `currentUrl !== initialUrl` 就认为登录成功

### Q: 为什么不等待页面加载完成？

A: 页面可能有资源加载错误（ERR_ABORTED），但不影响用户登录。我们只关心URL是否变化。
