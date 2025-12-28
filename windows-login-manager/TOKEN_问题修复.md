# Token 问题修复

## 问题现象
商品管理页面返回 401 错误，提示"请先登录"

## 问题分析

从错误日志可以看出：
1. 请求返回 401 Unauthorized
2. 错误信息：`Error: 请先登录`
3. `response: undefined` - 说明在响应拦截器中被处理了

这表明 token 没有被正确添加到请求头中。

## 可能的原因

### 1. Token 获取失败
`window.electron.storage.getTokens()` 返回 null 或 undefined

### 2. Token 字段名不匹配
存储的是 `accessToken` 但代码期望 `authToken`

### 3. 异步问题
Token 获取是异步的，但请求发送时 token 还没准备好

## 调试步骤

### 1. 在浏览器 Console 中检查 token

```javascript
// 检查 Electron storage
window.electron.storage.getTokens().then(tokens => {
  console.log('Tokens:', tokens);
  if (tokens) {
    console.log('authToken:', tokens.authToken ? '存在' : '不存在');
    console.log('refreshToken:', tokens.refreshToken ? '存在' : '不存在');
  }
});
```

### 2. 检查请求头

在 Network 标签中查看 `/api/admin/products` 请求：
- 查看 Request Headers
- 确认是否有 `Authorization: Bearer xxx`

### 3. 手动测试 API

```javascript
window.electron.storage.getTokens().then(tokens => {
  if (tokens?.authToken) {
    fetch('http://localhost:3000/api/admin/products', {
      headers: {
        'Authorization': `Bearer ${tokens.authToken}`,
        'Content-Type': 'application/json'
      }
    })
    .then(r => r.json())
    .then(data => console.log('Success:', data))
    .catch(err => console.error('Error:', err));
  } else {
    console.error('No token found!');
  }
});
```

## 临时解决方案

如果 Electron storage 有问题，可以临时使用 localStorage：

```javascript
// 1. 获取 token
window.electron.storage.getTokens().then(tokens => {
  if (tokens?.authToken) {
    // 2. 保存到 localStorage
    localStorage.setItem('auth_token', tokens.authToken);
    localStorage.setItem('refresh_token', tokens.refreshToken);
    console.log('Token saved to localStorage');
    
    // 3. 刷新页面
    location.reload();
  }
});
```

然后修改 API 客户端优先使用 localStorage。

## 永久修复

需要确保：
1. Token 正确保存到 Electron storage
2. Token 字段名一致（都使用 `authToken`）
3. 请求拦截器正确获取和添加 token

## 验证修复

修复后，在 Console 中应该看到：

```
[API Client] 开始处理请求: /admin/products
[API Client] 检测到 Electron 环境
[API Client] 获取到的 tokens: { authToken: '...', refreshToken: '...' }
[API Client] ✅ 已添加 Authorization header
[API Client] 最终请求配置: { url: '/admin/products', method: 'get', hasAuth: true }
[ProductManagement] API 响应: { success: true, data: [...] }
```

---

**创建时间**: 2025-12-28  
**状态**: 待修复
