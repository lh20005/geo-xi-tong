# GEO系统API安全文档

## 目录
1. [认证机制](#认证机制)
2. [授权和权限](#授权和权限)
3. [频率限制](#频率限制)
4. [请求验证](#请求验证)
5. [安全响应头](#安全响应头)
6. [错误处理](#错误处理)
7. [API端点安全](#api端点安全)
8. [最佳实践](#最佳实践)

---

## 认证机制

### JWT双令牌系统

系统使用JWT双令牌机制：
- **Access Token**: 短期令牌（1小时），用于API请求认证
- **Refresh Token**: 长期令牌（7天），用于刷新Access Token

### 登录流程

**端点**: `POST /api/auth/login`

**请求**:
```json
{
  "username": "admin",
  "password": "SecurePass123"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "admin",
      "role": "admin"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**安全特性**:
- 密码使用bcrypt哈希（cost factor 10）
- 失败5次后账户锁定15分钟
- 记录IP地址和User Agent
- 所有登录尝试记录到审计日志

### 刷新令牌

**端点**: `POST /api/auth/refresh`

**请求**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**安全特性**:
- Refresh Token存储在数据库（哈希后）
- 验证时检查数据库记录
- 使用后更新last_used_at时间戳
- 超过有效期自动失效

### 使用Access Token

**请求头**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**示例**:
```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  http://localhost:3000/api/users
```

---

## 授权和权限

### 基于角色的访问控制

**角色类型**:
- `admin`: 管理员，拥有所有权限
- `user`: 普通用户，受限权限

### 细粒度权限

**权限列表**:
- `view_users`: 查看用户列表
- `edit_users`: 编辑用户信息
- `delete_users`: 删除用户
- `edit_config`: 修改系统配置
- `view_logs`: 查看审计日志
- `view_config`: 查看安全配置
- `manage_permissions`: 管理权限

### 权限检查

**中间件**: `checkPermission`

**使用示例**:
```typescript
router.get('/users', 
  authenticateToken, 
  checkPermission('view_users'), 
  getUsersHandler
);
```

**权限不足响应**:
```json
{
  "success": false,
  "message": "权限不足"
}
```
HTTP状态码: 403 Forbidden

---

## 频率限制

### 限制策略

| 操作类型 | 限制 | 时间窗口 | 端点 |
|---------|------|---------|------|
| 登录 | 5次 | 15分钟 | `/api/auth/login` |
| 用户管理 | 10次 | 1小时 | `/api/users/*` |
| 配置修改 | 20次 | 1小时 | `/api/security-config/*` |
| API请求 | 100次 | 1小时 | 所有API端点 |

### 频率限制响应

**超限响应**:
```json
{
  "success": false,
  "message": "操作过于频繁，请稍后再试",
  "retryAfter": 900
}
```
HTTP状态码: 429 Too Many Requests

**响应头**:
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1703462400
Retry-After: 900
```

### 查询剩余配额

**端点**: `GET /api/rate-limit/quota`

**响应**:
```json
{
  "success": true,
  "data": {
    "remaining": 3,
    "limit": 5,
    "resetAt": "2024-12-24T15:00:00Z"
  }
}
```

---

## 请求验证

### 输入验证

所有API端点都进行输入验证：
- 数据类型验证
- 格式验证
- 长度限制
- 恶意模式检测

**验证失败响应**:
```json
{
  "success": false,
  "message": "输入验证失败",
  "errors": [
    {
      "field": "username",
      "message": "用户名长度必须在3-50字符之间"
    }
  ]
}
```
HTTP状态码: 400 Bad Request

### CSRF保护

**状态变更请求需要CSRF令牌**:
- POST
- PUT
- DELETE
- PATCH

**获取CSRF令牌**:
```bash
curl http://localhost:3000/api/csrf-token
```

**响应**:
```json
{
  "success": true,
  "data": {
    "csrfToken": "a1b2c3d4e5f6..."
  }
}
```

**使用CSRF令牌**:
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-CSRF-Token: a1b2c3d4e5f6..." \
  -H "Content-Type: application/json" \
  -d '{"username": "newuser"}'
```

### 负载大小限制

**限制**:
- JSON请求体: 最大10MB
- 文件上传: 最大50MB

**超限响应**:
```json
{
  "success": false,
  "message": "请求体过大"
}
```
HTTP状态码: 413 Payload Too Large

---

## 安全响应头

### 自动设置的响应头

所有API响应都包含以下安全头：

```
Content-Security-Policy: default-src 'self'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-XSS-Protection: 1; mode=block
```

### Cookie安全属性

```
Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Strict
```

**属性说明**:
- `HttpOnly`: 防止JavaScript访问
- `Secure`: 仅通过HTTPS传输
- `SameSite=Strict`: 防止CSRF攻击

---

## 错误处理

### 标准错误响应格式

```json
{
  "success": false,
  "message": "错误描述",
  "code": "ERROR_CODE"
}
```

### 常见错误码

| HTTP状态码 | 错误码 | 说明 |
|-----------|--------|------|
| 400 | INVALID_INPUT | 输入验证失败 |
| 401 | UNAUTHORIZED | 未认证或令牌无效 |
| 403 | FORBIDDEN | 权限不足 |
| 404 | NOT_FOUND | 资源不存在 |
| 429 | RATE_LIMIT_EXCEEDED | 超过频率限制 |
| 500 | INTERNAL_ERROR | 服务器内部错误 |

### 错误信息安全

**不要暴露敏感信息**:
- ❌ "User with email admin@example.com not found"
- ✅ "用户名或密码错误"

**生产环境错误处理**:
- 返回通用错误消息
- 详细错误记录到日志
- 不暴露堆栈跟踪

---

## API端点安全

### 用户管理API

#### 创建用户
```
POST /api/users
权限: edit_users
频率限制: 10次/小时
CSRF保护: 是
```

**请求**:
```json
{
  "username": "newuser",
  "email": "user@example.com",
  "password": "SecurePass123",
  "role": "user"
}
```

#### 更新用户
```
PUT /api/users/:id
权限: edit_users
频率限制: 10次/小时
CSRF保护: 是
```

#### 删除用户
```
DELETE /api/users/:id
权限: delete_users
频率限制: 10次/小时
CSRF保护: 是
二次确认: 是
```

**需要确认令牌**:
```bash
# 1. 请求确认令牌
curl -X POST http://localhost:3000/api/confirmation/request \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "delete_user", "targetId": 123}'

# 2. 使用确认令牌执行删除
curl -X DELETE http://localhost:3000/api/users/123 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Confirmation-Token: CONFIRMATION_TOKEN"
```

### 安全配置API

#### 查看配置
```
GET /api/security-config
权限: view_config
频率限制: 100次/小时
```

#### 更新配置
```
PUT /api/security-config/:key
权限: edit_config
频率限制: 20次/小时
CSRF保护: 是
审计日志: 是
通知: 是
```

### 审计日志API

#### 查询日志
```
GET /api/audit-logs
权限: view_logs
频率限制: 100次/小时
```

**查询参数**:
- `adminId`: 管理员ID
- `action`: 操作类型
- `startDate`: 开始日期
- `endDate`: 结束日期
- `page`: 页码
- `pageSize`: 每页数量

#### 导出日志
```
GET /api/audit-logs/export
权限: view_logs
频率限制: 10次/小时
```

---

## 最佳实践

### 1. 令牌管理

**存储**:
- Access Token: 内存或sessionStorage
- Refresh Token: httpOnly cookie（推荐）或localStorage

**刷新策略**:
```javascript
// 在Access Token过期前自动刷新
async function autoRefreshToken() {
  const tokenExpiry = getTokenExpiry();
  const now = Date.now();
  
  // 提前5分钟刷新
  if (tokenExpiry - now < 5 * 60 * 1000) {
    await refreshAccessToken();
  }
}

// 每分钟检查一次
setInterval(autoRefreshToken, 60 * 1000);
```

### 2. 错误处理

**统一错误处理**:
```javascript
async function apiRequest(url, options) {
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (!response.ok) {
      if (response.status === 401) {
        // 令牌过期，尝试刷新
        await refreshAccessToken();
        return apiRequest(url, options);
      } else if (response.status === 429) {
        // 频率限制，等待后重试
        const retryAfter = response.headers.get('Retry-After');
        await sleep(retryAfter * 1000);
        return apiRequest(url, options);
      }
      throw new Error(data.message);
    }
    
    return data;
  } catch (error) {
    console.error('API请求失败:', error);
    throw error;
  }
}
```

### 3. 请求重试

**指数退避重试**:
```javascript
async function retryRequest(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // 指数退避: 1s, 2s, 4s
      const delay = Math.pow(2, i) * 1000;
      await sleep(delay);
    }
  }
}
```

### 4. 批量操作

**避免频率限制**:
```javascript
// 批量操作时添加延迟
async function batchUpdateUsers(users) {
  for (const user of users) {
    await updateUser(user);
    // 每次操作间隔1秒
    await sleep(1000);
  }
}
```

### 5. 安全的API客户端

**完整示例**:
```javascript
class SecureAPIClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.accessToken = null;
    this.refreshToken = null;
  }
  
  async login(username, password) {
    const response = await fetch(`${this.baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    if (data.success) {
      this.accessToken = data.data.accessToken;
      this.refreshToken = data.data.refreshToken;
    }
    return data;
  }
  
  async refreshAccessToken() {
    const response = await fetch(`${this.baseURL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refreshToken })
    });
    
    const data = await response.json();
    if (data.success) {
      this.accessToken = data.data.accessToken;
    }
    return data;
  }
  
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 401) {
      // 令牌过期，刷新后重试
      await this.refreshAccessToken();
      return this.request(endpoint, options);
    }
    
    return response.json();
  }
}

// 使用示例
const client = new SecureAPIClient('http://localhost:3000');
await client.login('admin', 'password');
const users = await client.request('/api/users');
```

---

## 安全检查清单

### API开发检查清单

- [ ] 所有端点都需要认证（除了公开端点）
- [ ] 实施适当的权限检查
- [ ] 配置频率限制
- [ ] 验证所有输入
- [ ] 清理输出数据
- [ ] 使用CSRF保护
- [ ] 设置安全响应头
- [ ] 记录审计日志
- [ ] 处理错误安全
- [ ] 编写API文档

### API使用检查清单

- [ ] 安全存储令牌
- [ ] 实现自动刷新
- [ ] 处理令牌过期
- [ ] 遵守频率限制
- [ ] 实现错误重试
- [ ] 验证服务器证书
- [ ] 使用HTTPS
- [ ] 不在URL中传递敏感信息
- [ ] 实现请求超时
- [ ] 记录API错误

---

## 参考资源

**相关文档**:
- `SECURITY_FEATURES_GUIDE.md` - 安全功能指南
- `SECURITY_CONFIG_GUIDE.md` - 配置详细说明
- `SECURITY_TROUBLESHOOTING.md` - 故障排除

**外部资源**:
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [REST API Security](https://restfulapi.net/security-essentials/)
