# Landing 页面登录按钮更新说明

## 更新内容

已成功实现：当用户已登录时，landing 页面的"免费开始"等按钮自动变为"进入GEO系统"，点击后直接进入系统。当用户退出登录后，按钮会立即恢复为原来的文字和链接。

## 修改的文件

### 1. `landing/src/pages/HomePage.tsx`
- 添加了 `isLoggedIn` 状态来检测用户登录状态
- 添加了 `handleEnterSystem` 函数来处理进入系统的逻辑
- 监听 `auth-change` 自定义事件来实时同步登录状态
- 更新了以下按钮：
  - Hero Section 的主要 CTA 按钮
  - 价格方案部分的三个按钮（体验版、专业版、企业版）
  - 底部 CTA Section 的按钮

### 2. `landing/src/pages/CasesPage.tsx`
- 添加了 `isLoggedIn` 状态来检测用户登录状态
- 添加了 `handleEnterSystem` 函数来处理进入系统的逻辑
- 监听 `auth-change` 自定义事件来实时同步登录状态
- 更新了底部 CTA Section 的按钮

### 3. `landing/src/components/Header.tsx`
- 更新了 `handleLogout` 函数，在退出登录时触发 `auth-change` 事件
- 更新了登录状态检测逻辑，同时监听 `storage` 和 `auth-change` 事件

### 4. `landing/src/pages/LoginPage.tsx`
- 在登录成功后触发 `auth-change` 事件，通知其他组件更新状态

### 5. `landing/src/pages/RegistrationPage.tsx`
- 在注册成功后触发 `auth-change` 事件，通知其他组件更新状态

## 功能说明

### 登录状态检测
- 通过检查 `localStorage` 中的 `auth_token` 和 `user_info` 来判断用户是否已登录
- 监听两种事件来同步状态：
  - `storage` 事件：跨标签页同步（浏览器原生事件）
  - `auth-change` 事件：同标签页内同步（自定义事件）

### 按钮行为

#### 未登录状态
- 显示文本：
  - "免费开始"（Hero Section）
  - "免费试用"（体验版）
  - "点击购买"（专业版、企业版）
  - "立即免费开始"（底部 CTA）
- 点击后：跳转到 `/login` 登录页面

#### 已登录状态
- 显示文本：
  - "进入GEO系统"（所有位置统一）
- 点击后：
  1. 从 localStorage 获取 token、refresh_token 和 user_info
  2. 构造 URL 参数
  3. 跳转到 client 应用（通过 `config.clientUrl`）
  4. 自动完成登录状态传递

## 技术实现

### 自定义事件机制
为了解决同一标签页内 localStorage 修改不触发 `storage` 事件的问题，使用了自定义事件：

```typescript
// 触发事件（在登录、注册、退出时）
window.dispatchEvent(new Event('auth-change'));

// 监听事件（在需要同步状态的组件中）
window.addEventListener('auth-change', checkLoginStatus);
```

### 状态管理
```typescript
const [isLoggedIn, setIsLoggedIn] = useState(false);

useEffect(() => {
  const checkLoginStatus = () => {
    const token = localStorage.getItem('auth_token');
    const userInfo = localStorage.getItem('user_info');
    setIsLoggedIn(!!(token && userInfo));
  };
  
  checkLoginStatus();
  
  // 监听两种事件
  window.addEventListener('storage', checkLoginStatus);      // 跨标签页
  window.addEventListener('auth-change', checkLoginStatus);  // 同标签页
  
  return () => {
    window.removeEventListener('storage', checkLoginStatus);
    window.removeEventListener('auth-change', checkLoginStatus);
  };
}, []);
```

### 进入系统逻辑
```typescript
const handleEnterSystem = () => {
  if (isLoggedIn) {
    const token = localStorage.getItem('auth_token');
    const refreshToken = localStorage.getItem('refresh_token');
    const userInfo = localStorage.getItem('user_info');
    
    if (token && refreshToken && userInfo) {
      const params = new URLSearchParams({
        token,
        refresh_token: refreshToken,
        user_info: userInfo
      });
      window.location.href = `${config.clientUrl}?${params.toString()}`;
    }
  }
};
```

