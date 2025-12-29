# ✅ platformAccounts.ts 多租户修复完成

## 修复时间
2025-12-29

## 修复内容

### 1. 路由文件已有认证和租户中间件
路由文件已经配置了认证和租户中间件，无需添加。

### 2. 修改 AccountService 方法签名
所有涉及账号操作的方法都添加了 `userId` 参数：

#### getAllAccounts(userId: number)
- 添加 user_id 过滤，只返回当前用户的账号

#### getAccountsByPlatform(platformId: string, userId: number)
- 添加 user_id 过滤，只返回当前用户在指定平台的账号

#### getAccountById(accountId: number, userId: number, includeCredentials: boolean)
- 验证账号所有权，只能访问自己的账号

#### createAccount(input: CreateAccountInput, userId: number)
- 创建账号时关联 user_id

#### createAccountWithRealUsername(input: CreateAccountInput, realUsername: string, userId: number)
- 创建账号时关联 user_id 和真实用户名

#### createOrUpdateAccount(input: CreateAccountInput, realUsername: string, userId: number)
- 在当前用户范围内检查重复账号
- 创建或更新时关联 user_id

#### updateAccountWithRealUsername(accountId: number, userId: number, input: UpdateAccountInput, realUsername: string)
- 验证账号所有权后更新

#### deleteAccount(accountId: number, userId: number)
- 验证账号所有权后删除

#### setDefaultAccount(platformId: string, accountId: number, userId: number)
- 只在当前用户的账号中设置默认
- 验证账号所有权

#### loginWithBrowser(platform: any, userId: number)
- 浏览器登录创建的账号关联 user_id
- 检查重复账号时限定在当前用户范围

### 3. 路由文件修改

#### GET /accounts
```typescript
const userId = getCurrentTenantId(req);
const accounts = await accountService.getAllAccounts(userId);
```

#### GET /accounts/platform/:platformId
```typescript
const userId = getCurrentTenantId(req);
const accounts = await accountService.getAccountsByPlatform(platformId, userId);
```

#### GET /accounts/:id
```typescript
const userId = getCurrentTenantId(req);
const account = await accountService.getAccountById(accountId, userId, includeCredentials);
```

#### POST /accounts
```typescript
const userId = getCurrentTenantId(req);
const result = await accountService.createOrUpdateAccount({...}, realUsername, userId);
```

#### PUT /accounts/:id
```typescript
const userId = getCurrentTenantId(req);
const account = await accountService.updateAccountWithRealUsername(accountId, userId, {...}, real_username);
```

#### DELETE /accounts/:id
```typescript
const userId = getCurrentTenantId(req);
await accountService.deleteAccount(accountId, userId);
```

#### POST /accounts/:id/set-default
```typescript
const userId = getCurrentTenantId(req);
await accountService.setDefaultAccount(platform_id, accountId, userId);
```

#### POST /browser-login
```typescript
const userId = getCurrentTenantId(req);
const result = await accountService.loginWithBrowser(platform, userId);
```

## 修复特点

1. **Service 层完整隔离**：所有 AccountService 方法都接受 userId 参数
2. **账号去重范围限定**：createOrUpdateAccount 只在当前用户范围内检查重复
3. **默认账号隔离**：每个用户可以为同一平台设置自己的默认账号
4. **浏览器登录支持**：浏览器登录创建的账号自动关联当前用户
5. **完整所有权验证**：所有操作都验证账号所有权

## 测试建议

### 1. 账号列表隔离测试
```bash
# 用户A创建账号
curl -X POST http://localhost:3001/api/platform-accounts/accounts \
  -H "Authorization: Bearer <userA_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "platform_id": "xiaohongshu",
    "account_name": "用户A的小红书账号",
    "credentials": {"username": "userA", "password": "pass123"}
  }'

# 用户B不应该看到用户A的账号
curl http://localhost:3001/api/platform-accounts/accounts \
  -H "Authorization: Bearer <userB_token>"
```

### 2. 账号操作权限测试
```bash
# 用户B尝试访问用户A的账号（应该返回404）
curl http://localhost:3001/api/platform-accounts/accounts/1 \
  -H "Authorization: Bearer <userB_token>"

# 用户B尝试删除用户A的账号（应该返回错误）
curl -X DELETE http://localhost:3001/api/platform-accounts/accounts/1 \
  -H "Authorization: Bearer <userB_token>"
```

### 3. 默认账号隔离测试
```bash
# 用户A设置默认账号
curl -X POST http://localhost:3001/api/platform-accounts/accounts/1/set-default \
  -H "Authorization: Bearer <userA_token>" \
  -H "Content-Type: application/json" \
  -d '{"platform_id": "xiaohongshu"}'

# 用户B设置自己的默认账号（不应该影响用户A）
curl -X POST http://localhost:3001/api/platform-accounts/accounts/2/set-default \
  -H "Authorization: Bearer <userB_token>" \
  -H "Content-Type: application/json" \
  -d '{"platform_id": "xiaohongshu"}'
```

### 4. 浏览器登录测试
```bash
# 用户A通过浏览器登录
curl -X POST http://localhost:3001/api/platform-accounts/browser-login \
  -H "Authorization: Bearer <userA_token>" \
  -H "Content-Type: application/json" \
  -d '{"platform_id": "xiaohongshu"}'

# 创建的账号应该属于用户A
```

## 下一步

继续修复剩余路由文件：
- distillation.ts（15+ 路由，高复杂度）
- article.ts（10+ 路由，高复杂度）
