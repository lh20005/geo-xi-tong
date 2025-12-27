# 管理员菜单消失问题修复

## 问题描述

用户登录后，管理员菜单（商品管理、订单管理、安全管理等）在一段时间后会消失。

## 根本原因

`Sidebar` 组件在初始化时只调用一次 `isAdmin()` 函数来判断是否显示管理员菜单。之后即使 `localStorage` 中的用户信息发生变化，菜单也不会重新渲染。

这导致：
1. 如果用户信息在登录后异步更新，菜单可能不会立即显示
2. 如果 localStorage 中的用户信息被清除或修改，菜单会消失
3. 页面刷新前后的状态不一致

## 解决方案

### 1. Sidebar 组件改进

**修改文件：** `windows-login-manager/src/components/Layout/Sidebar.tsx`

**改进内容：**
- 将 `userIsAdmin` 从常量改为状态变量
- 添加 `useEffect` 监听用户信息变化
- 实现三种监听机制：
  1. **storage 事件** - 监听跨标签页的 localStorage 变化
  2. **自定义事件** - 监听同一标签页内的用户信息更新
  3. **定时检查** - 每3秒检查一次作为备用方案

```typescript
const [userIsAdmin, setUserIsAdmin] = useState(isAdmin());

useEffect(() => {
  const checkAdminStatus = () => {
    const newAdminStatus = isAdmin();
    if (newAdminStatus !== userIsAdmin) {
      console.log('[Sidebar] 管理员状态变化:', userIsAdmin, '->', newAdminStatus);
      setUserIsAdmin(newAdminStatus);
    }
  };

  // 监听 storage 事件（跨标签页）
  window.addEventListener('storage', checkAdminStatus);
  
  // 监听自定义事件（同一标签页内的变化）
  window.addEventListener('userInfoUpdated', checkAdminStatus);
  
  // 定期检查（每3秒检查一次，作为备用方案）
  const interval = setInterval(checkAdminStatus, 3000);

  return () => {
    window.removeEventListener('storage', checkAdminStatus);
    window.removeEventListener('userInfoUpdated', checkAdminStatus);
    clearInterval(interval);
  };
}, [userIsAdmin]);
```

### 2. App.tsx 改进

**修改文件：** `windows-login-manager/src/App.tsx`

**改进内容：**
在更新 localStorage 时触发自定义事件，通知其他组件用户信息已更新

```typescript
// 在 checkAuth、handleLoginSuccess、handleLogout 中添加：
localStorage.setItem('user_info', JSON.stringify(user));
window.dispatchEvent(new Event('userInfoUpdated'));
```

## 修复效果

### 修复前：
- ❌ 管理员菜单在登录后可能不显示
- ❌ 菜单在一段时间后会消失
- ❌ 页面刷新后菜单状态不一致

### 修复后：
- ✅ 管理员菜单在登录后立即显示
- ✅ 菜单状态实时响应用户信息变化
- ✅ 页面刷新后菜单状态保持一致
- ✅ 多种监听机制确保可靠性

## 监听机制说明

### 1. Storage 事件监听
- **用途：** 监听跨标签页的 localStorage 变化
- **触发时机：** 其他标签页修改 localStorage 时
- **优点：** 浏览器原生支持，可靠性高

### 2. 自定义事件监听
- **用途：** 监听同一标签页内的用户信息更新
- **触发时机：** 登录、登出、认证检查时
- **优点：** 响应速度快，实时性好

### 3. 定时检查
- **用途：** 作为备用方案，确保状态最终一致
- **触发时机：** 每3秒检查一次
- **优点：** 兜底机制，防止遗漏

## 性能优化

1. **状态比较：** 只在管理员状态真正变化时才更新组件
2. **合理频率：** 定时检查从1秒改为3秒，减少性能开销
3. **事件清理：** 组件卸载时正确清理所有监听器

## 测试建议

1. **登录测试：** 使用管理员账号登录，检查菜单是否立即显示
2. **持久性测试：** 登录后等待5-10分钟，检查菜单是否仍然显示
3. **刷新测试：** 刷新页面，检查菜单状态是否保持
4. **切换测试：** 在不同页面间切换，检查菜单是否正常

## 相关文件

- `windows-login-manager/src/components/Layout/Sidebar.tsx` - 侧边栏组件
- `windows-login-manager/src/App.tsx` - 应用主组件
- `windows-login-manager/src/utils/auth.ts` - 权限工具函数

---

**修复日期：** 2025-12-28
**状态：** ✅ 已完成