### 按钮渲染
```typescript
{isLoggedIn ? (
  <button
    onClick={handleEnterSystem}
    className="..."
  >
    进入GEO系统
    <svg>...</svg>
  </button>
) : (
  <Link
    to="/login"
    className="..."
  >
    免费开始
    <svg>...</svg>
  </Link>
)}
```

## 测试步骤

### 1. 测试未登录状态
1. 清除浏览器 localStorage
2. 访问 landing 页面（http://localhost:5174）
3. 验证所有按钮显示为"免费开始"/"免费试用"/"点击购买"
4. 点击任意按钮，应跳转到登录页面

### 2. 测试登录后状态变化
1. 在 landing 页面登录
2. 登录成功后返回首页
3. **验证所有按钮立即显示为"进入GEO系统"**
4. 点击任意按钮，应直接进入 client 系统

### 3. 测试退出后状态恢复
1. 在已登录状态下，点击用户菜单中的"退出登录"
2. 确认退出
3. **验证所有按钮立即恢复为"免费开始"/"免费试用"/"点击购买"**
4. 点击按钮，应跳转到登录页面

### 4. 测试跨标签页同步
1. 打开两个 landing 页面标签
2. 在第一个标签登录
3. 切换到第二个标签，验证按钮自动更新为"进入GEO系统"
4. 在第一个标签退出登录
5. 切换到第二个标签，验证按钮自动恢复为"免费开始"

### 5. 测试注册后状态
1. 在未登录状态下注册新账号
2. 注册成功后跳转到首页
3. 验证所有按钮显示为"进入GEO系统"

## 用户体验优化

1. **无缝体验**：已登录用户无需再次登录，直接进入系统
2. **实时同步**：登录/退出后按钮立即更新，无需刷新页面
3. **跨标签同步**：多个标签页之间登录状态自动同步
4. **统一文案**：所有"进入系统"按钮使用统一文案，避免混淆
5. **视觉一致**：保持原有的按钮样式和动画效果

## 技术亮点

### 解决的核心问题
浏览器的 `storage` 事件只在**不同标签页**之间触发，同一标签页内修改 localStorage 不会触发该事件。这导致用户在同一标签页内退出登录后，按钮状态不会更新。

### 解决方案
引入自定义事件 `auth-change`，在所有修改登录状态的地方（登录、注册、退出）触发该事件，所有需要同步状态的组件监听该事件并更新状态。

### 事件流程
```
用户操作 → 修改 localStorage → 触发 auth-change 事件 → 组件监听到事件 → 重新检查登录状态 → 更新 UI
```

## 注意事项

1. 确保 `landing/src/config/env.ts` 中的 `clientUrl` 配置正确
2. client 应用需要能够接收 URL 参数中的 token 并自动登录
3. 登录状态依赖 localStorage，清除浏览器数据会导致需要重新登录
4. 自定义事件 `auth-change` 是全局事件，确保在组件卸载时正确清理监听器

## 相关文件

- `landing/src/pages/HomePage.tsx` - 首页
- `landing/src/pages/CasesPage.tsx` - 案例页面
- `landing/src/components/Header.tsx` - 导航栏
- `landing/src/pages/LoginPage.tsx` - 登录页面
- `landing/src/pages/RegistrationPage.tsx` - 注册页面
- `landing/src/config/env.ts` - 环境配置

## 完成状态

✅ 首页 Hero Section CTA 按钮
✅ 首页价格方案按钮（3个）
✅ 首页底部 CTA 按钮
✅ 案例页面底部 CTA 按钮
✅ 登录状态检测
✅ 同标签页状态同步（自定义事件）
✅ 跨标签页状态同步（storage 事件）
✅ 登录后按钮更新
✅ 退出后按钮恢复
✅ 注册后按钮更新
✅ 进入系统逻辑
✅ 代码诊断通过
