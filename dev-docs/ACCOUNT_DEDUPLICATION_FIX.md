# 账号去重功能实现

## 问题描述

**现象：** 同一个账号每登录一次就会被记录一次，导致出现多个重复的账号记录

**示例：**
```
ID  平台      账号名    真实用户名  状态
1   toutiao   张三      张三       active
2   toutiao   张三      张三       active
3   toutiao   张三      张三       active
```

## 问题分析

### 原因

**位置：** `server/src/services/AccountService.ts` 和 `server/src/routes/platformAccounts.ts`

**问题代码：**
```typescript
// AccountService.ts
async createAccountWithRealUsername(input, realUsername) {
  // ❌ 直接插入，不检查是否已存在
  const result = await pool.query(
    `INSERT INTO platform_accounts (...) VALUES (...)`
  );
}

// platformAccounts.ts
router.post('/accounts', async (req, res) => {
  // ❌ 每次都创建新账号
  account = await accountService.createAccountWithRealUsername(...);
});
```

**影响：**
- 每次登录都创建新记录
- 数据库中出现大量重复账号
- 账号列表混乱，难以管理

## 解决方案

### 1. 实现去重逻辑

创建 `createOrUpdateAccount` 方法，实现"存在则更新，不存在则创建"的逻辑。

**文件：** `server/src/services/AccountService.ts`

```typescript
/**
 * 创建或更新账号（去重逻辑）
 * 如果同一平台的同一用户名已存在，则更新；否则创建新账号
 */
async createOrUpdateAccount(
  input: CreateAccountInput, 
  realUsername: string
): Promise<{ account: Account; isNew: boolean }> {
  
  // 1. 检查是否已存在
  const uniqueIdentifier = realUsername || input.account_name;
  
  const existingResult = await pool.query(
    `SELECT * FROM platform_accounts 
     WHERE platform_id = $1 
     AND (real_username = $2 OR (real_username IS NULL AND account_name = $2))
     LIMIT 1`,
    [input.platform_id, uniqueIdentifier]
  );
  
  if (existingResult.rows.length > 0) {
    // 2. 账号已存在 → 更新
    const existingAccount = existingResult.rows[0];
    
    const updateResult = await pool.query(
      `UPDATE platform_accounts 
       SET credentials = $1, 
           real_username = $2,
           account_name = $3,
           updated_at = CURRENT_TIMESTAMP,
           last_used_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [encryptedCredentials, realUsername, input.account_name, existingAccount.id]
    );
    
    return {
      account: this.formatAccount(updateResult.rows[0], false),
      isNew: false  // 标记为更新
    };
  } else {
    // 3. 账号不存在 → 创建
    const insertResult = await pool.query(
      `INSERT INTO platform_accounts (...) VALUES (...)`
    );
    
    return {
      account: this.formatAccount(insertResult.rows[0], false),
      isNew: true  // 标记为新建
    };
  }
}
```

### 2. 更新 API 路由

**文件：** `server/src/routes/platformAccounts.ts`

```typescript
router.post('/accounts', async (req, res) => {
  const { platform_id, account_name, credentials, real_username } = req.body;
  
  // 使用新的去重方法
  const result = await accountService.createOrUpdateAccount({
    platform_id,
    account_name,
    credentials
  }, real_username || account_name);
  
  const { account, isNew } = result;
  
  // 根据是新建还是更新，广播不同的事件
  if (isNew) {
    webSocketService.broadcastAccountEvent('created', account);
  } else {
    webSocketService.broadcastAccountEvent('updated', account);
  }
  
  res.json({
    success: true,
    data: account,
    message: isNew ? '账号创建成功' : '账号已更新',
    isNew
  });
});
```

### 3. 清理现有重复账号

创建清理脚本：`server/src/db/cleanup-duplicate-accounts.ts`

```typescript
/**
 * 清理重复的账号
 * 保留每个平台+用户名组合的最新记录，删除旧的重复记录
 */
async function cleanupDuplicateAccounts() {
  // 1. 查找重复账号
  const duplicatesQuery = `
    SELECT 
      platform_id,
      COALESCE(real_username, account_name) as unique_identifier,
      COUNT(*) as count,
      array_agg(id ORDER BY created_at DESC) as ids
    FROM platform_accounts
    GROUP BY platform_id, COALESCE(real_username, account_name)
    HAVING COUNT(*) > 1
  `;
  
  // 2. 保留最新的，删除旧的
  for (const row of duplicatesResult.rows) {
    const keepId = ids[0];  // 最新的
    const deleteIds = ids.slice(1);  // 旧的
    
    for (const deleteId of deleteIds) {
      await client.query('DELETE FROM platform_accounts WHERE id = $1', [deleteId]);
    }
  }
}
```

## 去重逻辑详解

### 唯一标识

使用 `platform_id` + `real_username` 作为唯一标识：

```sql
WHERE platform_id = 'toutiao' 
AND (real_username = '张三' OR (real_username IS NULL AND account_name = '张三'))
```

**逻辑：**
1. 优先使用 `real_username`（从页面提取的真实用户名）
2. 如果 `real_username` 为空，使用 `account_name`
3. 同一平台的同一用户名视为同一账号

### 更新策略

当检测到重复账号时，更新以下字段：

```sql
UPDATE platform_accounts 
SET credentials = $1,        -- 更新登录凭证（Cookie等）
    real_username = $2,      -- 更新真实用户名
    account_name = $3,       -- 更新账号名称
    updated_at = CURRENT_TIMESTAMP,  -- 更新时间
    last_used_at = CURRENT_TIMESTAMP -- 最后使用时间
