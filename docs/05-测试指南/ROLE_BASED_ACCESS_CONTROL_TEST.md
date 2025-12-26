# 基于角色的权限控制测试指南

## 功能概述

实现了基于用户角色的权限控制系统：
- **系统管理员（admin）**：可以访问所有功能
- **普通用户（user）**：不能访问"系统设置"和"设置"模块

## 实现的功能

### 1. 网页端（client）

#### 权限控制
- ✅ 创建了 `client/src/utils/auth.ts` 权限工具函数
  - `getCurrentUser()`: 获取当前用户信息
  - `isAdmin()`: 检查是否是管理员
  - `hasPermission()`: 检查特定权限

- ✅ 创建了 `client/src/components/AdminRoute.tsx` 管理员路由保护组件
  - 非管理员访问时显示警告并重定向到首页

- ✅ 修改了 `client/src/components/Layout/Sidebar.tsx`
  - "系统配置"菜单项仅对管理员可见
  - 使用条件渲染：`...(userIsAdmin ? [{...}] : [])`

- ✅ 修改了 `client/src/App.tsx`
  - `/config` 路由使用 `<AdminRoute>` 保护
  - 非管理员无法通过URL直接访问

### 2. Windows端（windows-login-manager）

#### 权限控制
- ✅ 创建了 `windows-login-manager/src/utils/auth.ts` 权限工具函数
  - `isAdmin(user)`: 检查用户是否是管理员
  - `hasPermission(user, permission)`: 检查特定权限

- ✅ 修改了 `windows-login-manager/src/components/Layout.tsx`
  - "设置"菜单项仅对管理员可见
  - 使用条件渲染：`{userIsAdmin && <li>...</li>}`

- ✅ 修改了 `windows-login-manager/src/App.tsx`
  - 创建了 `AdminRoute` 组件保护设置页面
  - `/settings` 路由使用 `<AdminRoute>` 保护
  - 修改了认证流程，保存和传递用户信息

- ✅ 修改了 `windows-login-manager/src/context/AppContext.tsx`
  - 添加了 `user` 状态和 `setUser` 方法
  - 在整个应用中共享用户信息

- ✅ 修改了 `windows-login-manager/src/pages/Login.tsx`
  - 登录成功后传递用户信息给父组件

#### 后端支持
- ✅ 修改了 `windows-login-manager/electron/storage/manager.ts`
  - 添加了 `saveUser()`, `getUser()`, `clearUser()` 方法
  - 持久化存储用户信息

- ✅ 修改了 `windows-login-manager/electron/ipc/handler.ts`
  - `login` 处理器保存用户信息
  - `logout` 处理器清除用户信息
  - `check-auth` 处理器返回用户信息

- ✅ 修改了 `windows-login-manager/electron/api/client.ts`
  - `login()` 方法返回用户信息
  - 更新了 `AuthResponse` 接口包含 `user` 字段

- ✅ 更新了类型定义
  - `windows-login-manager/src/types/electron.d.ts`
  - `windows-login-manager/src/services/ipc.ts`

## 测试步骤

### 准备工作

1. 确保后端数据库中有两个测试用户：
   ```sql
   -- 管理员用户
   INSERT INTO users (username, password, email, role) 
   VALUES ('admin', 'hashed_password', 'admin@example.com', 'admin');
   
   -- 普通用户
   INSERT INTO users (username, password, email, role) 
   VALUES ('user', 'hashed_password', 'user@example.com', 'user');
   ```

### 测试场景 1：网页端 - 管理员登录

1. 启动网页端应用
2. 使用管理员账号登录（admin）
3. 验证：
   - ✅ 左侧菜单显示"系统配置"选项
   - ✅ 可以点击进入"系统配置"页面
   - ✅ 可以通过URL直接访问 `/config`

### 测试场景 2：网页端 - 普通用户登录

1. 退出登录
2. 使用普通用户账号登录（user）
3. 验证：
   - ✅ 左侧菜单**不显示**"系统配置"选项
   - ✅ 尝试通过URL访问 `/config` 时：
     - 显示警告消息："您没有权限访问此页面"
     - 自动重定向到首页 `/`

### 测试场景 3：Windows端 - 管理员登录

1. 启动Windows端应用
2. 使用管理员账号登录（admin）
3. 验证：
   - ✅ 左侧菜单显示"设置"选项
   - ✅ 可以点击进入"设置"页面
   - ✅ 可以通过URL直接访问 `/settings`

