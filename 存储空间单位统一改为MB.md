# 存储空间单位统一改为 MB

## 问题描述

当前系统中存储空间在不同位置使用不同的单位：
- 落地页（8080端口）：显示为 `1073741824bytes`
- 商品管理：显示为 bytes
- 用户管理：显示为 bytes
- 数据库：部分使用 bytes，部分使用 MB

需要统一改为 MB 单位，便于用户理解和操作。

## 影响范围

### 1. 数据库层
- ✅ `plan_features` 表中 `storage_space` 已经是 MB 单位（migration 020）
- ❌ `user_storage_usage` 表仍使用 bytes
- ❌ 数据库函数返回值为 bytes

### 2. 后端 API
- ❌ 存储服务返回 bytes
- ❌ 配额检查使用 bytes
- ❌ 订阅服务返回 bytes

### 3. 前端显示
- ❌ 落地页显示原始 bytes 值
- ❌ 商品管理显示 bytes
- ❌ 用户管理显示 bytes
- ✅ 个人中心使用 formatBytes 格式化（但需要转换）

## 修复方案

### 方案选择

**保持数据库使用 bytes，仅在显示层转换为 MB**

原因：
1. 数据库使用 bytes 可以保证精度
2. 避免大规模数据迁移
3. 只需修改显示逻辑

### 修复步骤

1. ✅ **创建统一的格式化函数**
   - `formatStorageMB(mb: number)` - 将 MB 值格式化为可读字符串
   - 规则：< 1024 MB 显示 MB，>= 1024 MB 显示 GB

2. ✅ **更新 plan_features 显示逻辑**
   - 商品管理：feature_value 已经是 MB，使用格式化函数显示
   - 落地页：feature_value 已经是 MB，使用格式化函数显示

3. ✅ **更新用户存储使用显示**
   - 个人中心：使用 formatStorageMB 替代 bytes 转换
   - 后端已返回 MB 单位，前端直接格式化

4. ✅ **统一所有显示位置**
   - 所有存储空间相关显示统一使用 MB/GB 单位

## 详细修复清单

### ✅ 已完成
- [x] plan_features 表单位改为 MB（migration 020）
- [x] 商品管理功能配额单位设置为 MB
- [x] 创建 formatStorageMB() 格式化函数（client 和 windows-login-manager）
- [x] 落地页套餐功能显示（MB/GB 自动转换）
- [x] 商品管理套餐列表显示（MB/GB 自动转换）
- [x] 个人中心配额统计显示（使用 formatStorageMB）
- [x] 个人中心套餐功能显示（使用 formatStorageMB）
- [x] 后端订阅服务返回 MB 单位

### ✅ 无需修改
- [x] 用户管理订阅详情（后端已返回 MB，前端自动显示）
- [x] Windows 应用（已添加格式化函数，复用相同逻辑）

## 测试验证

### 1. 落地页（8080）
```
访问 http://localhost:8080
检查套餐卡片中的存储空间显示
应该显示：存储空间 100MB / 1024MB / 无限制
```

### 2. 商品管理
```
访问商品管理页面
检查功能配额列显示
应该显示：存储空间: 100 MB / 1024 MB / 无限制
```

### 3. 用户管理
```
访问用户管理 -> 订阅管理
检查订阅详情中的存储空间
应该显示：100 MB / 1024 MB
```

### 4. 个人中心
```
访问个人中心 -> 配额统计
检查存储空间显示
应该显示：已使用 50 MB / 100 MB
```

## 相关文件

### 前端
- `landing/src/pages/HomePage.tsx` - 落地页套餐显示
- `client/src/pages/ProductManagementPage.tsx` - 商品管理
- `client/src/pages/UserManagementPage.tsx` - 用户管理
- `client/src/pages/UserCenterPage.tsx` - 个人中心
- `windows-login-manager/src/pages/UserCenterPage.tsx` - Windows 应用

### 后端
- `server/src/services/SubscriptionService.ts` - 订阅服务
- `server/src/services/StorageQuotaService.ts` - 存储配额服务

### 数据库
- `server/src/db/migrations/020_update_storage_unit_to_mb.sql` - 已完成的迁移
