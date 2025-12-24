# 用户管理 API 文档

## 概述

本文档描述了用户管理增强功能的所有 API 端点，包括注册、认证、用户管理和邀请系统。

## 基础信息

- **Base URL**: `http://localhost:3000/api`
- **认证方式**: JWT Bearer Token
- **内容类型**: `application/json`

## 认证端点

### 1. 用户注册

**POST** `/auth/register`

注册新用户账户。

**请求体：**
```json
{
  "username": "string (3-20字符，字母数字下划线)",
  "password": "string (最少6字符)",
  "invitationCode": "string (可选，6字符邀请码)"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "zhangsan",
      "invitationCode": "abc123",
      "role": "user",
      "createdAt": "2024-12-24T10:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600
  }
}
```

**错误响应：**
- `400` - 用户名已存在、密码太短、邀请码无效
- `429` - 注册次数过多（每小时限制3次）

---

### 2. 用户登录

**POST** `/auth/login`

用户登录获取访问令牌。

**请求体：**
```json
{
  "username": "string",
  "password": "string"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "zhangsan",
      "role": "user",
      "invitationCode": "abc123",
      "isTempPassword": false
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600
  }
}
```

**错误响应：**
- `400` - 用户名或密码错误
- `429` - 登录尝试次数过多（15分钟内限制5次失败尝试）

---

### 3. 用户登出

**POST** `/auth/logout`

登出并使刷新令牌失效。

**请求头：**
```
Authorization: Bearer <token>
```

**请求体：**
```json
{
  "refreshToken": "string"
}
```

**响应：**
```json
{
  "success": true,
  "message": "登出成功"
}
```

---

## 用户资料端点

### 4. 获取当前用户资料

**GET** `/users/profile`

获取当前登录用户的详细资料。

**请求头：**
```
Authorization: Bearer <token>
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "zhangsan",
    "invitationCode": "abc123",
    "invitedByCode": "xyz789",
    "role": "user",
    "createdAt": "2024-12-24T10:00:00.000Z",
    "lastLoginAt": "2024-12-24T15:30:00.000Z"
  }
}
```

---

### 5. 修改密码

**PUT** `/users/password`

修改当前用户的密码。

**请求头：**
```
Authorization: Bearer <token>
```

**请求体：**
```json
{
  "currentPassword": "string",
  "newPassword": "string (最少6字符)"
}
```

**响应：**
```json
{
  "success": true,
  "message": "密码修改成功"
}
```

**错误响应：**
- `400` - 当前密码错误、新密码太短

---

## 邀请系统端点

### 6. 获取邀请统计

**GET** `/invitations/stats`

获取当前用户的邀请统计信息。

**请求头：**
```
Authorization: Bearer <token>
```

**响应：**
```json
{
  "success": true,
  "data": {
    "invitationCode": "abc123",
    "totalInvites": 5,
    "invitedUsers": [
      {
        "username": "user1",
        "createdAt": "2024-12-24T10:00:00.000Z"
      },
      {
        "username": "user2",
        "createdAt": "2024-12-24T11:00:00.000Z"
      }
    ]
  }
}
```

---

### 7. 验证邀请码

**POST** `/invitations/validate`

验证邀请码是否有效（公开端点，无需认证）。

**请求体：**
```json
{
  "invitationCode": "string (6字符)"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "inviterUsername": "zhangsan"
  }
}
```

---

## 管理员端点

所有管理员端点都需要管理员权限（role = 'admin'）。

### 8. 获取用户列表

**GET** `/admin/users`

获取分页的用户列表，支持搜索。

**请求头：**
```
Authorization: Bearer <admin_token>
```

**查询参数：**
- `page` (可选): 页码，默认 1
- `pageSize` (可选): 每页数量，默认 10
- `search` (可选): 搜索用户名

**示例：**
```
GET /api/admin/users?page=1&pageSize=20&search=zhang
```

