# 测试存储空间上传修复

## 问题描述
用户反馈：明明有存储空间，但上传时提示空间不足

## 修复内容

### 1. 类型转换问题修复
**文件**: `server/src/services/StorageQuotaService.ts`

**问题**: PostgreSQL 的 BIGINT 类型在 Node.js 中可能被返回为字符串，导致数值计算错误

**修复**:
- 使用 `Number()` 替代 `parseInt()` 进行类型转换
- 添加详细的日志输出，便于调试
- 改进错误提示信息，显示可用空间

```typescript
// 修复前
const afterUploadBytes = usage.totalStorageBytes + fileSizeBytes;

// 修复后
const currentUsage = Number(usage.totalStorageBytes);
const afterUploadBytes = currentUsage + fileSizeBytes;
```

### 2. StorageService 类型转换增强
**文件**: `server/src/services/StorageService.ts`

**修复**:
- 统一使用 `Number()` 进行类型转换
- 添加默认值处理（`|| 0`）
- 添加调试日志，输出原始值和类型信息

### 3. 其他修复
- 修复 `SchedulerService.ts` 中的重复函数定义
- 更新所有 feature_code 从 `_per_day` 到 `_per_month`

## 测试步骤

### 1. 检查用户存储状态
```bash
# 在浏览器控制台或通过 API 测试
GET /api/storage/usage
```

预期响应：
```json
{
  "usage": {
    "totalStorageBytes": 0,
    "storageQuotaBytes": 104857600,  // 100MB
    "purchasedStorageBytes": 0,
    "availableBytes": 104857600,
    "usagePercentage": 0
  }
}
```

### 2. 测试图片上传
1. 登录系统
2. 进入"企业图库"
3. 创建或选择一个相册
4. 尝试上传图片（小于可用空间）

**预期结果**: 
- ✅ 上传成功
- ✅ 存储使用量正确更新
- ✅ 控制台显示详细的配额检查日志

### 3. 测试文档上传
1. 进入"企业知识库"
2. 创建或选择一个知识库
3. 尝试上传文档（小于可用空间）

**预期结果**:
- ✅ 上传成功
- ✅ 存储使用量正确更新

### 4. 查看控制台日志
后端日志应该显示：
```
[StorageService] 用户存储使用: {
  userId: 1,
  totalStorageBytes: 0,
  storageQuotaBytes: 104857600,
  purchasedStorageBytes: 0,
  effectiveQuota: 104857600,
  rawTotal: '0',
  rawQuota: '104857600',
  totalType: 'string',
  quotaType: 'string'
}

[StorageQuotaService] 配额检查: {
  userId: 1,
  currentUsage: 0,
  quotaBytes: 104857600,
  purchasedBytes: 0,
  effectiveQuota: 104857600,
  fileSizeBytes: 1048576,
  currentUsageType: 'string',
  quotaBytesType: 'string'
}

[StorageQuotaService] 检查结果: {
  afterUploadBytes: 1048576,
  allowed: true,
  availableBytes: 104857600,
  needBytes: 1048576
}
```

## 验证修复

### 场景 1: 空间充足
- 用户配额: 100MB
- 已使用: 0MB
- 上传文件: 5MB
- **预期**: ✅ 允许上传

### 场景 2: 空间不足
- 用户配额: 100MB
- 已使用: 98MB
- 上传文件: 5MB
- **预期**: ❌ 拒绝上传，提示"可用 2MB，本次上传需要 5MB"

### 场景 3: 无限配额
- 用户配额: -1（无限）
- 上传任意大小文件
- **预期**: ✅ 始终允许上传

## 重启服务

```bash
# 重启后端服务
npm run server:dev

# 或使用命令脚本
./重启GEO系统.command
```

## 问题排查

如果问题仍然存在：

1. **检查数据库数据类型**
```sql
SELECT 
  user_id,
  total_storage_bytes,
  storage_quota_bytes,
  purchased_storage_bytes,
  pg_typeof(total_storage_bytes) as total_type,
  pg_typeof(storage_quota_bytes) as quota_type
FROM user_storage_usage
WHERE user_id = YOUR_USER_ID;
```

2. **检查 Redis 缓存**
```bash
redis-cli
> GET storage:user:YOUR_USER_ID
> DEL storage:user:YOUR_USER_ID  # 清除缓存
```

3. **查看后端日志**
- 查找 `[StorageQuotaService]` 和 `[StorageService]` 的日志
- 确认类型转换是否正确
- 检查计算结果

## 修复确认

✅ 类型转换问题已修复
✅ 日志输出已增强
✅ 错误提示已改进
✅ 代码已编译通过

**状态**: 修复完成，等待测试验证
