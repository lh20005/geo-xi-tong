# 账号状态管理修复

## 问题

**为什么掉线的系统还是"正常"状态？**

### 原因分析

1. **数据库中的状态没有更新**：
   - `platform_accounts` 表有 `status` 字段（默认值是 'active'）
   - 当检测到Cookie失效时，系统只是抛出错误
   - 但没有将账号状态更新为 'offline' 或 'expired'

2. **前端显示的是数据库状态**：
   - 前端从数据库读取账号信息
   - 显示的是 `status` 字段的值
   - 因为数据库中的状态仍然是 'active'，所以显示"正常"

### 问题流程

```
1. 账号创建时 → status = 'active' → 前端显示"正常" ✅
2. Cookie过期 → 发布失败 ❌
3. 系统检测到掉线 → 抛出错误 ❌
4. 但是 status 仍然是 'active' → 前端仍然显示"正常" ❌ 问题！
```

## 解决方案

### 1. 添加账号状态管理方法

在 `AccountService.ts` 中添加了3个新方法：

```typescript
/**
 * 更新账号状态
 * @param accountId 账号ID
 * @param status 状态：'active' | 'inactive' | 'offline' | 'expired'
 * @param userId 用户ID（用于验证所有权）
 */
async updateAccountStatus(accountId: number, status: 'active' | 'inactive' | 'offline' | 'expired', userId?: number): Promise<void>

/**
 * 标记账号为掉线状态
 * @param accountId 账号ID
 * @param reason 掉线原因
 */
async markAccountOffline(accountId: number, reason: string = 'Cookie已失效'): Promise<void>

/**
 * 标记账号为在线状态（登录成功后调用）
 * @param accountId 账号ID
 */
async markAccountOnline(accountId: number): Promise<void>
```

### 2. 在发布流程中更新状态

在 `PublishingExecutor.ts` 中，检测到掉线时更新账号状态：

```typescript
// 验证Cookie是否有效
loginSuccess = await adapter.performLogin(page!, account.credentials);

if (loginSuccess) {
  // ✅ 登录成功 → 标记为在线
  await accountService.markAccountOnline(account.id);
} else {
  // ❌ 登录失败 → 标记为掉线
  await accountService.markAccountOffline(account.id, 'Cookie已失效或平台已掉线');
  throw new Error(`${adapter.platformName} Cookie已失效，请重新登录`);
}
```

### 3. 更新前端显示

在前端组件中支持更多状态显示：

#### AccountManagementModal.tsx

```typescript
<Tag color={
  account.status === 'active' ? 'green' : 
  account.status === 'offline' ? 'red' : 
  account.status === 'expired' ? 'orange' : 
  'default'
}>
  {account.status === 'active' ? '正常' : 
   account.status === 'offline' ? '已掉线' : 
   account.status === 'expired' ? 'Cookie已过期' : 
   '未激活'}
</Tag>
```

#### PlatformManagementPage.tsx

```typescript
<Tag color={
  status === 'active' ? 'success' : 
  status === 'offline' ? 'error' : 
  status === 'expired' ? 'warning' : 
  'default'
}>
  {status === 'active' ? '正常' : 
   status === 'offline' ? '已掉线' : 
   status === 'expired' ? 'Cookie已过期' : 
   '未激活'}
</Tag>
```

## 账号状态说明

| 状态 | 值 | 颜色 | 说明 |
|------|---|------|------|
| 正常 | `active` | 绿色 | 账号在线，Cookie有效 |
| 已掉线 | `offline` | 红色 | Cookie已失效或平台已掉线 |
| Cookie已过期 | `expired` | 橙色 | Cookie过期，需要重新登录 |
| 未激活 | `inactive` | 灰色 | 账号未激活或已禁用 |

## 修复后的流程

```
1. 账号创建时 → status = 'active' → 前端显示"正常" ✅
2. Cookie过期 → 发布失败 ❌
3. 系统检测到掉线 → 抛出错误 ❌
4. 🔥 更新 status = 'offline' → 前端显示"已掉线" ✅ 修复！
5. 用户重新登录 → status = 'active' → 前端显示"正常" ✅
```

