# WebSocket账号事件隔离修复

## 问题描述

之前的WebSocket实现存在严重的多租户隔离问题：
- `broadcastAccountEvent` 使用 `broadcastToAll` 方法
- 账号创建/更新/删除事件会广播给**所有连接的用户**
- 导致用户A添加的账号会被用户B看到

## 根本原因

```typescript
// ❌ 错误的实现（修复前）
broadcastAccountEvent(eventType: 'created' | 'updated' | 'deleted', account: any): void {
  this.broadcastToAll(`account.${eventType}`, account);  // 广播给所有用户！
}
```

## 修复方案

```typescript
// ✅ 正确的实现（修复后）
broadcastAccountEvent(eventType: 'created' | 'updated' | 'deleted', account: any, userId?: number): void {
  const targetUserId = userId || account.user_id;
  
  if (!targetUserId) {
    console.warn('[WebSocket] 无法确定账号所属用户，跳过广播');
    return;
  }
  
  // 只广播给账号所属的用户（多租户隔离）
  this.broadcastToUser(targetUserId, `account.${eventType}`, account);
}
```

## 修改的文件

1. **server/src/services/WebSocketService.ts**
   - 修改 `broadcastAccountEvent` 方法，添加 `userId` 参数
   - 使用 `broadcastToUser` 替代 `broadcastToAll`

2. **server/src/routes/accounts.ts**
   - 所有 `broadcastAccountEvent` 调用都传递 `userId`

3. **server/src/routes/platformAccounts.ts**
   - 所有 `broadcastAccountEvent` 调用都传递 `userId`

## 测试步骤

### 1. 重启服务器
```bash
./restart-backend.sh
```

### 2. 测试场景

#### 场景1：用户A添加账号，用户B不应该看到

1. 使用 lzc 账户登录
2. 添加一个新的平台账号（例如：微博）
3. 使用 testuser 账户登录
4. 检查账号列表，**不应该**看到 lzc 添加的微博账号

#### 场景2：用户A删除账号，用户B不应该收到通知

1. 使用 lzc 账户登录
2. 删除一个账号
3. 使用 testuser 账户登录
4. 检查账号列表，**不应该**有任何变化

#### 场景3：用户A更新账号，用户B不应该收到通知

1. 使用 lzc 账户登录
2. 更新一个账号的名称
3. 使用 testuser 账户登录
4. 检查账号列表，**不应该**看到任何更新

## 验证数据库隔离

运行以下命令检查数据库中的账号隔离：

```bash
node -e "const { Pool } = require('pg'); require('dotenv').config(); const pool = new Pool({ connectionString: process.env.DATABASE_URL }); pool.query('SELECT pa.id, pa.platform_id, pa.account_name, pa.real_username, pa.user_id, u.username as owner FROM platform_accounts pa LEFT JOIN users u ON pa.user_id = u.id ORDER BY pa.created_at DESC').then(r => { console.log('平台账号列表:'); r.rows.forEach(a => console.log(\`  ID: \${a.id}, 平台: \${a.platform_id}, 账号名: \${a.account_name}, 真实用户名: \${a.real_username || '未设置'}, 所属用户: \${a.owner} (ID: \${a.user_id})\`)); pool.end(); }).catch(e => { console.error('错误:', e); pool.end(); });"
```

## 预期结果

✅ 每个用户只能看到自己的账号
✅ WebSocket事件只发送给账号所属的用户
✅ 不同用户之间的账号数据完全隔离

## 安全影响

这是一个**严重的安全漏洞**，已修复：
- 🔒 防止用户看到其他用户的账号信息
- 🔒 防止用户接收到其他用户的账号变更通知
- 🔒 确保多租户数据完全隔离

## 相关问题

- 数据库层面的隔离是正确的（每个账号都有 `user_id` 字段）
- API层面的隔离也是正确的（所有查询都过滤 `user_id`）
- 问题仅存在于 WebSocket 实时通知层面
