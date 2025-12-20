# 账号名称显示功能修复

## 问题描述

发布任务页面加载失败，错误信息：
```
error: invalid input syntax for type json
Token "auSwMd" is invalid.
```

## 根本原因

数据库中的 `platform_accounts.credentials` 字段存储的是**加密后的文本**，而不是明文 JSON。

之前的实现尝试在 SQL 查询中直接使用 `credentials::jsonb` 进行 JSON 操作：
```sql
COALESCE(
  pa.credentials::jsonb->'userInfo'->>'username',
  pa.credentials::jsonb->>'username'
) as real_username
```

这会导致 PostgreSQL 尝试将加密文本解析为 JSON，从而失败。

## 解决方案

修改实现方式，将解密和提取逻辑从 SQL 层移到应用层：

### 1. 后端服务层修改

**文件**: `server/src/services/PublishingService.ts`

**修改内容**:
1. 添加 `encryptionService` 导入
2. SQL 查询只获取加密的 `credentials` 字段
3. 在 `formatTask()` 方法中解密并提取 `real_username`

**实现代码**:
```typescript
// 导入加密服务
import { encryptionService } from './EncryptionService';

// SQL 查询
SELECT 
  pt.*,
  pa.account_name,
  pa.credentials  -- 获取加密的凭证
FROM publishing_tasks pt
LEFT JOIN platform_accounts pa ON pt.account_id = pa.id

// formatTask 方法中解密
private formatTask(row: any): PublishingTask {
  const task: PublishingTask = { /* ... */ };
  
  // 解密并提取真实用户名
  if (row.credentials) {
    try {
      const decryptedCredentials = encryptionService.decryptObject(row.credentials);
      if (decryptedCredentials.userInfo && decryptedCredentials.userInfo.username) {
        task.real_username = decryptedCredentials.userInfo.username;
      } else if (decryptedCredentials.username && decryptedCredentials.username !== 'browser_login') {
        task.real_username = decryptedCredentials.username;
      }
    } catch (error) {
      console.error('解密账号凭证失败:', error);
    }
  }
  
  return task;
}
```

### 2. 发布记录路由修改

**文件**: `server/src/routes/publishingRecords.ts`

**修改内容**:
1. 添加 `encryptionService` 导入
2. SQL 查询只获取加密的 `credentials` 字段
3. 在返回数据前解密并提取 `real_username`
4. 删除 `credentials` 字段，不返回给前端

**实现代码**:
```typescript
// 导入加密服务
import { encryptionService } from '../services/EncryptionService';

// 处理查询结果
const records = dataResult.rows.map(row => {
  const record: any = { ...row };
  delete record.credentials; // 不返回加密的凭证
  
  if (row.credentials) {
    try {
      const decryptedCredentials = encryptionService.decryptObject(row.credentials);
      if (decryptedCredentials.userInfo && decryptedCredentials.userInfo.username) {
        record.real_username = decryptedCredentials.userInfo.username;
      } else if (decryptedCredentials.username && decryptedCredentials.username !== 'browser_login') {
        record.real_username = decryptedCredentials.username;
      }
    } catch (error) {
      console.error('解密账号凭证失败:', error);
    }
  }
  
  return record;
});
```

## 数据流程

### 修复前（错误）
```
数据库 (加密文本) 
  → SQL 尝试 ::jsonb 转换 ❌ 
  → 失败：invalid input syntax for type json
```

### 修复后（正确）
```
数据库 (加密文本) 
  → SQL 查询获取加密文本 ✅
  → 应用层解密 ✅
  → 提取 real_username ✅
  → 返回给前端 ✅
```

## 安全性考虑

1. **不返回加密凭证**: 在返回数据前删除 `credentials` 字段
2. **解密失败处理**: 使用 try-catch 捕获解密错误，不影响其他数据
3. **后备机制**: 如果无法获取 `real_username`，前端会使用 `account_name` 作为后备

## 测试验证

### 测试步骤
1. 访问发布任务页面 `/publishing-tasks`
2. 验证页面正常加载
3. 检查"账号名称"列显示真实用户名（如"细品茶香韵"）
4. 访问发布记录页面 `/publishing-records`
5. 验证页面正常加载
6. 检查"账号名称"列显示真实用户名

### 预期结果
- ✅ 页面正常加载，无错误
- ✅ "账号名称"列显示平台真实用户名
- ✅ 如果账号被删除，显示 "-"
- ✅ 服务器日志无错误信息

## 修改文件清单

- ✅ `server/src/services/PublishingService.ts` - 添加解密逻辑
- ✅ `server/src/routes/publishingRecords.ts` - 添加解密逻辑（3处）

## 技术要点

1. **加密存储**: `credentials` 字段使用 AES 加密存储
2. **应用层解密**: 必须在应用层使用 `encryptionService.decryptObject()` 解密
3. **JSON 操作**: 只能在解密后的对象上进行 JSON 操作
4. **错误处理**: 解密失败时优雅降级，不影响其他功能

## 相关文档

- `dev-docs/ACCOUNT_NAME_DISPLAY_TEST.md` - 测试指南
- `dev-docs/ACCOUNT_NAME_DISPLAY_COMPLETE.md` - 完成报告
- `.kiro/specs/account-name-display-improvements/` - 功能规格

## 服务器状态

✅ 服务器已重启并成功运行在 http://localhost:3000
✅ 所有修改已生效，可以正常访问发布任务和发布记录页面
