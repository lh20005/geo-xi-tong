# 调试管理员权限问题

## 问题
管理员账户看不到"安全管理"和"系统配置"菜单

## 排查步骤

### 1. 检查浏览器localStorage

打开浏览器控制台（F12），在Console标签页输入：

```javascript
// 检查存储的用户信息
console.log('user_info:', localStorage.getItem('user_info'));

// 解析用户信息
const userInfo = JSON.parse(localStorage.getItem('user_info'));
console.log('解析后的用户信息:', userInfo);
console.log('用户角色:', userInfo?.role);
console.log('是否是admin:', userInfo?.role === 'admin');
```

### 2. 检查token

```javascript
// 检查token
console.log('auth_token:', localStorage.getItem('auth_token'));
console.log('token:', localStorage.getItem('token'));
```

### 3. 可能的问题

#### 问题1: localStorage的key不对
系统可能使用了不同的key来存储用户信息：
- `user_info` (新代码使用)
- `userInfo` (可能的旧代码)

#### 问题2: role字段值不对
检查role的值是否完全等于 `'admin'`，可能是：
- `'Admin'` (大写)
- `'administrator'`
- 其他值

#### 问题3: 用户信息未正确保存
登录后用户信息没有正确保存到localStorage

## 解决方案

### 方案1: 手动设置管理员权限（临时测试）

在浏览器控制台执行：

```javascript
// 获取当前用户信息
let userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');

// 设置为管理员
userInfo.role = 'admin';

// 保存回localStorage
localStorage.setItem('user_info', JSON.stringify(userInfo));

// 刷新页面
location.reload();
```

### 方案2: 检查数据库中的用户角色

在服务器端执行SQL查询：

```sql
-- 查看所有用户的角色
SELECT id, username, email, role FROM users;

-- 更新用户为管理员
UPDATE users SET role = 'admin' WHERE username = '你的用户名';
```

### 方案3: 检查登录响应

在浏览器Network标签页：
1. 清除localStorage
2. 重新登录
3. 查看登录API响应（通常是 `/api/auth/login`）
4. 检查响应中的用户信息是否包含正确的role

## 快速测试命令

在浏览器控制台执行以下代码来强制显示菜单（仅用于测试）：

```javascript
// 临时设置管理员权限
localStorage.setItem('user_info', JSON.stringify({
  id: 1,
  username: 'admin',
  email: 'admin@example.com',
  role: 'admin'
}));

// 刷新页面
location.reload();
```

## 检查前端代码

如果上述方法都不行，可能需要检查：

1. `client/src/utils/auth.ts` - isAdmin()函数
2. `client/src/components/Layout/Sidebar.tsx` - userIsAdmin变量
3. `client/src/components/AdminRoute.tsx` - 管理员路由保护

## 联系开发者

如果问题仍然存在，请提供：
1. 浏览器控制台的localStorage内容
2. 登录API的响应内容
3. 数据库中用户的role字段值
