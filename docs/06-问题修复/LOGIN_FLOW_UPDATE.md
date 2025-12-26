# 登录流程更新说明

## 更新内容

根据新的应用逻辑，已完成以下修改：

### 1. 登录后停留在营销网站
- **修改文件**: `landing/src/pages/LoginPage.tsx`
- **变更**: 登录成功后不再跳转到前端系统（client），而是停留在营销网站并跳转到首页
- **行为**: 
  - 用户登录成功后，token 保存到 localStorage
  - 页面跳转到营销网站首页 (`/`)
  - 导航栏自动更新显示登录后的状态

### 2. 创建统一的导航栏组件
- **新建文件**: `landing/src/components/Header.tsx`
- **功能**:
  - 根据登录状态动态显示不同按钮
  - 未登录时：显示"立即登录"按钮
  - 已登录时：显示"个人中心"、"进入系统"、"退出"按钮
  - 管理员额外显示"用户管理"按钮
  - 支持跨标签页同步登录状态（通过 storage 事件）

### 3. 导航栏按钮说明

#### 未登录状态
```
首页 | 核心功能 | 产品优势 | 应用示例 | 价格方案 | [立即登录]
```

#### 普通用户登录后
```
首页 | 核心功能 | 产品优势 | 应用示例 | 价格方案 | 个人中心 | [进入系统] | 退出
```

#### 管理员登录后
```
首页 | 核心功能 | 产品优势 | 应用示例 | 价格方案 | 用户管理 | 个人中心 | [进入系统] | 退出
```

### 4. "进入系统"按钮功能
- 点击后跳转到前端系统（client）
- 自动携带 token、refresh_token 和 user_info 参数
- URL 格式: `http://localhost:5173?token=xxx&refresh_token=xxx&user_info=xxx`

### 5. 更新的页面列表
所有营销网站页面都已更新使用新的 Header 组件：
- ✅ `HomePage.tsx` - 首页
- ✅ `LoginPage.tsx` - 登录页
- ✅ `RegistrationPage.tsx` - 注册页
- ✅ `ProfilePage.tsx` - 个人中心
- ✅ `UserManagementPage.tsx` - 用户管理
- ✅ `CasesPage.tsx` - 应用示例
- ✅ `PrivacyPage.tsx` - 隐私政策
- ✅ `TermsPage.tsx` - 服务条款

## 用户体验流程

### 场景 1: 新用户注册登录
1. 访问营销网站首页
2. 点击"立即登录"按钮
3. 输入用户名密码登录
4. 登录成功后跳转到首页
5. 导航栏显示"个人中心"和"进入系统"按钮
6. 点击"进入系统"进入前端应用

### 场景 2: 已登录用户访问
1. 访问营销网站任意页面
2. 导航栏自动识别登录状态
3. 显示"个人中心"和"进入系统"按钮
4. 可以在营销网站浏览内容
5. 需要使用系统时点击"进入系统"

### 场景 3: 管理员用户
1. 登录后导航栏额外显示"用户管理"按钮
2. 可以直接从导航栏访问用户管理页面
3. 其他功能与普通用户相同

## 技术实现细节

### localStorage 存储
```javascript
// 登录时保存
localStorage.setItem('auth_token', token);
localStorage.setItem('refresh_token', refreshToken);
localStorage.setItem('user_info', JSON.stringify(user));

// Header 组件读取
const token = localStorage.getItem('auth_token');
const userInfo = localStorage.getItem('user_info');
```

### 跨标签页同步
```javascript
// 监听 storage 事件
window.addEventListener('storage', handleStorageChange);

// 当其他标签页登录/退出时，当前页面自动更新状态
```

### 跳转到前端系统
```javascript
const params = new URLSearchParams({
  token,
  refresh_token: refreshToken,
  user_info: userInfo
});
window.location.href = `${config.clientUrl}?${params.toString()}`;
```

## 测试建议

### 1. 登录流程测试
- [ ] 登录成功后停留在营销网站首页
- [ ] 导航栏正确显示"个人中心"和"进入系统"按钮
- [ ] 点击"进入系统"能正确跳转到前端应用

### 2. 导航栏状态测试
- [ ] 未登录时只显示"立即登录"
- [ ] 登录后显示"个人中心"、"进入系统"、"退出"
- [ ] 管理员额外显示"用户管理"

### 3. 跨页面测试
- [ ] 在首页登录后，访问其他页面导航栏状态正确
- [ ] 在个人中心页面，导航栏状态正确
- [ ] 在应用示例页面，导航栏状态正确

### 4. 退出登录测试
- [ ] 点击"退出"后清除登录信息
- [ ] 导航栏恢复到未登录状态
- [ ] 跳转到首页

### 5. 跨标签页测试
- [ ] 在标签页 A 登录，标签页 B 自动更新状态
- [ ] 在标签页 A 退出，标签页 B 自动更新状态

## 配置说明

### 环境变量
确保 `landing/.env` 文件配置正确：
```env
VITE_API_URL=http://localhost:3000/api
VITE_CLIENT_URL=http://localhost:5173
```

### 生产环境
生产环境需要在 `landing/src/config/env.ts` 中配置正确的域名：
```typescript
clientUrl: import.meta.env.VITE_CLIENT_URL || 
  (isProduction ? 'https://app.your-domain.com' : 'http://localhost:5173')
```

## 注意事项

1. **Token 传递**: 从营销网站跳转到前端系统时，通过 URL 参数传递 token，前端系统需要正确解析并保存
2. **安全性**: URL 参数传递 token 仅用于开发环境，生产环境建议使用更安全的方式（如 Cookie 或 Session）
3. **状态同步**: 使用 localStorage 和 storage 事件实现跨标签页状态同步
4. **用户体验**: 登录后停留在营销网站，让用户可以继续浏览内容，需要时再进入系统

## 后续优化建议

1. **移动端适配**: 当前导航栏主要针对桌面端，建议添加移动端响应式菜单
2. **Token 刷新**: 实现 token 自动刷新机制，避免用户频繁登录
3. **状态管理**: 考虑使用 Context API 或状态管理库统一管理登录状态
4. **安全增强**: 生产环境使用 HttpOnly Cookie 存储 token，提高安全性
