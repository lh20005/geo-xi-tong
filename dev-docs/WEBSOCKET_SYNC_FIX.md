# WebSocket同步问题修复

## 问题根源

### 发现的问题

在Win平台新增和删除账户，网页端的账号管理列表无法实现信息同步。

### 根本原因

**API端点不一致**：

1. **Windows端调用**：
   - 创建账号：`POST /api/accounts`
   - 获取账号：`GET /api/accounts`
   - 删除账号：`DELETE /api/accounts/:id`
   - 设置默认：`POST /api/accounts/:id/set-default`

2. **网页端调用**：
   - 创建账号：`POST /api/publishing/accounts`
   - 获取账号：`GET /api/publishing/accounts`
   - 删除账号：`DELETE /api/publishing/accounts/:id`
   - 设置默认：`POST /api/publishing/accounts/:id/set-default`

3. **WebSocket广播位置**：
   - ✅ `/api/publishing/accounts` 路由有WebSocket广播
   - ❌ `/api/accounts` 路由**没有**WebSocket广播

**结果**：Windows端的操作不会触发WebSocket事件，所以网页端无法收到通知！

## 解决方案

### 统一API端点

将Windows端的API调用统一到 `/api/publishing/accounts`，确保所有操作都触发WebSocket广播。

### 修改的文件

`windows-login-manager/electron/api/client.ts`

#### 1. createAccount 方法

**修改前**：
```typescript
async createAccount(account: CreateAccountInput): Promise<Account> {
  const response = await this.axiosInstance.post<Account>('/api/accounts', account);
  log.info(`Account created: ${account.platform_id}`);
  return response.data;
}
```

**修改后**：
```typescript
async createAccount(account: CreateAccountInput): Promise<Account> {
  // 使用 /api/publishing/accounts 端点，与网页端保持一致
  // 这个端点会触发 WebSocket 广播事件
  const response = await this.axiosInstance.post<any>('/api/publishing/accounts', account);
  log.info(`[API] ✅ Account created: ${account.platform_id}, isNew: ${response.data.isNew}`);
  
  // platformAccounts 返回格式是 { success, data, message, isNew }
  return response.data.data || response.data;
}
```

#### 2. getAccounts 方法

**修改前**：
```typescript
async getAccounts(): Promise<Account[]> {
  const response = await this.axiosInstance.get<Account[]>('/api/accounts');
  log.info(`Retrieved ${response.data.length} accounts`);
  return response.data;
}
```

**修改后**：
```typescript
async getAccounts(): Promise<Account[]> {
  // 使用 /api/publishing/accounts 端点，与网页端保持一致
  const response = await this.axiosInstance.get<any>('/api/publishing/accounts');
  log.info(`[API] ✅ Retrieved ${response.data.data?.length || 0} accounts`);
  
  // platformAccounts 返回格式是 { success, data }
  return response.data.data || response.data;
}
```

#### 3. deleteAccount 方法

**修改前**：
```typescript
async deleteAccount(accountId: number): Promise<void> {
  await this.axiosInstance.delete(`/api/accounts/${accountId}`);
  log.info(`Account deleted: ${accountId}`);
}
```

**修改后**：
```typescript
async deleteAccount(accountId: number): Promise<void> {
  // 使用 /api/publishing/accounts 端点，与网页端保持一致
  await this.axiosInstance.delete(`/api/publishing/accounts/${accountId}`);
  log.info(`[API] ✅ Account deleted: ${accountId}`);
}
```

#### 4. updateAccount 方法

**修改前**：
```typescript
async updateAccount(accountId: number, account: UpdateAccountInput): Promise<Account> {
  const response = await this.axiosInstance.put<Account>(
    `/api/accounts/${accountId}`,
    account
  );
  log.info(`Account updated: ${accountId}`);
  return response.data;
}
```

**修改后**：
```typescript
async updateAccount(accountId: number, account: UpdateAccountInput): Promise<Account> {
  // 使用 /api/publishing/accounts 端点，与网页端保持一致
  const response = await this.axiosInstance.put<any>(
    `/api/publishing/accounts/${accountId}`,
    account
  );
  log.info(`[API] ✅ Account updated: ${accountId}`);
  
  // platformAccounts 返回格式是 { success, data }
  return response.data.data || response.data;
}
```

#### 5. setDefaultAccount 方法

**修改前**：
```typescript
async setDefaultAccount(platformId: string, accountId: number): Promise<void> {
  await this.axiosInstance.post(`/api/accounts/${accountId}/set-default`, {
    platform_id: platformId,
  });
  log.info(`Set default account: ${accountId} for platform: ${platformId}`);
}
```

**修改后**：
```typescript
async setDefaultAccount(platformId: string, accountId: number): Promise<void> {
  // 使用 /api/publishing/accounts 端点，与网页端保持一致
  await this.axiosInstance.post(`/api/publishing/accounts/${accountId}/set-default`, {
    platform_id: platformId,
  });
  log.info(`[API] ✅ Set default account: ${accountId} for platform: ${platformId}`);
}
```