## 使用示例

### 1. 检测到掉线时

```typescript
// 在 PublishingExecutor 中
if (!loginSuccess) {
  // 标记账号为掉线
  await accountService.markAccountOffline(account.id, 'Cookie已失效');
  throw new Error('Cookie已失效，请重新登录');
}
```

### 2. 登录成功时

```typescript
// 在 PublishingExecutor 中
if (loginSuccess) {
  // 标记账号为在线
  await accountService.markAccountOnline(account.id);
}
```

### 3. 手动更新状态

```typescript
// 在 AccountService 中
await accountService.updateAccountStatus(accountId, 'offline', userId);
```

## 数据库状态

### 查询账号状态

```sql
SELECT id, platform_id, account_name, status, updated_at 
FROM platform_accounts 
WHERE user_id = 1;
```

### 手动更新状态

```sql
-- 标记为掉线
UPDATE platform_accounts 
SET status = 'offline', updated_at = CURRENT_TIMESTAMP 
WHERE id = 123;

-- 标记为在线
UPDATE platform_accounts 
SET status = 'active', updated_at = CURRENT_TIMESTAMP 
WHERE id = 123;
```

## 前端效果

### 之前 ❌

```
账号列表：
- 抖音账号1 [正常] ← 实际已掉线，但显示正常
- 头条账号1 [正常] ← 实际已掉线，但显示正常
```

### 现在 ✅

```
账号列表：
- 抖音账号1 [已掉线] ← 准确显示掉线状态
- 头条账号1 [正常] ← 准确显示在线状态
```

## 自动恢复机制

当用户重新登录时，系统会自动将状态更新为 'active'：

```typescript
// 浏览器登录成功后
const account = await accountService.createOrUpdateAccount(...);
// 账号状态自动设置为 'active'

// 或者在发布时检测到登录成功
if (loginSuccess) {
  await accountService.markAccountOnline(account.id);
  // 状态更新为 'active'
}
```

## 相关文件

### 后端

1. `server/src/services/AccountService.ts` - 添加了状态管理方法
2. `server/src/services/PublishingExecutor.ts` - 在检测到掉线时更新状态

### 前端

1. `client/src/components/Publishing/AccountManagementModal.tsx` - 更新状态显示
2. `client/src/pages/PlatformManagementPage.tsx` - 更新状态显示

### 数据库

1. `platform_accounts` 表的 `status` 字段

## 测试步骤

### 1. 测试掉线检测

1. 创建一个账号（状态应该是"正常"）
2. 手动删除Cookie或等待Cookie过期
3. 尝试发布文章
4. 系统应该检测到掉线并更新状态为"已掉线"
5. 前端应该显示"已掉线"状态（红色标签）

### 2. 测试状态恢复

1. 对于"已掉线"的账号
2. 重新登录（浏览器登录）
3. 状态应该自动更新为"正常"
4. 前端应该显示"正常"状态（绿色标签）

### 3. 测试发布流程

1. 使用"正常"状态的账号发布
2. 发布成功后，状态应该保持"正常"
3. 使用"已掉线"状态的账号发布
4. 应该立即报错，不浪费时间

## 总结

### ✅ 已修复

1. 添加了账号状态管理方法
2. 在检测到掉线时自动更新状态
3. 在登录成功时自动恢复状态
4. 前端准确显示账号状态

### 🎯 核心改进

**之前**：掉线的账号仍然显示"正常"，用户不知道需要重新登录

**现在**：掉线的账号立即显示"已掉线"，用户一目了然

### 💡 效果

- ✅ 用户可以立即看到哪些账号需要重新登录
- ✅ 避免使用掉线的账号发布，浪费时间
- ✅ 状态自动更新，无需手动维护
- ✅ 支持多种状态，更精确的状态管理