### 测试场景 4：Windows端 - 普通用户登录

1. 退出登录
2. 使用普通用户账号登录（user）
3. 验证：
   - ✅ 左侧菜单**不显示**"设置"选项
   - ✅ 尝试通过URL访问 `/settings` 时：
     - 自动重定向到 `/platforms`
     - 控制台显示日志："[Auth] 非管理员用户尝试访问设置页面"

### 测试场景 5：权限持久化

1. 使用管理员账号登录
2. 刷新页面
3. 验证：
   - ✅ 用户信息保持（localStorage/electron-store）
   - ✅ 权限状态保持
   - ✅ 菜单显示正确

4. 关闭并重新打开应用（Windows端）
5. 验证：
   - ✅ 自动恢复登录状态
   - ✅ 用户角色信息正确
   - ✅ 菜单显示正确

## 技术实现细节

### 用户角色定义
```typescript
interface UserInfo {
  id: number;
  username: string;
  email?: string;
  role: string;  // 'admin' | 'user'
}
```

### 权限检查逻辑
```typescript
// 检查是否是管理员
function isAdmin(): boolean {
  const user = getCurrentUser();
  return user?.role === 'admin';
}

// 检查特定权限
function hasPermission(permission: string): boolean {
  const user = getCurrentUser();
  if (!user) return false;
  
  // 管理员拥有所有权限
  if (user.role === 'admin') return true;
  
  // 根据权限类型判断
  switch (permission) {
    case 'system:config':
    case 'system:settings':
      return user.role === 'admin';
    default:
      return true;
  }
}
```

### 路由保护
```typescript
// 网页端
<Route path="/config" element={
  <AdminRoute>
    <ConfigPage />
  </AdminRoute>
} />

// Windows端
<Route path="/settings" element={
  <AdminRoute>
    <Settings />
  </AdminRoute>
} />
```

### 菜单条件渲染
```typescript
// 网页端
...(userIsAdmin ? [{
  key: '/config',
  icon: <SettingOutlined />,
  label: '系统配置',
}] : [])

// Windows端
{userIsAdmin && (
  <li>
    <Link to="/settings">
      <span className="icon">⚙️</span>
      <span>设置</span>
    </Link>
  </li>
)}
```

## 安全考虑

1. **前端验证**：菜单隐藏和路由保护
2. **后端验证**：API层面的权限检查（需要后端实现）
3. **Token验证**：确保用户身份真实性
4. **角色持久化**：安全存储用户角色信息

## 注意事项

1. 前端权限控制主要用于UI展示，**不能替代后端权限验证**
2. 后端API应该在每个需要权限的接口上验证用户角色
3. 用户角色信息存储在：
   - 网页端：`localStorage.user_info`
   - Windows端：`electron-store.user`
4. 退出登录时会清除所有用户信息和权限状态

## 扩展建议

如果需要更细粒度的权限控制，可以：

1. 定义权限常量：
```typescript
export const PERMISSIONS = {
  SYSTEM_CONFIG: 'system:config',
  SYSTEM_SETTINGS: 'system:settings',
  USER_MANAGE: 'user:manage',
  ARTICLE_PUBLISH: 'article:publish',
  // ...
} as const;
```

2. 实现基于权限的组件：
```typescript
<PermissionGuard permission={PERMISSIONS.SYSTEM_CONFIG}>
  <ConfigButton />
</PermissionGuard>
```

3. 后端实现RBAC（基于角色的访问控制）中间件

## 故障排查

### 问题：菜单项没有隐藏
- 检查用户信息是否正确加载
- 检查 `isAdmin()` 函数返回值
- 查看浏览器控制台是否有错误

### 问题：路由保护不生效
- 检查 `AdminRoute` 组件是否正确包裹
- 检查用户信息是否存在于 localStorage/store
- 查看控制台日志

### 问题：Windows端用户信息丢失
- 检查 `storageManager.saveUser()` 是否被调用
- 检查 `electron-store` 是否正常工作
- 查看 Electron 日志文件

## 总结

本次实现完成了完整的基于角色的权限控制系统，包括：
- ✅ 网页端权限控制（菜单 + 路由）
- ✅ Windows端权限控制（菜单 + 路由）
- ✅ 用户信息持久化存储
- ✅ 权限检查工具函数
- ✅ 路由保护组件
- ✅ 类型安全的实现

系统管理员可以访问所有功能，普通用户无法看到和访问"系统设置"和"设置"模块。
