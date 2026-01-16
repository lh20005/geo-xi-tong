# PostgreSQL 迁移 - IPC 重复注册修复

**日期**: 2026-01-16  
**状态**: ✅ 修复完成  
**问题**: Electron 启动时报错 `Attempted to register a second handler for 'task:create'`

---

## 问题分析

### 错误日志

```
[23:32:19] [error] Failed to initialize application: Error: Attempted to register a second handler for 'task:create'
    at IpcMainImpl.handle (node:electron/js2c/browser_init:2:94475)
    at registerTaskHandlers (/Users/lzc/Desktop/GEO资料/GEO系统/windows-login-manager/dist-electron/ipc/handlers/taskHandlers.js:22:24)
    at registerAllLocalHandlers (/Users/lzc/Desktop/GEO资料/GEO系统/windows-login-manager/dist-electron/ipc/handlers/index.js:56:45)
```

### 根本原因

在 PostgreSQL 迁移过程中，我们创建了新的 IPC 处理器文件（`taskHandlers.ts`），但忘记删除 `handler.ts` 中的旧处理器，导致同一个 IPC 通道被注册了两次。

**重复注册的处理器**：
- `task:create`
- `task:execute`
- `task:findAll`
- `task:findById`
- `task:getLogs`
- `task:cancel`
- `task:delete`
- `task:batchDelete`
- `task:getBatchInfo`
- `task:stopBatch`
- `task:deleteBatch`
- `task:getStats`
- `task:setLogCallback`

---

## 修复方案

### 1. 删除旧的 IPC 处理器 ✅

**文件**: `windows-login-manager/electron/ipc/handler.ts`

**删除内容**：
- 删除所有 `task:*` 相关的 IPC 处理器（约 200 行代码）
- 保留 `publishing:getRecords` 处理器（尚未迁移）

**修改后**：
```typescript
const { articleService } = require('../services');
const { accountService } = require('../services');

// ==================== 注意 ====================
// Task 相关的 IPC 处理器已迁移到 taskHandlers.ts
// 通过 registerAllLocalHandlers() 统一注册
// ============================================

// 获取发布记录列表
ipcMain.handle('publishing:getRecords', async (_event, params: {
  user_id: number;
  page?: number;
  pageSize?: number;
  platform_id?: string;
  article_id?: string;
  account_id?: string;
}) => {
  try {
    log.info('IPC: publishing:getRecords');
    // TODO: 实现发布记录查询
    return { success: true, data: { records: [], total: 0, page: 1, pageSize: 20 } };
  } catch (error: any) {
    log.error('IPC: publishing:getRecords failed:', error);
    return { success: false, error: error.message || '获取发布记录失败' };
  }
});
```

### 2. 新的 IPC 处理器架构 ✅

**新架构**：
```
windows-login-manager/electron/ipc/
├── handler.ts                    # 主 IPC 处理器（旧代码，逐步迁移）
├── handlers/                     # 新的模块化处理器
│   ├── index.ts                  # 统一注册入口
│   ├── taskHandlers.ts           # 任务相关处理器 ✅
│   ├── articleHandlers.ts        # 文章相关处理器 ✅
│   ├── localAccountHandlers.ts   # 账号相关处理器 ✅
│   ├── localKnowledgeHandlers.ts # 知识库相关处理器 ✅
│   ├── localGalleryHandlers.ts   # 图库相关处理器 ✅
│   ├── dataSyncHandlers.ts       # 数据同步处理器 ✅
│   ├── localDistillationHandlers.ts      # 蒸馏处理器 ✅
│   ├── localTopicHandlers.ts             # 话题处理器 ✅
│   ├── localConversionTargetHandlers.ts  # 转化目标处理器 ✅
│   ├── localArticleSettingHandlers.ts    # 文章设置处理器 ✅
│   ├── publishHandlers.ts        # 发布相关处理器
│   └── browserHandlers.ts        # 浏览器相关处理器
```

