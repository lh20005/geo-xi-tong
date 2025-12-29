# 文章生成错误诊断

## 错误信息
```
POST http://localhost:5173/api/article-generation/tasks 500 (Internal Server Error)
```

## 问题原因
根据代码分析和测试，问题是**认证失败**：

1. **后端返回403 Forbidden** - 这表明请求没有有效的认证token
2. **前端显示500错误** - 这是因为Vite代理转发了后端的错误

## 诊断步骤

### 1. 检查是否已登录
打开浏览器控制台（F12），运行：
```javascript
// 检查 localStorage 中的 token
console.log('Auth Token:', localStorage.getItem('auth_token'));
console.log('Refresh Token:', localStorage.getItem('refresh_token'));

// 如果使用 Electron
if (window.electron) {
  window.electron.storage.getTokens().then(tokens => {
    console.log('Electron Tokens:', tokens);
  });
}
```

### 2. 检查token是否有效
如果有token，验证它是否有效：
```bash
# 替换 YOUR_TOKEN 为实际的token
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5000/api/auth/me
```

### 3. 检查API请求
打开浏览器控制台的Network标签，查看请求详情：
- 请求URL是否正确
- Authorization header是否存在
- 响应状态码和错误信息

## 解决方案

### 方案1：重新登录
1. 退出当前账号
2. 重新登录
3. 再次尝试生成文章

### 方案2：清除缓存并重新登录
```javascript
// 在浏览器控制台运行
localStorage.clear();
if (window.electron) {
  window.electron.storage.clearTokens();
}
// 然后刷新页面并重新登录
```

### 方案3：检查后端服务
```bash
# 检查后端是否正常运行
curl http://localhost:5000/health

# 检查认证端点
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your_username","password":"your_password"}'
```

## 预期行为

正常情况下，API请求应该：
1. 自动从storage获取token
2. 添加到Authorization header
3. 后端验证token并处理请求
4. 返回200状态码和任务数据

## 调试日志

从API客户端的日志可以看到：
```
[API Client] 🔄 处理请求: /article-generation/tasks
[API Client] 📦 尝试从 Electron storage 获取 token...
[API Client] ✅ 从 Electron storage 获取到 token
[API Client] ✅ 已添加 Authorization header
```

如果看不到这些日志，说明token获取失败。

## 下一步

1. 先检查是否已登录
2. 如果未登录，请先登录
3. 如果已登录但仍然失败，检查token是否过期
4. 如果token过期，系统应该自动刷新，如果刷新失败，需要重新登录
