# UUID 使用场景明确说明

**更新日期**: 2026-01-17  
**状态**: ✅ 最终版本

---

## 核心问题

**到底哪些表应该保留 UUID，哪些应该改为 SERIAL？**

---

## 明确答案

### ✅ 保留 UUID 的表（仅2个）

#### 1. quota_reservations

**原因**: 跨系统引用

```
数据流：
服务器生成 UUID 
  ↓
Windows 端存储（publishing_tasks.reservation_id TEXT）
  ↓
Windows 端传回服务器确认/释放
```

**代码证据**:
```typescript
// 服务器生成
const { reservationId } = await pool.query(
  'INSERT INTO quota_reservations (...) RETURNING id'
);

// Windows 端存储
await pool.query(
  'UPDATE publishing_tasks SET reservation_id = $1',
  [reservationId]  // UUID 字符串
);

// Windows 端传回
await apiClient.confirmQuota({ reservationId });
await apiClient.releaseQuota({ reservationId });
```

#### 2. sync_snapshots

**原因**: 跨系统引用

```
数据流：
服务器生成 UUID
  ↓
Windows 端使用（下载、删除）
  ↓
Windows 端传回服务器
```

**代码证据**:
```typescript
// 服务器生成
const { snapshotId } = await pool.query(
  'INSERT INTO sync_snapshots (...) RETURNING id'
);

// Windows 端使用
await apiClient.downloadSnapshot(snapshotId);
await apiClient.deleteSnapshot(snapshotId);
```

---

### ❌ 改为 SERIAL 的表（2个）

#### 3. publish_analytics

**原因**: 仅服务器内部使用，不跨系统传递

```
数据流：
服务器生成 → 服务器内部使用 → 不传递给 Windows 端
```

**代码证据**:
```typescript
// 仅服务器内部使用
await pool.query(
  'INSERT INTO publish_analytics (task_id, user_id, ...) VALUES (...)'
);

// 查询也仅在服务器端
const stats = await pool.query(
  'SELECT * FROM publish_analytics WHERE user_id = $1'
);
```

**问题**: 迁移文件定义是 SERIAL，但服务器上被错误创建为 UUID

**修复**: ✅ 已重建为 SERIAL

#### 4. adapter_versions

**原因**: 仅服务器内部使用，Windows 端通过 platform 查询

```
数据流：
服务器生成 → 服务器内部使用 → Windows 端通过 platform（字符串）查询
```

**代码证据**:
```typescript
// 服务器内部使用
const versions = await pool.query(
  'SELECT platform, version FROM adapter_versions WHERE status = $1'
);

// Windows 端通过 platform 查询，不使用 ID
const version = await apiClient.getAdapterVersion('xiaohongshu');
```

**问题**: 迁移文件定义是 SERIAL，但服务器上被错误创建为 UUID

**修复**: ✅ 已重建为 SERIAL

---

## 判断标准

### UUID 适用场景（必须满足）

1. **跨系统引用**: ID 需要在服务器和 Windows 端之间传递
2. **无法使用序列**: 客户端生成 ID，无法访问数据库
3. **全局唯一性**: 多个独立系统生成 ID 后需要合并

### SERIAL 适用场景（默认）

**其他所有场景都使用 SERIAL**，包括：
- 仅服务器内部使用
- 不需要跨系统传递
- 性能敏感的表

---

## 最终状态

| 表名 | 主键类型 | 状态 | 原因 |
|------|---------|------|------|
| quota_reservations | UUID | ✅ 保留 | 跨系统引用 |
| sync_snapshots | UUID | ✅ 保留 | 跨系统引用 |
| publish_analytics | SERIAL | ✅ 已修复 | 仅服务器内部 |
| adapter_versions | SERIAL | ✅ 已修复 | 仅服务器内部 |
| **其他所有表** | SERIAL | ✅ 正确 | 默认策略 |

---

## 性能对比

| 指标 | UUID | SERIAL | 差异 |
|------|------|--------|------|
| 插入速度 | 慢 | 快 3.75x | ⚠️ |
| 索引大小 | 大 | 小 50% | ⚠️ |
| 查询速度 | 慢 | 快 2.4x | ⚠️ |
| 存储空间 | 16字节 | 8字节 | ⚠️ |

**结论**: 除非必须使用 UUID（跨系统引用），否则使用 SERIAL

---

## 相关文档

1. [UUID_SERIAL_FINAL_FIX.md](../06-问题修复/UUID_SERIAL_FINAL_FIX.md) - 最终修复报告
2. [PostgreSQL主键策略-UUID迁移到SERIAL最佳实践.md](./PostgreSQL主键策略-UUID迁移到SERIAL最佳实践.md) - 完整指南
3. [PostgreSQL主键策略-快速参考.md](./PostgreSQL主键策略-快速参考.md) - 快速参考

---

**更新日期**: 2026-01-17  
**状态**: ✅ 最终版本