### 关键改进

1. **统一端点**：所有操作都使用 `/api/publishing/accounts`
2. **增强日志**：添加 `[API]` 前缀和 emoji 图标
3. **处理响应格式**：platformAccounts 返回 `{ success, data }`，需要提取 `data` 字段
4. **WebSocket广播**：现在所有操作都会触发WebSocket事件

## 工作流程

### 创建账号流程

```
Windows端登录
    ↓
login-manager.ts: syncAccountToBackend()
    ↓
sync/service.ts: syncAccount()
    ↓
api/client.ts: createAccount()
    ↓
POST /api/publishing/accounts  ← 修改后的端点
    ↓
server/routes/platformAccounts.ts
    ↓
accountService.createOrUpdateAccount()
    ↓
webSocketService.broadcastAccountEvent('created', account)  ← 触发广播
    ↓
WebSocket推送到所有已连接的客户端
    ↓
网页端接收事件
    ↓
自动刷新列表
```

### 删除账号流程

```
Windows端删除
    ↓
api/client.ts: deleteAccount()
    ↓
DELETE /api/publishing/accounts/:id  ← 修改后的端点
    ↓
server/routes/platformAccounts.ts
    ↓
accountService.deleteAccount()
    ↓
webSocketService.broadcastAccountEvent('deleted', { id })  ← 触发广播
    ↓
WebSocket推送到所有已连接的客户端
    ↓
网页端接收事件
    ↓
自动刷新列表
```

## 测试步骤

### 1. 重启Windows登录管理器

```bash
cd windows-login-manager
npm run dev
```

### 2. 测试创建账号

1. 打开网页端（http://localhost:5173）
2. 进入平台管理页面
3. 打开浏览器控制台（F12）
4. 使用Windows端登录任意平台
5. 观察控制台日志

**预期结果**：
```
[WebSocket] 🎉 Account created event received: {...}
检测到新账号创建，正在刷新列表...
```

**后端日志**：
```
[API] ✅ Account created: toutiao, isNew: true
[WebSocket] 📢 Broadcasting account event: account.created
[WebSocket] 📤 Message sent to 1 authenticated clients
```

### 3. 测试删除账号

1. 在Windows端删除一个账号
2. 观察网页端控制台

**预期结果**：
```
[WebSocket] 🗑️ Account deleted event received: {...}
账号已被删除，正在刷新列表...
```

**后端日志**：
```
[API] ✅ Account deleted: 123
[WebSocket] 📢 Broadcasting account event: account.deleted
[WebSocket] 📤 Message sent to 1 authenticated clients
```

### 4. 测试更新账号

1. 在Windows端更新账号信息
2. 观察网页端控制台

**预期结果**：
```
[WebSocket] 📝 Account updated event received: {...}
账号信息已更新，正在刷新列表...
```

## 验证清单

- [ ] Windows端创建账号后，网页端自动刷新
- [ ] Windows端删除账号后，网页端自动刷新
- [ ] Windows端更新账号后，网页端自动刷新
- [ ] 后端日志显示 `[API] ✅` 成功消息
- [ ] 后端日志显示 WebSocket 广播
- [ ] 前端控制台显示接收到事件
- [ ] 页面显示提示消息
- [ ] 列表数据正确更新

## 注意事项

### 响应格式差异

**accounts.ts 路由**（旧端点）：
```json
{
  "id": 1,
  "platform_id": "toutiao",
  "account_name": "test"
}
```

**platformAccounts.ts 路由**（新端点）：
```json
{
  "success": true,
  "data": {
    "id": 1,
    "platform_id": "toutiao",
    "account_name": "test"
  },
  "message": "账号创建成功",
  "isNew": true
}
```

因此需要使用 `response.data.data` 来提取实际的账号数据。

### 兼容性处理

代码中使用了 `response.data.data || response.data` 来兼容两种格式，确保向后兼容。

## 后续优化

### 1. 移除旧的 accounts.ts 路由

如果确认不再需要 `/api/accounts` 端点，可以考虑移除或标记为废弃。

### 2. 统一响应格式

建议所有API端点都使用统一的响应格式：
```json
{
  "success": boolean,
  "data": any,
  "message": string
}
```

### 3. 添加API版本控制

考虑添加API版本控制，避免未来的兼容性问题：
- `/api/v1/accounts`
- `/api/v2/accounts`

## 总结

### 问题

Windows端和网页端使用不同的API端点，导致WebSocket事件不一致。

### 解决

统一Windows端API调用到 `/api/publishing/accounts`，确保所有操作都触发WebSocket广播。

### 效果

✅ Windows端创建账号 → 网页端自动刷新
✅ Windows端删除账号 → 网页端自动刷新
✅ Windows端更新账号 → 网页端自动刷新
✅ 实时同步，无需手动刷新

---

**修复日期**：2025-12-22
**状态**：✅ 已修复，等待测试验证