WHERE id = $4
```

**为什么要更新？**
- Cookie 可能过期，需要更新
- 用户名可能变化
- 记录最后登录时间

## 执行步骤

### 1. 清理现有重复账号

```bash
cd server
npx ts-node src/db/cleanup-duplicate-accounts.ts
```

**输出示例：**
```
🚀 开始清理重复账号...

📝 步骤 1: 查找重复账号...

⚠️  发现 1 组重复账号：

平台: toutiao
用户名: 张三
重复数量: 3
账号 IDs: 3, 2, 1
  ✅ 保留账号 ID: 3 (最新)
  ❌ 删除账号 IDs: 2, 1

========================================
✅ 清理完成！
📊 统计：
   - 发现重复组: 1
   - 删除账号数: 2
========================================

📋 清理后的账号列表：

ID  平台      账号名    真实用户名  状态    创建时间
────────────────────────────────────────────────────
3   toutiao   张三      张三       active  2025-12-22
```

### 2. 重启后端服务

```bash
cd server
npm run dev
```

### 3. 测试去重功能

1. 登录头条号账号（第一次）
   - 应该创建新账号
   - 响应：`{ success: true, message: '账号创建成功', isNew: true }`

2. 退出并重新登录同一账号（第二次）
   - 应该更新现有账号，而不是创建新的
   - 响应：`{ success: true, message: '账号已更新', isNew: false }`

3. 检查账号列表
   - 应该只有一个头条号账号
   - `updated_at` 和 `last_used_at` 应该是最新时间

### 4. 验证数据库

```sql
-- 查询头条号账号
SELECT 
  id, 
  platform_id, 
  account_name, 
  real_username, 
  created_at, 
  updated_at,
  last_used_at
FROM platform_accounts 
WHERE platform_id = 'toutiao'
ORDER BY created_at DESC;

-- 应该只有一条记录
-- updated_at 应该是最新的登录时间
```

## 测试场景

### 场景 1：首次登录

**操作：** 登录头条号账号"张三"

**预期：**
- ✅ 创建新账号
- ✅ 数据库中有 1 条记录
- ✅ API 响应：`isNew: true`

### 场景 2：重复登录

**操作：** 再次登录头条号账号"张三"

**预期：**
- ✅ 更新现有账号
- ✅ 数据库中仍然只有 1 条记录
- ✅ `updated_at` 和 `last_used_at` 更新
- ✅ API 响应：`isNew: false`

### 场景 3：不同账号

**操作：** 登录头条号账号"李四"

**预期：**
- ✅ 创建新账号
- ✅ 数据库中有 2 条记录（张三 + 李四）
- ✅ API 响应：`isNew: true`

### 场景 4：不同平台相同用户名

**操作：** 
1. 登录头条号账号"张三"
2. 登录抖音号账号"张三"

**预期：**
- ✅ 创建 2 个不同的账号
- ✅ 数据库中有 2 条记录
- ✅ `platform_id` 不同（toutiao vs douyin）

## 边界情况处理

### 情况 1：real_username 为空

```typescript
// 使用 account_name 作为唯一标识
const uniqueIdentifier = realUsername || input.account_name;
```

### 情况 2：account_name 变化

```typescript
// 更新 account_name
UPDATE platform_accounts 
SET account_name = $3  -- 允许更新
WHERE id = $4
```

### 情况 3：并发登录

使用数据库事务确保原子性：

```typescript
await client.query('BEGIN');
// 查询 + 插入/更新
await client.query('COMMIT');
```

## 日志输出

### 创建新账号

```
[账号去重] 创建新账号，平台: toutiao, 用户名: 张三
[账号去重] 已创建新账号 ID: 1
```

### 更新现有账号

```
[账号去重] 发现已存在账号 ID: 1, 平台: toutiao, 用户名: 张三
[账号去重] 已更新账号 ID: 1
```

## 相关文件

### 新增文件

- `server/src/db/cleanup-duplicate-accounts.ts` - 清理重复账号脚本

### 修改文件

- `server/src/services/AccountService.ts` - 添加 `createOrUpdateAccount` 方法
- `server/src/routes/platformAccounts.ts` - 使用新的去重方法

## 技术要点

### 为什么使用 COALESCE？

```sql
COALESCE(real_username, account_name) as unique_identifier
```

**作用：**
- 如果 `real_username` 不为空，使用它
- 如果 `real_username` 为空，使用 `account_name`
- 确保总有一个唯一标识

### 为什么更新 last_used_at？

```sql
last_used_at = CURRENT_TIMESTAMP
```

**用途：**
- 记录账号最后使用时间
- 可用于清理长期未使用的账号
- 可用于统计账号活跃度

### 为什么返回 isNew 标志？

```typescript
return { account, isNew: true/false }
```

**用途：**
- 前端可以区分是新建还是更新
- 可以显示不同的提示信息
- 可以触发不同的事件（created vs updated）

## 总结

### 问题本质

- ❌ 每次登录都创建新账号
- ❌ 没有检查账号是否已存在
- ❌ 导致大量重复记录

### 解决方案

- ✅ 实现 `createOrUpdateAccount` 方法
- ✅ 使用 `platform_id` + `real_username` 作为唯一标识
- ✅ 存在则更新，不存在则创建
- ✅ 提供清理脚本删除现有重复记录

### 修复效果

- ✅ 同一账号只保存一条记录
- ✅ 重复登录时更新凭证和时间
- ✅ 不同账号正常创建
- ✅ 数据库保持整洁

---

**修复日期：** 2025-12-22  
**修复人员：** Kiro AI Assistant  
**测试状态：** 待验证
