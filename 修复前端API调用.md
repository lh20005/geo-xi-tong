# 修复前端API调用问题

## 问题分析

### 发现的问题

1. **重复的baseURL**: 
   - `API_BASE_URL` = `http://localhost:3000/api`
   - 实际请求: `${API_BASE_URL}/api/admin/orders` = `http://localhost:3000/api/api/admin/orders` ❌

2. **未使用apiClient**:
   - 前端有配置好的`apiClient`（自动添加token）
   - 但`OrderManagementPage`和`ProductManagementPage`直接使用`axios`

### 正确的API路径

- ❌ 错误: `http://localhost:3000/api/api/admin/orders`
- ✅ 正确: `http://localhost:3000/api/admin/orders`

## 解决方案

### 方案1: 修改页面代码使用apiClient（推荐）

修改`OrderManagementPage.tsx`和`ProductManagementPage.tsx`，使用`apiClient`而不是直接使用`axios`。

#### 优点:
- 自动添加认证token
- 自动处理token刷新
- 统一错误处理
- 代码更简洁

### 方案2: 修正API路径

如果不想改动太多代码，只需要修正API路径：

将:
```typescript
const response = await axios.get(`${API_BASE_URL}/api/admin/orders`, ...)
```

改为:
```typescript
const response = await axios.get(`${API_BASE_URL}/admin/orders`, ...)
```

## 快速测试

在浏览器控制台执行以下代码，看看实际请求的URL是什么：

```javascript
// 检查API_BASE_URL
console.log('API_BASE_URL:', 'http://localhost:3000/api');

// 检查实际请求的URL
const url = `http://localhost:3000/api/api/admin/orders`;
console.log('实际请求URL:', url);
console.log('是否包含重复的/api:', url.includes('/api/api/'));

// 正确的URL应该是
console.log('正确的URL:', 'http://localhost:3000/api/admin/orders');
```

## 立即修复

我可以帮你修复这两个页面的代码。是否需要我：

1. ✅ 修改`OrderManagementPage.tsx`使用`apiClient`
2. ✅ 修改`ProductManagementPage.tsx`使用`apiClient`
3. ✅ 确保所有API调用都使用正确的路径

这样可以：
- 解决当前的"获取失败"问题
- 自动处理token刷新
- 统一错误处理
- 提升代码质量

## 临时解决方案（无需修改代码）

如果你现在就想让页面工作，可以在浏览器控制台执行：

```javascript
// 重新登录获取新token
fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'admin123'
  })
})
.then(res => res.json())
.then(data => {
  if (data.success) {
    localStorage.setItem('auth_token', data.data.token);
    localStorage.setItem('refresh_token', data.data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.data.user));
    console.log('✅ 登录成功，请刷新页面');
    location.reload();
  }
});
```

然后刷新页面，应该就能正常显示了。

## 需要我帮你修复代码吗？

如果需要，我可以立即修改这两个文件，使用`apiClient`替代直接的`axios`调用。
