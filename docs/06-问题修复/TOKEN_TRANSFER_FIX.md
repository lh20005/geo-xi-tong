# Token 传递修复说明

## 🐛 问题原因

**localStorage 不共享**：
- `localhost:8080` (Landing) 和 `localhost:5173` (Client) 的 localStorage 是完全独立的
- 这是浏览器的安全机制，不同端口被视为不同的源（Origin）
- 在 Landing 保存的 token，Client 无法直接读取

## ✅ 解决方案

**通过 URL 参数传递 token**：

### 流程说明

```
1. 用户在 Landing 登录
   ↓
2. 登录成功，保存 token 到 Landing 的 localStorage
   ↓
3. 构造带 token 的 URL：
   http://localhost:5173?token=xxx&refresh_token=yyy&user_info=zzz
   ↓
4. 跳转到 Client
   ↓
5. Client 的 App 组件检测到 URL 参数
   ↓
6. 从 URL 参数读取 token
   ↓
7. 保存到 Client 的 localStorage
   ↓
8. 清除 URL 参数（安全考虑）
   ↓
9. 跳转到首页 (/)
   ↓
10. ProtectedRoute 检测到 token，进入系统 ✅
```

## 🔧 代码实现

### Landing 端（发送 token）

```typescript
// landing/src/pages/LoginPage.tsx
const handleSubmit = async (e: React.FormEvent) => {
  const response = await axios.post(`${config.apiUrl}/auth/login`, formData);
  
  if (response.data.success) {
    // 1. 保存到 Landing 的 localStorage（可选）
    localStorage.setItem('auth_token', response.data.data.token);
    localStorage.setItem('refresh_token', response.data.data.refreshToken);
    localStorage.setItem('user_info', JSON.stringify(response.data.data.user));
    
    // 2. 通过 URL 参数传递到 Client
    const params = new URLSearchParams({
      token: response.data.data.token,
      refresh_token: response.data.data.refreshToken,
      user_info: JSON.stringify(response.data.data.user)
    });
    
    // 3. 跳转到 Client，带上参数
    setTimeout(() => {
      window.location.href = `${config.clientUrl}?${params.toString()}`;
    }, 800);
  }
};
```

### Client 端（接收 token）

```typescript
// client/src/App.tsx
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

function App() {
  const location = useLocation();
  const navigate = useNavigate();

  // 处理从 Landing 跳转过来的 token
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const refreshToken = params.get('refresh_token');
    const userInfo = params.get('user_info');

    if (token && refreshToken && userInfo) {
      console.log('[Client] 从 URL 参数接收到 token');
      
      // 保存到 Client 的 localStorage
      localStorage.setItem('auth_token', token);
      localStorage.setItem('refresh_token', refreshToken);
      localStorage.setItem('user_info', userInfo);
      
      // 清除 URL 参数，跳转到首页
      navigate('/', { replace: true });
    }
  }, [location, navigate]);

  return (
    // ... 路由配置
  );
}
```

## 🧪 测试步骤

### 1. 清除所有 localStorage

在两个应用的 Console 都执行：
```javascript
localStorage.clear();
```

### 2. 访问 Client 应用

访问 http://localhost:5173
- 应该跳转到 http://localhost:8080/login

### 3. 登录

- 用户名: `admin`
- 密码: `admin123`
- 点击"登录"

### 4. 观察跳转

**预期行为**：
1. 显示"登录成功！正在跳转..."
2. 跳转到类似这样的 URL：
   ```
   http://localhost:5173?token=eyJhbGc...&refresh_token=eyJhbGc...&user_info=%7B%22username%22...
   ```
3. 立即清除 URL 参数，跳转到：
   ```
   http://localhost:5173/
   ```
4. 显示系统界面 ✅

### 5. 验证 localStorage

在 Client 的 Console 执行：
```javascript
console.log('auth_token:', localStorage.getItem('auth_token'));
console.log('refresh_token:', localStorage.getItem('refresh_token'));
console.log('user_info:', localStorage.getItem('user_info'));
```

应该能看到 token 数据。

## 🔒 安全考虑

### 为什么要清除 URL 参数？

1. **防止泄露**：URL 会被记录在浏览器历史中
2. **防止分享**：用户可能复制 URL 分享给他人
3. **防止刷新**：刷新页面时不应该重复处理 token

### 清除方法

```typescript
// 使用 replace: true，不会在历史记录中留下带 token 的 URL
navigate('/', { replace: true });
```

### 额外安全措施（可选）

1. **Token 加密**：在 URL 中传递加密后的 token
2. **一次性 code**：使用授权码模式（OAuth 2.0）
3. **短期有效**：URL 中的 token 设置短期有效期
4. **HTTPS**：生产环境必须使用 HTTPS

## 📝 调试日志

### Landing 端日志

```
[Landing Login] 开始登录，API URL: http://localhost:3000/api
[Landing Login] 登录响应: {success: true, data: {...}}
[Landing Login] Token已保存到localStorage
[Landing Login] 准备跳转到: http://localhost:5173
[Landing Login] 正在跳转到 Client 应用...
```

### Client 端日志

```
[Client] 从 URL 参数接收到 token，保存到 localStorage
[Auth] 已登录，跳转到首页
```

## 🎯 优势

1. ✅ **跨域兼容**：解决了不同端口 localStorage 不共享的问题
2. ✅ **简单可靠**：不需要额外的服务端支持
3. ✅ **用户体验好**：自动跳转，无需手动操作
4. ✅ **安全性**：URL 参数会被立即清除
5. ✅ **易于调试**：可以在 Network 标签看到完整流程

## 🚀 生产环境注意事项

### 使用相同域名

生产环境建议使用相同的主域名：
- Landing: `https://yourdomain.com`
- Client: `https://app.yourdomain.com`

这样可以使用 **Cookie** 或 **Session Storage** 共享登录状态，更安全。

### Cookie 方案（推荐）

```typescript
// Landing 登录成功后
document.cookie = `auth_token=${token}; domain=.yourdomain.com; path=/; secure; samesite=strict`;

// Client 读取 Cookie
const token = document.cookie
  .split('; ')
  .find(row => row.startsWith('auth_token='))
  ?.split('=')[1];
```

### 优势
- ✅ 自动共享（相同主域名）
- ✅ 更安全（HttpOnly, Secure, SameSite）
- ✅ 不会出现在 URL 中

## ✅ 总结

现在的实现：
1. ✅ 解决了 localStorage 不共享的问题
2. ✅ 登录后能正确跳转到 Client
3. ✅ Token 能正确传递和保存
4. ✅ URL 参数会被立即清除
5. ✅ 用户体验流畅

测试一下，应该可以正常工作了！🎉
