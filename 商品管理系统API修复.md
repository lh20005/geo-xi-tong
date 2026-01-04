# 商品管理系统API修复

## 🐛 问题描述

ProductManagementPage在调用管理员API时出现401 Unauthorized错误。

### 错误信息
```
GET http://localhost:5173/api/admin/products/plans?include_inactive=true 401 (Unauthorized)
```

## 🔍 问题原因

1. **API路径错误**：使用了 `/api/admin/products/plans` 而不是 `/api/admin/products`
2. **缺少认证头**：部分API调用没有添加 `Authorization: Bearer ${token}` header

## ✅ 修复内容

### 1. 修复API路径

**修改前：**
```typescript
const response = await axios.get('/api/admin/products/plans?include_inactive=true');
```

**修改后：**
```typescript
const token = localStorage.getItem('auth_token');
const response = await axios.get('/api/admin/products?include_inactive=true', {
  headers: { Authorization: `Bearer ${token}` }
});
```

### 2. 修复所有API调用

#### loadPlans() - 加载套餐列表
```typescript
const token = localStorage.getItem('auth_token');
const response = await axios.get('/api/admin/products?include_inactive=true', {
  headers: { Authorization: `Bearer ${token}` }
});
```

#### loadHistory() - 加载配置历史
```typescript
const token = localStorage.getItem('auth_token');
const response = await axios.get(url, {
  headers: { Authorization: `Bearer ${token}` }
});
```

#### handleSave() - 保存修改
```typescript
const token = localStorage.getItem('auth_token');
await axios.put(`/api/admin/products/${currentPlan.id}`, values, {
  headers: { Authorization: `Bearer ${token}` }
});
```

#### handleDelete() - 删除套餐
```typescript
const token = localStorage.getItem('auth_token');
await axios.delete(`/api/admin/products/${planId}`, {
  headers: { Authorization: `Bearer ${token}` }
});
```

## 📋 正确的API端点

| 功能 | 方法 | 路径 | 需要认证 |
|-----|------|------|---------|
| 获取套餐列表 | GET | `/api/admin/products` | ✅ 管理员 |
| 获取套餐详情 | GET | `/api/admin/products/:id` | ✅ 管理员 |
| 创建套餐 | POST | `/api/admin/products` | ✅ 管理员 |
| 更新套餐 | PUT | `/api/admin/products/:id` | ✅ 管理员 |
| 删除套餐 | DELETE | `/api/admin/products/:id` | ✅ 管理员 |
| 更新功能配额 | PUT | `/api/admin/products/:id/features` | ✅ 管理员 |
| 获取配置历史 | GET | `/api/admin/products/history` | ✅ 管理员 |

## 🧪 测试验证

### 1. 测试API端点
```bash
# 获取token（先登录）
TOKEN="your_admin_token"

# 测试获取套餐列表
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/admin/products

# 测试获取套餐详情
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/admin/products/1

# 测试更新套餐
curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"planName":"测试套餐","price":99.00}' \
  http://localhost:3000/api/admin/products/1
```

### 2. 测试前端页面

1. **登录管理员账号**
   ```
   http://localhost:5173/login
   ```

2. **访问商品管理页面**
   ```
   http://localhost:5173/products
   ```

3. **验证功能**
   - ✅ 套餐列表正常加载
   - ✅ 编辑套餐正常工作
   - ✅ 删除套餐正常工作
   - ✅ 查看历史正常工作

## 🔒 认证流程

### 1. 获取Token
```typescript
// 登录时保存token
localStorage.setItem('auth_token', token);
```

### 2. 使用Token
```typescript
// 每次API调用时添加header
const token = localStorage.getItem('auth_token');
axios.get('/api/admin/products', {
  headers: { Authorization: `Bearer ${token}` }
});
```

### 3. Token验证
后端中间件会验证：
- Token是否存在
- Token是否有效
- 用户是否是管理员

## 📝 最佳实践

### 1. 统一的API调用方式

建议创建一个axios实例，自动添加认证头：

```typescript
// src/utils/axios.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api'
});

// 请求拦截器：自动添加token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器：处理401错误
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token过期或无效，跳转到登录页
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

### 2. 使用统一的API客户端

```typescript
// 在组件中使用
import apiClient from '@/utils/axios';

const loadPlans = async () => {
  const response = await apiClient.get('/admin/products');
  setPlans(response.data.data);
};
```

### 3. 错误处理

```typescript
try {
  const response = await apiClient.get('/admin/products');
  setPlans(response.data.data);
} catch (error: any) {
  if (error.response?.status === 401) {
    message.error('未授权，请重新登录');
  } else if (error.response?.status === 403) {
    message.error('权限不足');
  } else {
    message.error(error.response?.data?.message || '操作失败');
  }
}
```

## 🎯 修复结果

修复后，ProductManagementPage应该能够：
- ✅ 正常加载套餐列表
- ✅ 正常编辑套餐
- ✅ 正常删除套餐
- ✅ 正常查看历史记录
- ✅ 所有API调用都带有正确的认证头

## 🚀 下一步

1. **测试所有功能**
   - 访问 http://localhost:5173/products
   - 测试加载、编辑、删除功能

2. **优化代码**
   - 考虑创建统一的axios实例
   - 添加更好的错误处理
   - 添加加载状态提示

3. **完善功能**
   - 添加创建套餐功能
   - 添加批量操作
   - 添加搜索和筛选

---

**修复时间**: 2026-01-04
**修复状态**: ✅ 已完成
**测试状态**: 待验证