**响应：**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 1,
        "username": "zhangsan",
        "invitationCode": "abc123",
        "invitedByCode": "xyz789",
        "invitedCount": 5,
        "role": "user",
        "createdAt": "2024-12-24T10:00:00.000Z",
        "lastLoginAt": "2024-12-24T15:30:00.000Z"
      }
    ],
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}
```

---

### 9. 获取用户详情

**GET** `/admin/users/:id`

获取指定用户的详细信息。

**请求头：**
```
Authorization: Bearer <admin_token>
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "zhangsan",
    "invitationCode": "abc123",
    "invitedByCode": "xyz789",
    "role": "user",
    "createdAt": "2024-12-24T10:00:00.000Z",
    "lastLoginAt": "2024-12-24T15:30:00.000Z",
    "invitedUsers": [
      {
        "username": "user1",
        "createdAt": "2024-12-24T10:00:00.000Z"
      }
    ]
  }
}
```

---

### 10. 更新用户信息

**PUT** `/admin/users/:id`

更新用户的用户名或角色。

**请求头：**
```
Authorization: Bearer <admin_token>
```

**请求体：**
```json
{
  "username": "string (可选)",
  "role": "user | admin (可选)"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "newusername",
    "role": "admin",
    "updatedAt": "2024-12-24T16:00:00.000Z"
  },
  "message": "用户信息更新成功"
}
```

---

### 11. 重置用户密码

**POST** `/admin/users/:id/reset-password`

管理员重置用户密码，生成临时密码。

**请求头：**
```
Authorization: Bearer <admin_token>
```

**响应：**
```json
{
  "success": true,
  "data": {
    "temporaryPassword": "Abc12345"
  },
  "message": "密码重置成功"
}
```

**注意：** 用户使用临时密码登录后必须修改密码才能继续使用。

---

### 12. 删除用户

**DELETE** `/admin/users/:id`

删除指定用户。

**请求头：**
```
Authorization: Bearer <admin_token>
```

**响应：**
```json
{
  "success": true,
  "message": "用户删除成功"
}
```

---

## WebSocket 事件

WebSocket 连接地址：`ws://localhost:3000/ws?token=<jwt_token>`

### 服务器到客户端事件

#### 1. user:updated
用户信息被更新时触发。

```json
{
  "type": "user:updated",
  "payload": {
    "userId": 1,
    "username": "newusername",
    "role": "admin"
  }
}
```

#### 2. user:deleted
用户被删除时触发。

```json
{
  "type": "user:deleted",
  "payload": {
    "userId": 1
  }
}
```

#### 3. user:password-changed
用户密码被修改时触发。

```json
{
  "type": "user:password-changed",
  "payload": {
    "userId": 1,
    "isTemporary": false
  }
}
```

---

## 错误代码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未认证或令牌无效 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 429 | 请求过于频繁（限流） |
| 500 | 服务器内部错误 |

## 错误响应格式

```json
{
  "success": false,
  "message": "错误描述",
  "code": "ERROR_CODE (可选)"
}
```

## 限流规则

| 端点 | 限制 | 时间窗口 |
|------|------|----------|
| POST /auth/login | 5次失败尝试 | 15分钟 |
| POST /auth/register | 3次注册 | 1小时 |

## 安全注意事项

1. **令牌存储**：访问令牌应存储在内存中，刷新令牌可存储在 HttpOnly Cookie 或安全存储中
2. **HTTPS**：生产环境必须使用 HTTPS
3. **密码要求**：最少6个字符（建议在客户端增加更强的密码策略）
4. **限流**：遵守限流规则，避免被封禁
5. **敏感信息**：API 响应中不会包含密码或密码哈希

## 示例代码

### JavaScript/TypeScript

```typescript
// 注册
const register = async (username: string, password: string, invitationCode?: string) => {
  const response = await fetch('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password, invitationCode })
  });
  return response.json();
};

// 登录
const login = async (username: string, password: string) => {
  const response = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password })
  });
  return response.json();
};

// 获取用户资料（需要认证）
const getProfile = async (token: string) => {
  const response = await fetch('http://localhost:3000/api/users/profile', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};
```

---

**文档版本**: 1.0  
**最后更新**: 2024-12-24
