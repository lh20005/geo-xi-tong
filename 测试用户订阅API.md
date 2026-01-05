# 测试用户订阅管理 API

## 问题诊断结果

### 根本原因
用户 437 和 6591 **没有活跃的订阅记录**，因此 API 应该返回 404，而不是 500。

### 测试结果

运行 `npx tsx server/src/scripts/test-subscription-detail.ts` 的结果：

```
=== 测试用户 437 ===
❌ 用户 437 没有活跃的订阅
   用户存在: testuser
   订阅记录数: 0

=== 测试用户 6591 ===
❌ 用户 6591 没有活跃的订阅
   用户存在: newuser123
   订阅记录数: 0

=== 查找有活跃订阅的用户 ===
✅ 找到 5 个有活跃订阅的用户:
   - 用户 1 (lzc2005): 状态=active, 结束时间=2026-02-04
```

### 解决方案

**需要重启后端服务器**以加载新的路由和数据库函数。

## 测试步骤

### 1. 重启后端服务器

```bash
# 停止当前服务器（Ctrl+C）
# 然后重新启动
npm run server:dev
```

### 2. 测试有活跃订阅的用户

使用用户 ID 1（lzc2005）进行测试，该用户有活跃订阅：

```bash
# 在浏览器开发者工具中，或使用 curl
# 需要管理员 token
curl http://localhost:3000/api/admin/user-subscriptions/1 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**预期响应**：
```json
{
  "success": true,
  "data": {
    "subscription_id": 7,
    "plan_id": 2,
    "plan_code": "professional",
    "plan_name": "专业版",
    "price": "0.01",
    "status": "active",
    "start_date": "2026-01-04T02:37:57.885Z",
    "end_date": "2026-02-04T02:37:57.885Z",
    "days_remaining": 30,
    "is_paused": false,
    "paused_at": null,
    "pause_reason": null,
    "is_gift": false,
    "custom_quotas": null,
    "features": [
      {
        "feature_code": "articles_per_month",
        "feature_name": "每月生成文章数",
        "current_usage": 2,
        "feature_value": 100,
        "usage_percentage": 2
      },
      ...
    ]
  }
}
```

### 3. 测试没有订阅的用户

```bash
curl http://localhost:3000/api/admin/user-subscriptions/437 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**预期响应**：
```json
{
  "success": false,
  "message": "用户没有活跃的订阅"
}
```

**HTTP 状态码**：404（而不是 500）

## 前端测试

### 在用户管理页面

1. 打开用户管理页面
2. 点击用户 1（lzc2005）的"订阅详情"按钮
3. 应该能看到完整的订阅信息和配额使用情况

### 对于没有订阅的用户

1. 点击用户 437 或 6591 的"订阅详情"按钮
2. 应该显示友好的提示："用户没有活跃的订阅"
3. 可以选择"赠送套餐"来为用户创建订阅

## 为测试用户创建订阅

如果需要为用户 437 或 6591 创建订阅进行测试：

### 方法 1：通过前端赠送套餐

1. 在用户管理页面，点击用户的"操作"按钮
2. 选择"赠送套餐"
3. 选择套餐、天数和原因
4. 提交后即可创建订阅

### 方法 2：通过 SQL 直接创建

```sql
-- 为用户 437 创建一个专业版订阅（30天）
INSERT INTO user_subscriptions (user_id, plan_id, status, start_date, end_date, is_gift, gift_reason)
VALUES (
  437,
  2,  -- 专业版
  'active',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP + INTERVAL '30 days',
  TRUE,
  '测试订阅'
);
```

## API 端点列表

所有端点都需要管理员权限：

- `GET /api/admin/user-subscriptions/:userId` - 获取订阅详情
- `POST /api/admin/user-subscriptions/:userId/upgrade` - 升级套餐
- `POST /api/admin/user-subscriptions/:userId/extend` - 延期订阅
- `POST /api/admin/user-subscriptions/:userId/adjust-quota` - 调整配额
- `POST /api/admin/user-subscriptions/:userId/reset-quota` - 重置配额
- `POST /api/admin/user-subscriptions/:userId/pause` - 暂停订阅
- `POST /api/admin/user-subscriptions/:userId/resume` - 恢复订阅
- `POST /api/admin/user-subscriptions/:userId/cancel` - 取消订阅
- `POST /api/admin/user-subscriptions/:userId/gift` - 赠送套餐
- `GET /api/admin/user-subscriptions/:userId/history` - 获取调整历史

## 注意事项

1. **500 错误 vs 404 错误**：
   - 如果仍然看到 500 错误，说明服务器还没有重启
   - 重启后应该看到 404 错误（对于没有订阅的用户）

2. **前端错误处理**：
   - 前端应该优雅地处理 404 响应
   - 显示"用户没有活跃的订阅"而不是错误信息

3. **WebSocket 通知**：
   - 所有订阅操作都会通过 WebSocket 实时通知用户
   - 确保 WebSocket 连接正常

## 相关文件

- `server/src/routes/admin/userSubscriptions.ts` - 路由处理
- `server/src/services/UserSubscriptionManagementService.ts` - 业务逻辑
- `server/src/db/migrations/027_add_subscription_management.sql` - 数据库结构
- `server/src/scripts/test-subscription-detail.ts` - 测试脚本
- `client/src/components/UserSubscription/` - 前端组件
