# 登录流程修复完成

## 问题描述

用户在营销网站登录后，点击"进入系统"按钮无法进入客户端应用。URL显示：
```
http://localhost:5173/?token=...&refresh_token=undefined&user_info=...
```

关键问题：`refresh_token=undefined`

## 根本原因

`sanitizeResponse` 中间件（`server/src/middleware/sanitizeResponse.ts`）配置为从所有API响应中移除敏感字段，包括 `refreshToken`。这是一个安全措施，但它错误地也从登录/注册响应中移除了 `refreshToken`，而这些端点实际上需要返回 `refreshToken` 给客户端。

### 问题代码

```typescript
// 敏感字段列表
const SENSITIVE_FIELDS = [
  'password',
  'password_hash',
  'passwordHash',
  'refresh_token',
  'refreshToken'  // <-- 这导致所有响应中的 refreshToken 被移除
];
```

## 解决方案

### 1. 添加白名单机制

为需要返回 `refreshToken` 的端点创建白名单：

```typescript
// 不需要清理 refreshToken 的路径（这些端点需要返回 refreshToken）
const REFRESH_TOKEN_WHITELIST = [
  '/login',
  '/register',
  '/refresh'
];
```

**注意**：路径是相对于路由器挂载点的，不包括 `/api/auth` 前缀。

### 2. 修改清理函数

更新 `sanitizeObject` 函数以支持跳过 `refreshToken` 清理：

```typescript
function sanitizeObject(obj: any, skipRefreshToken: boolean = false): any {
  // ...
  for (const key in obj) {
    // 如果是 refreshToken 且在白名单路径中，则保留
    if ((key === 'refreshToken' || key === 'refresh_token') && skipRefreshToken) {
      sanitized[key] = obj[key];
      continue;
    }
    
    // 跳过其他敏感字段
    if (SENSITIVE_FIELDS.includes(key)) {
      continue;
    }
    // ...
  }
}
```

### 3. 更新中间件

修改 `sanitizeResponse` 中间件以检查当前路径：

```typescript
export const sanitizeResponse = (req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res);

  res.json = function(body: any) {
    // 检查当前路径是否在白名单中
    const skipRefreshToken = REFRESH_TOKEN_WHITELIST.some(path => req.path === path);
    
    // 清理响应体
    const sanitizedBody = sanitizeObject(body, skipRefreshToken);
    
    return originalJson(sanitizedBody);
  };

  next();
};
```

## 修改的文件

1. **server/src/middleware/sanitizeResponse.ts**
   - 添加 `REFRESH_TOKEN_WHITELIST` 常量
   - 修改 `sanitizeObject` 函数以支持 `skipRefreshToken` 参数
   - 更新 `sanitizeResponse` 中间件以检查白名单

## 验证

### API 测试

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq .
```

**预期响应**：
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",  // ✅ 现在包含 refreshToken
    "expiresIn": 3600,
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@local.system",
      "role": "admin",
      "invitationCode": "xr2w8q",
      "isTempPassword": false
    }
  }
}
```

### 完整登录流程

1. 访问营销网站：http://localhost:8080
2. 点击"立即登录"
3. 输入用户名和密码
4. 登录成功后，点击"进入系统"
5. 应该成功跳转到客户端应用：http://localhost:5173

## 安全考虑

- `refreshToken` 仍然从其他所有端点的响应中被移除（如用户列表、用户详情等）
- 只有登录、注册和刷新令牌端点会返回 `refreshToken`
- 密码字段仍然从所有响应中被移除
- 这个修复保持了安全性，同时修复了登录流程

## 状态

✅ **已修复** - 登录流程现在可以正常工作，用户可以从营销网站登录并进入客户端应用。
