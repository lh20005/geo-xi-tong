# QuotaSyncService 使用说明

## 概述

`QuotaSyncService` 是一个**通用的配额同步服务**，对**所有配额项目**都有效，不仅仅是存储配额。

## 支持的所有配额项目

### 1. 文章生成配额 (`articles_per_month`)
- **用途**: 每月可生成的文章数量
- **检查点**: 文章生成页面
- **API**: `/api/article-generation/tasks`

### 2. 文章发布配额 (`publish_per_month`)
- **用途**: 每月可发布的文章数量
- **检查点**: 文章发布页面
- **API**: `/api/publishing/publish`

### 3. 平台账号数配额 (`platform_accounts`)
- **用途**: 可添加的平台账号数量
- **检查点**: 平台账号管理页面
- **API**: `/api/platform-accounts`

### 4. 关键词蒸馏配额 (`keyword_distillation`)
- **用途**: 可执行的关键词蒸馏次数
- **检查点**: 关键词蒸馏页面
- **API**: `/api/distillation/distill`

### 5. 企业图库相册数配额 (`gallery_albums`)
- **用途**: 可创建的相册数量
- **检查点**: 企业图库页面
- **API**: `/api/gallery/albums`

### 6. 知识库数配额 (`knowledge_bases`)
- **用途**: 可创建的知识库数量
- **检查点**: 知识库管理页面
- **API**: `/api/knowledge-bases`

### 7. 存储空间配额 (`storage_space`)
- **用途**: 可使用的存储空间（MB）
- **检查点**: 文件上传、图片上传
- **API**: `/api/storage/check-quota`
- **特殊处理**: 需要同步到 `user_storage_usage` 表

## 同步服务的四大功能

### 1. 清除 Redis 缓存 ✅

**作用**: 清除所有配额相关的缓存，确保下次查询使用最新数据

**清除的缓存键**:
```typescript
`user:${userId}:subscription`      // 用户订阅信息缓存
`user:${userId}:quotas`            // 用户配额概览缓存
`user:${userId}:storage`           // 用户存储信息缓存
`storage:usage:${userId}`          // 存储使用量缓存
`quota:check:${userId}:*`          // 所有配额检查结果缓存
```

**影响范围**: **所有配额项目**

### 2. 同步存储配额 ✅

**作用**: 将 `custom_quotas.storage_space` 同步到 `user_storage_usage.storage_quota_bytes`

**代码**:
```typescript
const storageMB = customQuotas.storage_space;
const storageBytes = storageMB === -1 ? -1 : storageMB * 1024 * 1024;

await pool.query(`
  UPDATE user_storage_usage
  SET storage_quota_bytes = $1,
      last_updated_at = CURRENT_TIMESTAMP
  WHERE user_id = $2
`, [storageBytes, userId]);
```

**影响范围**: **仅存储空间配额**（因为存储配额需要额外的表同步）

### 3. 推送 WebSocket 通知 ✅

**作用**: 实时通知前端配额已更新

**推送的事件**:
```typescript
// 1. 配额更新通知（包含所有配额的最新概览）
wsService.broadcast(userId, 'quota_updated', {
  reason,
  overview,  // 包含所有 6 个功能配额的最新数据
  timestamp
});

// 2. 存储配额变更通知（专门针对存储配额）
wsService.broadcast(userId, 'storage_quota_changed', {
  reason,
  timestamp
});
```

**影响范围**: **所有配额项目**

### 4. 刷新配额概览 ✅

**作用**: 预热缓存，调用一次所有配额检查函数

**代码**:
```typescript
const featureCodes = [
  'articles_per_month',
  'publish_per_month',
  'platform_accounts',
  'keyword_distillation',
  'gallery_albums',
  'knowledge_bases'
];

for (const featureCode of featureCodes) {
  await pool.query(`SELECT * FROM check_user_quota($1, $2)`, [userId, featureCode]);
}
```

**影响范围**: **所有配额项目**

## 工作流程

```
调整任意配额
    ↓
调用 QuotaSyncService.syncUserQuota(userId, reason)
    ↓
┌─────────────────────────────────────────────────┐
│ 1. 清除 Redis 缓存                               │
│    影响: 所有配额项目 ✅                          │
│    - 订阅信息缓存                                 │
│    - 配额概览缓存                                 │
│    - 存储信息缓存                                 │
│    - 所有配额检查结果缓存                         │
├─────────────────────────────────────────────────┤
│ 2. 同步存储配额                                   │
│    影响: 仅存储空间配额 ⚠️                        │
│    - custom_quotas.storage_space                │
│    → user_storage_usage.storage_quota_bytes     │
├─────────────────────────────────────────────────┤
│ 3. 推送 WebSocket 通知                           │
│    影响: 所有配额项目 ✅                          │
│    - quota_updated (包含所有配额概览)             │
│    - storage_quota_changed (存储专用)            │
├─────────────────────────────────────────────────┤
│ 4. 刷新配额概览                                   │
│    影响: 所有配额项目 ✅                          │
│    - 预热所有 check_user_quota 查询               │
│    - 确保下次查询快速返回                         │
└─────────────────────────────────────────────────┘
    ↓
所有配额项目立即生效
```

## 使用示例