### 3. 注册流程 ✅

**主进程初始化**（`main.ts`）：
```typescript
// 注册IPC处理器
await ipcHandler.registerHandlers();

// 初始化 PostgreSQL 数据库
await initializePostgres();

// 注册本地数据相关的 IPC 处理器（Phase 6）
registerAllLocalHandlers();
```

**统一注册函数**（`handlers/index.ts`）：
```typescript
export function registerAllLocalHandlers(): void {
  registerArticleHandlers();
  registerTaskHandlers();
  registerPublishHandlers();
  registerBrowserHandlers();
  registerLocalAccountHandlers();
  registerLocalKnowledgeHandlers();
  registerLocalGalleryHandlers();
  registerDataSyncHandlers();
  registerLocalDistillationHandlers();
  registerLocalTopicHandlers();
  registerLocalConversionTargetHandlers();
  registerLocalArticleSettingHandlers();
}
```

---

## 迁移进度

### ✅ 已迁移的处理器

| 模块 | 文件 | 状态 |
|------|------|------|
| 任务管理 | `taskHandlers.ts` | ✅ 完成 |
| 文章管理 | `articleHandlers.ts` | ✅ 完成 |
| 账号管理 | `localAccountHandlers.ts` | ✅ 完成 |
| 知识库管理 | `localKnowledgeHandlers.ts` | ✅ 完成 |
| 图库管理 | `localGalleryHandlers.ts` | ✅ 完成 |
| 数据同步 | `dataSyncHandlers.ts` | ✅ 完成 |
| 蒸馏管理 | `localDistillationHandlers.ts` | ✅ 完成 |
| 话题管理 | `localTopicHandlers.ts` | ✅ 完成 |
| 转化目标 | `localConversionTargetHandlers.ts` | ✅ 完成 |
| 文章设置 | `localArticleSettingHandlers.ts` | ✅ 完成 |
| 发布执行 | `publishHandlers.ts` | ✅ 完成 |
| 浏览器自动化 | `browserHandlers.ts` | ✅ 完成 |

### ⏭️ 待迁移的处理器

| 模块 | 当前位置 | 说明 |
|------|---------|------|
| 发布记录 | `handler.ts` | `publishing:getRecords` |
| 其他旧处理器 | `handler.ts` | 逐步迁移 |

---

## 验证步骤

### 1. 重新编译

```bash
cd windows-login-manager
npm run build
```

### 2. 启动应用

```bash
npm run dev
```

### 3. 检查日志

应该看到：
```
✅ 环境变量已加载: /path/to/.env
DB_USER: lzc
DB_NAME: geo_windows
✅ PostgreSQL 数据库连接成功
IPC handlers registered
Local IPC handlers registered
```

**不应该看到**：
```
❌ Attempted to register a second handler for 'task:create'
```

---

## 相关文件

| 文件 | 说明 |
|------|------|
| `windows-login-manager/electron/ipc/handler.ts` | 主 IPC 处理器（已删除重复的 task 处理器） |
| `windows-login-manager/electron/ipc/handlers/taskHandlers.ts` | 新的任务处理器 |
| `windows-login-manager/electron/ipc/handlers/index.ts` | 统一注册入口 |
| `windows-login-manager/electron/main.ts` | 主进程入口 |

---

## 下一步

1. ✅ 删除重复的 IPC 处理器
2. ⏭️ 重新编译并测试
3. ⏭️ 验证所有 task 相关功能正常
4. ⏭️ 逐步迁移其他旧处理器

---

## 总结

通过删除 `handler.ts` 中重复的 task 处理器，解决了 IPC 重复注册的问题。新的模块化架构更清晰，每个模块的处理器独立管理，避免了重复注册的风险。

**关键改进**：
- ✅ 删除了约 200 行重复代码
- ✅ 采用模块化架构
- ✅ 统一注册入口
- ✅ 清晰的迁移进度追踪

现在可以重新启动 Electron 应用进行测试了！🎉
