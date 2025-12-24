# 统一登录流程说明

## 🎯 设计理念

**单一登录入口**：所有用户统一在 Landing 网站登录，Client 应用不再提供独立的登录表单。

## 🔑 Token 传递机制

由于 `localhost:8080` 和 `localhost:5173` 的 localStorage 是独立的（浏览器安全机制），我们通过 **URL 参数** 传递 token：

1. Landing 登录成功后，将 token 作为 URL 参数传递
2. Client 接收 URL 参数，保存到自己的 localStorage
3. 清除 URL 参数，跳转到首页

**示例 URL**：
```
http://localhost:5173?token=xxx&refresh_token=yyy&user_info=zzz
```

## 📊 完整流程图

```
用户访问 Client 应用
    ↓
检查是否已登录？
    ↓
已登录 → 直接进入系统
    ↓
未登录 → 重定向到 Landing 登录页
    ↓
在 Landing 输入账号密码
    ↓
登录成功 → 保存 token
    ↓
自动跳转到 Client 应用
    ↓
Client 检测到 token → 进入系统
```

## 🔐 登录流程详解

### 场景 1: 用户直接访问 Client 应用

1. 用户访问 `http://localhost:5173`
2. `ProtectedRoute` 检查 `localStorage` 中的 `auth_token`
3. **如果有 token**：直接进入系统
4. **如果没有 token**：跳转到 `/login`
5. Client 的 `/login` 页面检测到未登录
6. 自动重定向到 `http://localhost:8080/login` (Landing 登录页)
7. 用户在 Landing 登录
8. 登录成功后保存 token 到 Landing 的 localStorage
9. 通过 URL 参数跳转到 Client：`http://localhost:5173?token=xxx&refresh_token=yyy&user_info=zzz`
10. Client 从 URL 参数读取 token，保存到 Client 的 localStorage
11. Client 清除 URL 参数，跳转到首页
12. Client 检测到 token，进入系统 ✅

### 场景 2: 用户从 Landing 首页点击登录

1. 用户访问 `http://localhost:8080`
2. 点击"立即登录"按钮
3. 进入 `http://localhost:8080/login`
4. 输入账号密码登录
5. 登录成功后保存 token
6. 自动跳转到 `http://localhost:5173`
7. Client 检测到 token，进入系统 ✅

### 场景 3: 用户在 Client 应用退出登录

1. 用户在 Client 应用点击"退出登录"
2. 弹出确认对话框
3. 确认后清除所有 token
4. 显示"已退出登录"提示
5. 跳转到 `http://localhost:8080` (Landing 首页)
6. 用户可以重新登录或浏览产品信息

### 场景 4: 用户已登录，访问 Client 的 /login

1. 用户已登录，但访问 `http://localhost:5173/login`
2. Client 的 `/login` 页面检测到已有 token
3. 自动跳转到 `/` (首页)
4. 不会重定向到 Landing ✅

## 🔑 Token 管理

### localStorage Keys
```javascript
{
  "auth_token": "访问令牌",
  "refresh_token": "刷新令牌",
  "user_info": "{\"username\":\"admin\",\"role\":\"admin\"}"
}
```

### Token 生命周期
1. **登录时**：Landing 保存 token 到 localStorage
2. **使用时**：Client 从 localStorage 读取 token
3. **退出时**：Client 清除 localStorage 中的所有 token
4. **过期时**：使用 refresh_token 自动刷新（如果实现了）

## 🎨 用户体验优化

### Landing 登录页面
- ✅ 错误提示带图标和颜色
- ✅ 成功提示带图标和动画
- ✅ 登录按钮加载状态（旋转动画）
- ✅ 按钮交互效果（hover、active）
- ✅ 返回首页链接

### Client 登录页面（重定向页）
- ✅ 显示加载动画
- ✅ 提示"正在跳转到登录页..."
- ✅ 自动检测登录状态
- ✅ 已登录用户直接进入系统

### 退出流程
- ✅ 确认对话框（防止误操作）
- ✅ 成功提示消息
- ✅ 延迟跳转（让用户看到反馈）

## 🔧 技术实现

### Client 应用

#### ProtectedRoute 组件
```typescript
// client/src/components/ProtectedRoute.tsx
export function ProtectedRoute({ children }) {
  const token = localStorage.getItem('auth_token');
  
  if (!token) {
    // 未登录，跳转到 /login
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}
```

#### LoginPage 组件（重定向页）
```typescript
// client/src/pages/LoginPage.tsx
export default function LoginPage() {
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    
    if (token) {
      // 已登录，跳转到首页
      navigate('/', { replace: true });
    } else {
      // 未登录，重定向到 Landing 登录页
      window.location.href = `${config.landingUrl}/login`;
    }
  }, []);
  
  // 显示加载状态...
}
```

### Landing 应用

#### LoginPage 组件
```typescript
// landing/src/pages/LoginPage.tsx
const handleSubmit = async (e) => {
  const response = await axios.post(`${config.apiUrl}/auth/login`, formData);
  
  if (response.data.success) {
    // 保存 token
    localStorage.setItem('auth_token', response.data.data.token);
    localStorage.setItem('refresh_token', response.data.data.refreshToken);
    localStorage.setItem('user_info', JSON.stringify(response.data.data.user));
    
    // 跳转到 Client 应用
    setTimeout(() => {
      window.location.href = config.clientUrl;
    }, 800);
  }
};
```

## 🚀 访问地址

### 开发环境
- **Landing 网站**: http://localhost:8080
- **Landing 登录**: http://localhost:8080/login
- **Client 应用**: http://localhost:5173
- **Client 登录**: http://localhost:5173/login (自动重定向)
- **Server API**: http://localhost:3000

### 生产环境
- **Landing 网站**: https://your-domain.com
- **Landing 登录**: https://your-domain.com/login
- **Client 应用**: https://app.your-domain.com
- **Client 登录**: https://app.your-domain.com/login (自动重定向)
- **Server API**: https://your-domain.com/api

## ✅ 优势总结

1. **单一登录入口** - 用户体验统一，不会混淆
2. **自动跳转** - 无需手动输入 URL
3. **状态保持** - 登录状态在两个应用间共享
4. **安全性** - Token 统一管理，易于控制
5. **可维护性** - 登录逻辑集中在 Landing，易于修改
6. **用户友好** - 所有跳转都有视觉反馈

## 🧪 测试清单

- [ ] 未登录访问 Client 应用 → 自动跳转到 Landing 登录页
- [ ] 在 Landing 登录成功 → 自动跳转到 Client 应用
- [ ] 已登录访问 Client 应用 → 直接进入系统
- [ ] 已登录访问 Client 的 /login → 自动跳转到首页
- [ ] 在 Client 退出登录 → 跳转到 Landing 首页
- [ ] 退出后再次登录 → 流程正常
- [ ] 登录失败 → 显示错误提示
- [ ] 网络错误 → 显示友好提示

## 📝 注意事项

1. **跨域问题**：开发环境使用 localhost，生产环境需要配置 CORS
2. **Token 过期**：建议实现 token 自动刷新机制
3. **安全性**：生产环境必须使用 HTTPS
4. **Session 共享**：两个应用通过 localStorage 共享登录状态
5. **浏览器兼容性**：localStorage 在所有现代浏览器中都支持
