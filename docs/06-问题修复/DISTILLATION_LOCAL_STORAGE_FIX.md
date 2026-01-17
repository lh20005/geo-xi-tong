# 蒸馏功能本地存储修复方案

## 问题描述

Windows 桌面客户端的蒸馏页面仍在调用服务器的 `/api/distillation/history` 接口，但该接口已被删除（因为蒸馏记录已迁移到本地存储）。

**错误信息**：
```
GET https://jzgeo.cc/api/distillation/history 404 (Not Found)
```

## 架构设计

### 正确的蒸馏功能架构

| 功能 | 执行位置 | 原因 |
|------|---------|------|
| **蒸馏执行**（调用 AI 生成话题） | 服务器端 | 需要消耗配额，调用 AI API |
| **蒸馏记录存储** | Windows 本地 | 用户数据本地化 |
| **蒸馏历史查询** | Windows 本地 | 从本地数据库读取 |
| **蒸馏记录编辑/删除** | Windows 本地 | 本地数据操作 |

### 工作流程

```
1. 用户输入关键词 → 前端
2. 调用服务器 API 执行蒸馏 → POST /api/distillation
3. 服务器：
   - 验证配额
   - 调用 AI API 生成话题
   - 返回话题列表（不存储）
4. Windows 端：
   - 接收话题列表
   - 保存到本地 PostgreSQL
   - 显示结果
5. 查询历史 → 从本地 PostgreSQL 读取
```

## 修复方案

### 1. 保留服务器端蒸馏执行 API

服务器端需要保留蒸馏执行接口（调用 AI），但不存储记录：

```typescript
// server/src/routes/distillation.ts
router.post('/', authenticate, async (req, res) => {
  // 1. 验证配额
  // 2. 调用 AI API 生成话题
  // 3. 返回话题列表（不存储到数据库）
  return res.json({
    keyword: req.body.keyword,
    questions: generatedQuestions,
    count: generatedQuestions.length
  });
});
```

### 2. Windows 端修改

#### 2.1 修改蒸馏页面

**文件**: `windows-login-manager/src/pages/DistillationPage.tsx`

**修改内容**：
- 蒸馏执行：调用服务器 API（`POST /api/distillation`）
- 保存记录：调用本地 IPC（`distillation:local:create`）
- 查询历史：调用本地 IPC（`distillation:local:findAll`）
- 查看详情：调用本地 IPC（`distillation:local:findById`）
- 编辑/删除：调用本地 IPC

#### 2.2 创建本地蒸馏 API 封装

**文件**: `windows-login-manager/src/api/localDistillationApi.ts`

```typescript
// 本地蒸馏记录操作
export const localDistillationApi = {
  // 获取所有记录
  findAll: async (params?: any) => {
    return window.electron.invoke('distillation:local:findAll', params);
  },
  
  // 根据 ID 获取
  findById: async (id: number) => {
    return window.electron.invoke('distillation:local:findById', id);
  },
  
  // 创建记录
  create: async (data: any) => {
    return window.electron.invoke('distillation:local:create', data);
  },
  
  // 更新记录
  update: async (id: number, data: any) => {
    return window.electron.invoke('distillation:local:update', id, data);
  },
  
  // 删除记录
  delete: async (id: number) => {
    return window.electron.invoke('distillation:local:delete', id);
  },
  
  // 批量删除
  deleteBatch: async (ids: number[]) => {
    return window.electron.invoke('distillation:local:deleteBatch', ids);
  }
};
```

### 3. 服务器端修改

#### 3.1 恢复蒸馏执行路由

**文件**: `server/src/routes/distillation.ts`

需要恢复蒸馏执行接口，但只负责调用 AI，不存储记录。

#### 3.2 删除蒸馏记录相关路由

删除以下路由（因为记录管理已迁移到本地）：
- `GET /api/distillation/history` ❌
- `GET /api/distillation/:id` ❌
- `PATCH /api/distillation/:id` ❌
- `DELETE /api/distillation/:id` ❌
- `DELETE /api/distillation/all/records` ❌

保留以下路由：
- `POST /api/distillation` ✅（执行蒸馏，调用 AI）

## 实施步骤

### 步骤 1：创建本地蒸馏 API 封装

创建 `windows-login-manager/src/api/localDistillationApi.ts`

### 步骤 2：修改蒸馏页面

修改 `windows-login-manager/src/pages/DistillationPage.tsx`：
- 蒸馏执行：调用服务器 API
- 其他操作：调用本地 IPC

### 步骤 3：修改蒸馏结果页面

修改 `windows-login-manager/src/pages/DistillationResultsPage.tsx`（如果存在）

### 步骤 4：服务器端修改

1. 恢复 `server/src/routes/distillation.ts`（只保留执行接口）
2. 删除蒸馏记录相关的数据库表（如果还存在）

### 步骤 5：测试

1. 测试蒸馏执行（调用 AI）
2. 测试本地记录保存
3. 测试历史记录查询
4. 测试编辑/删除功能

## 注意事项

1. **配额管理**：蒸馏执行需要消耗配额，必须在服务器端验证
2. **数据同步**：蒸馏记录是本地数据，不需要云端同步
3. **离线工作**：查询历史记录可以离线工作，但执行蒸馏需要联网
4. **错误处理**：需要区分网络错误和本地数据库错误

## 相关文件

### Windows 端
- `windows-login-manager/src/pages/DistillationPage.tsx`
- `windows-login-manager/src/api/localDistillationApi.ts`（新建）
- `windows-login-manager/electron/ipc/handlers/localDistillationHandlers.ts`
- `windows-login-manager/electron/services/DistillationServicePostgres.ts`

### 服务器端
- `server/src/routes/distillation.ts`（需要恢复）
- `server/src/services/distillationService.ts`（需要简化）

## 预期结果

修复后：
- ✅ 蒸馏执行正常（调用服务器 AI API）
- ✅ 蒸馏记录保存到本地 PostgreSQL
- ✅ 历史记录从本地数据库读取
- ✅ 编辑/删除操作在本地执行
- ✅ 不再出现 404 错误
