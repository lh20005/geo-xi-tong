# 账号状态更新测试

## 问题

代码中添加了 `markAccountOffline()` 调用，但实际发布失败时账号状态没有更新。

## 可能的原因

1. **代码没有被执行到**：
   - 可能在抛出错误之前就被 catch 捕获了
   - 或者 `loginSuccess` 的值不是 `false`

2. **数据库约束问题**（已修复）：
   - 之前使用了 `offline` 状态，但数据库只允许 `active`, `inactive`, `expired`, `error`
   - 已修改为使用 `expired` 状态

3. **代码还没有重新编译**：
   - 使用 `tsx watch` 应该会自动重新加载
   - 但可能需要手动重启

## 测试步骤

### 1. 手动测试数据库更新

```sql
-- 测试更新为 expired
UPDATE platform_accounts SET status = 'expired' WHERE id = 192;

-- 查看结果
SELECT id, platform_id, account_name, status FROM platform_accounts WHERE id = 192;
```

结果：✅ 成功，状态已更新为 `expired`

### 2. 检查前端显示

前端应该显示：
- `expired` → "Cookie已过期"（橙色）
- `error` → "登录失败"（红色）
- `active` → "正常"（绿色）

### 3. 测试实际发布流程

1. 使用一个已掉线的账号（Cookie已过期）
2. 尝试发布文章
3. 查看日志：
   ```
   🔍 验证登录状态...
   ❌ 未检测到登录标志，可能未登录或已掉线
   ❌ 抖音 Cookie已失效或平台已掉线
   ```
4. 检查数据库：
   ```sql
   SELECT id, platform_id, status, updated_at 
   FROM platform_accounts 
   WHERE id = 192;
   ```

## 调试方法

### 方法1：添加更多日志

在 `PublishingExecutor.ts` 中添加日志：

```typescript
if (loginSuccess) {
  console.log(`[DEBUG] 登录成功，标记账号 ${account.id} 为在线`);
  await publishingService.logMessage(taskId, 'info', `✅ ${adapter.platformName} Cookie有效，已登录`);
  await accountService.markAccountOnline(account.id);
} else {
  console.log(`[DEBUG] 登录失败，标记账号 ${account.id} 为掉线`);
  await publishingService.logMessage(taskId, 'error', `❌ ${adapter.platformName} Cookie已失效或平台已掉线`);
  await accountService.markAccountOffline(account.id, 'Cookie已失效或平台已掉线');
  throw new Error(`${adapter.platformName} Cookie已失效，请重新登录`);
}
```

### 方法2：检查 AccountService 日志

在 `AccountService.ts` 中已经有日志：

```typescript
console.log(`[AccountService] 标记账号为掉线: ID=${accountId}, reason=${reason}`);
// ...
console.log(`[AccountService] 账号已标记为掉线（expired）: ID=${accountId}`);
```

查看服务器日志：
```bash
# 查看最近的日志
tail -f server/logs/server.log | grep AccountService

# 或者查看控制台输出
# 如果使用 tsx watch，日志会输出到控制台
```

### 方法3：直接测试 AccountService

创建一个测试脚本：

```typescript
// test-account-status.ts
import { accountService } from './services/AccountService';

async function test() {
  try {
    console.log('测试标记账号为掉线...');
    await accountService.markAccountOffline(192, '测试掉线');
    console.log('✅ 成功');
    
    console.log('测试标记账号为在线...');
    await accountService.markAccountOnline(192);
    console.log('✅ 成功');
  } catch (error) {
    console.error('❌ 失败:', error);
  }
}

test();
```

## 当前状态

### 数据库约束

```sql
\d platform_accounts

Check constraints:
    "platform_accounts_status_check" CHECK (status::text = ANY (ARRAY[
        'active'::character varying, 
        'inactive'::character varying, 
        'expired'::character varying, 
        'error'::character varying
    ]::text[]))
```

### 允许的状态值

| 值 | 说明 | 前端显示 | 颜色 |
|---|------|---------|------|
| `active` | 正常在线 | "正常" | 绿色 |
| `inactive` | 未激活 | "未激活" | 灰色 |
| `expired` | Cookie已过期 | "Cookie已过期" | 橙色 |
| `error` | 登录失败 | "登录失败" | 红色 |

### 代码修改

1. ✅ `AccountService.ts` - 使用 `expired` 代替 `offline`
2. ✅ `PublishingExecutor.ts` - 调用 `markAccountOffline()`
3. ✅ `AccountManagementModal.tsx` - 支持 `expired` 和 `error` 状态
4. ✅ `PlatformManagementPage.tsx` - 支持 `expired` 和 `error` 状态

## 下一步

1. **重启服务器**（如果自动重载没有生效）：
   ```bash
   # 停止当前服务器
   # 重新启动
   npm run server:dev
   ```

2. **测试发布流程**：
   - 使用已掉线的账号发布
   - 查看日志和数据库状态

3. **验证前端显示**：
   - 刷新前端页面
   - 查看账号列表中的状态标签

## 预期结果

当发布失败（Cookie已过期）时：

1. **日志输出**：
   ```
   🔍 验证登录状态...
   ❌ 未检测到登录标志，可能未登录或已掉线
   ❌ 抖音 Cookie已失效或平台已掉线
   [AccountService] 标记账号为掉线: ID=192, reason=Cookie已失效或平台已掉线
   [AccountService] 账号已标记为掉线（expired）: ID=192
   ```

2. **数据库状态**：
   ```sql
   SELECT status FROM platform_accounts WHERE id = 192;
   -- 结果: expired
   ```

3. **前端显示**：
   - 账号列表中显示 "Cookie已过期"（橙色标签）