### 示例 1: 调整文章生成配额

```typescript
// 在 UserSubscriptionManagementService.adjustQuota() 中
await client.query('COMMIT');

// 同步配额到所有系统
const { QuotaSyncService } = await import('./QuotaSyncService');
await QuotaSyncService.syncUserQuota(userId, '配额调整: articles_per_month');
```

**效果**:
- ✅ 清除所有缓存
- ✅ 推送 WebSocket 通知（包含所有配额的最新数据）
- ✅ 刷新所有配额检查（包括 articles_per_month）
- ✅ 文章生成页面立即显示新配额

### 示例 2: 调整存储空间配额

```typescript
// 在 UserSubscriptionManagementService.adjustQuota() 中
await client.query('COMMIT');

// 同步配额到所有系统
const { QuotaSyncService } = await import('./QuotaSyncService');
await QuotaSyncService.syncUserQuota(userId, '配额调整: storage_space');
```

**效果**:
- ✅ 清除所有缓存
- ✅ **同步存储配额到 user_storage_usage 表**（特殊处理）
- ✅ 推送 WebSocket 通知（包含所有配额的最新数据）
- ✅ 推送存储配额变更通知（专门针对存储）
- ✅ 刷新所有配额检查（包括 storage_space）
- ✅ 文件上传页面立即显示新配额

### 示例 3: 调整平台账号数配额

```typescript
// 在 UserSubscriptionManagementService.adjustQuota() 中
await client.query('COMMIT');

// 同步配额到所有系统
const { QuotaSyncService } = await import('./QuotaSyncService');
await QuotaSyncService.syncUserQuota(userId, '配额调整: platform_accounts');
```

**效果**:
- ✅ 清除所有缓存
- ✅ 推送 WebSocket 通知（包含所有配额的最新数据）
- ✅ 刷新所有配额检查（包括 platform_accounts）
- ✅ 平台账号管理页面立即显示新配额

## 为什么存储配额需要特殊处理？

### 其他配额项目

其他配额（文章生成、发布、平台账号等）只需要：
1. 更新 `user_subscriptions.custom_quotas`
2. `check_user_quota` 函数会自动读取 `custom_quotas`
3. 清除缓存后立即生效

### 存储配额的特殊性

存储配额需要额外的表同步：
1. 更新 `user_subscriptions.custom_quotas.storage_space`
2. **必须同步到 `user_storage_usage.storage_quota_bytes`**
3. 因为存储检查使用的是 `user_storage_usage` 表，不是 `check_user_quota` 函数

**原因**:
- 存储配额检查使用 `StorageQuotaService.checkQuota()`
- 该服务直接查询 `user_storage_usage` 表
- 不经过 `check_user_quota` 函数

**解决方案**:
- 方案 1: `QuotaSyncService.syncStorageQuota()` 手动同步
- 方案 2: `trigger_sync_storage_quota` 触发器自动同步（已有）

## 核心修复：check_user_quota 函数

### 修复前 ❌

```sql
-- 只从 plan_features 读取
SELECT pf.feature_value INTO v_feature_value
FROM plan_features pf
WHERE pf.plan_id = v_plan_id AND pf.feature_code = p_feature_code;
```

**问题**: 调整 `custom_quotas` 后不生效

### 修复后 ✅

```sql
-- 优先从 custom_quotas 读取
SELECT us.id, us.plan_id, us.custom_quotas 
INTO v_subscription_id, v_plan_id, v_custom_quotas
FROM user_subscriptions us
WHERE ...

-- 优先使用 custom_quotas
IF v_custom_quotas IS NOT NULL AND v_custom_quotas ? p_feature_code THEN
  v_feature_value := (v_custom_quotas->>p_feature_code)::INTEGER;
ELSE
  -- 如果没有自定义配额，才从 plan_features 获取
  SELECT pf.feature_value INTO v_feature_value
  FROM plan_features pf
  WHERE pf.plan_id = v_plan_id AND pf.feature_code = p_feature_code;
END IF;
```

**效果**: 调整 `custom_quotas` 后立即生效

## 总结

### QuotaSyncService 的作用范围

| 功能 | 影响范围 | 说明 |
|------|---------|------|
| 清除 Redis 缓存 | **所有配额项目** ✅ | 清除所有配额相关缓存 |
| 同步存储配额 | **仅存储空间** ⚠️ | 同步到 user_storage_usage 表 |
| 推送 WebSocket 通知 | **所有配额项目** ✅ | 包含所有配额的最新概览 |
| 刷新配额概览 | **所有配额项目** ✅ | 预热所有配额检查 |

### 关键点

1. ✅ **QuotaSyncService 对所有配额项目都有效**
2. ✅ **核心修复是 check_user_quota 函数**（优先读取 custom_quotas）
3. ⚠️ **存储配额需要额外的表同步**（因为使用不同的查询路径）
4. ✅ **调整任意配额后，所有配额都会刷新**（通过清除缓存和推送通知）

### 使用建议

**在任何配额调整后，都应该调用**:
```typescript
await QuotaSyncService.syncUserQuota(userId, '配额调整原因');
```

这样可以确保：
- 所有配额立即生效
- 前端实时收到通知
- 缓存被正确清除
- 用户体验流畅
