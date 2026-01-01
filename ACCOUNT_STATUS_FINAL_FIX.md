# 账号状态显示问题 - 最终修复

## 问题

**为什么掉线的系统还是"正常"状态？**

## 根本原因

发现了两个问题：

### 1. 数据库约束冲突 ✅ 已修复

**错误信息**：
```
new row for relation "platform_accounts" violates check constraint "platform_accounts_status_check"
```

**原因**：
- 代码使用了 `offline` 状态
- 但数据库约束只允许：`active`, `inactive`, `expired`, `error`

**解决方案**：
- 将 `offline` 改为 `expired`（Cookie已过期）
- 或使用 `error`（登录失败）

### 2. 代码可能没有被执行

需要确认：
1. 服务器是否已重新加载新代码
2. `markAccountOffline()` 是否被正确调用
3. 是否有错误被捕获导致代码没有执行

## 修复内容

### 1. 后端修改

#### AccountService.ts

```typescript
/**
 * 标记账号为掉线状态（使用 'expired' 状态）
 */
async markAccountOffline(accountId: number, reason: string = 'Cookie已失效'): Promise<void> {
  console.log(`[AccountService] 标记账号为掉线: ID=${accountId}, reason=${reason}`);
  
  await pool.query(
    `UPDATE platform_accounts 
     SET status = 'expired',  // 使用 expired 代替 offline
         updated_at = CURRENT_TIMESTAMP 
     WHERE id = $1`,
    [accountId]
  );
  
  console.log(`[AccountService] 账号已标记为掉线（expired）: ID=${accountId}`);
}
```

#### PublishingExecutor.ts

```typescript
if (loginSuccess) {
  await accountService.markAccountOnline(account.id);
} else {
  // 🔥 关键：标记账号为掉线
  await accountService.markAccountOffline(account.id, 'Cookie已失效或平台已掉线');
  throw new Error(`${adapter.platformName} Cookie已失效，请重新登录`);
}
```

### 2. 前端修改

#### AccountManagementModal.tsx & PlatformManagementPage.tsx

```typescript
<Tag color={
  account.status === 'active' ? 'green' : 
  account.status === 'expired' ? 'orange' :  // Cookie已过期
  account.status === 'error' ? 'red' :       // 登录失败
  'default'
}>
  {account.status === 'active' ? '正常' : 
   account.status === 'expired' ? 'Cookie已过期' : 
   account.status === 'error' ? '登录失败' : 
   '未激活'}
</Tag>
```

## 状态说明

| 数据库值 | 前端显示 | 颜色 | 说明 |
|---------|---------|------|------|
| `active` | 正常 | 绿色 | 账号在线，Cookie有效 |
| `expired` | Cookie已过期 | 橙色 | Cookie失效，需要重新登录 |
| `error` | 登录失败 | 红色 | 登录过程出错 |
| `inactive` | 未激活 | 灰色 | 账号未激活或已禁用 |

## 测试步骤

### 1. 手动测试（验证修复）

```sql
-- 手动设置账号为过期状态
UPDATE platform_accounts SET status = 'expired' WHERE id = 192;

-- 查看结果
SELECT id, platform_id, account_name, status FROM platform_accounts WHERE id = 192;
```

**结果**：✅ 成功，状态更新为 `expired`

### 2. 重启服务器

确保新代码生效：

```bash
# 方法1：如果使用 tsx watch，代码应该自动重载
# 方法2：手动重启
# 停止当前服务器，然后重新启动
npm run server:dev
```

### 3. 测试实际发布

1. 使用一个Cookie已过期的账号
2. 尝试发布文章
3. 查看日志应该显示：
   ```
   🔍 验证登录状态...
   ❌ 未检测到登录标志，可能未登录或已掉线
   ❌ 抖音 Cookie已失效或平台已掉线
   [AccountService] 标记账号为掉线: ID=192
   [AccountService] 账号已标记为掉线（expired）: ID=192
   ```
4. 查看数据库：
   ```sql
   SELECT status FROM platform_accounts WHERE id = 192;
   -- 应该是: expired
   ```
5. 刷新前端，应该显示 "Cookie已过期"（橙色标签）

## 验证清单

- [x] 数据库约束问题已修复（使用 `expired` 代替 `offline`）
- [x] 后端代码已更新（AccountService.ts）
- [x] 发布流程已更新（PublishingExecutor.ts）
- [x] 前端显示已更新（AccountManagementModal.tsx, PlatformManagementPage.tsx）
- [x] TypeScript编译通过
- [ ] 服务器已重启（需要确认）
- [ ] 实际发布测试（需要用户测试）

## 下一步

1. **确认服务器已重启**：
   - 检查控制台是否有新的日志输出
   - 或手动重启服务器

2. **测试发布流程**：
   - 使用已掉线的账号发布
   - 观察日志输出
   - 检查数据库状态
   - 验证前端显示

3. **如果仍然不工作**：
   - 检查服务器日志中是否有 `[AccountService]` 相关的输出
   - 确认 `markAccountOffline()` 是否被调用
   - 检查是否有其他错误阻止了代码执行

## 相关文件

- `server/src/services/AccountService.ts` - 状态管理方法
- `server/src/services/PublishingExecutor.ts` - 调用状态更新
- `client/src/components/Publishing/AccountManagementModal.tsx` - 前端显示
- `client/src/pages/PlatformManagementPage.tsx` - 前端显示
- `ACCOUNT_STATUS_FIX.md` - 详细修复文档
- `TEST_ACCOUNT_STATUS.md` - 测试指南
