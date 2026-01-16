# 发布功能架构现状分析

## 当前状态：混合架构（部分改造完成）

根据改造方案，发布功能应该完全在 Windows 端本地执行，但当前代码显示**仍在调用服务器 API**。

---

## 📊 当前发布流程调用分析

### 1. 平台账号管理

| 功能 | 当前调用 | 应该调用 | 状态 |
|------|---------|---------|------|
| 获取平台列表 | ✅ 服务器 `/publishing/platforms` | ✅ 服务器（保留） | ✅ 正确 |
| 获取账号列表 | ❌ 服务器 `/publishing/accounts` | ✅ Windows 本地 IPC | ❌ 需改造 |
| 创建账号 | ❌ 服务器 `POST /publishing/accounts` | ✅ Windows 本地 IPC | ❌ 需改造 |
| 更新账号 | ❌ 服务器 `PUT /publishing/accounts/:id` | ✅ Windows 本地 IPC | ❌ 需改造 |
| 删除账号 | ❌ 服务器 `DELETE /publishing/accounts/:id` | ✅ Windows 本地 IPC | ❌ 需改造 |
| 浏览器登录 | ❌ 服务器 `POST /publishing/browser-login` | ✅ Windows 本地 IPC | ❌ 需改造 |

**说明：**
- 平台列表（如小红书、抖音等）可以保留在服务器，因为这是静态配置
- 账号数据（Cookie、登录状态）必须存储在 Windows 本地 SQLite

---

### 2. 发布任务管理

| 功能 | 当前调用 | 应该调用 | 状态 |
|------|---------|---------|------|
| 创建发布任务 | ❌ 服务器 `POST /publishing/tasks` | ✅ Windows 本地 IPC | ❌ 需改造 |
| 获取任务列表 | ❌ 服务器 `GET /publishing/tasks` | ✅ Windows 本地 IPC | ❌ 需改造 |
| 获取任务详情 | ❌ 服务器 `GET /publishing/tasks/:id` | ✅ Windows 本地 IPC | ❌ 需改造 |
| 执行任务 | ❌ 服务器 `POST /publishing/tasks/:id/execute` | ✅ Windows 本地 IPC | ❌ 需改造 |
| 重试任务 | ❌ 服务器 `POST /publishing/tasks/:id/retry` | ✅ Windows 本地 IPC | ❌ 需改造 |
| 取消任务 | ❌ 服务器 `POST /publishing/tasks/:id/cancel` | ✅ Windows 本地 IPC | ❌ 需改造 |
| 删除任务 | ❌ 服务器 `DELETE /publishing/tasks/:id` | ✅ Windows 本地 IPC | ❌ 需改造 |

**说明：**
- 所有任务数据应存储在 Windows 本地 SQLite
- 任务执行（浏览器自动化）应在 Windows 本地进行

---

### 3. 发布记录管理

| 功能 | 当前调用 | 应该调用 | 状态 |
|------|---------|---------|------|
| 获取发布记录 | ❌ 服务器 `GET /publishing/records` | ✅ Windows 本地 IPC | ❌ 需改造 |
| 获取记录详情 | ❌ 服务器 `GET /publishing/records/:id` | ✅ Windows 本地 IPC | ❌ 需改造 |
| 删除记录 | ❌ 服务器 `DELETE /publishing/records/:id` | ✅ Windows 本地 IPC | ❌ 需改造 |

**说明：**
- 发布记录应存储在 Windows 本地 SQLite
- 可选：成功发布后上报统计数据到服务器（用于管理员分析）

---

## 🔴 关键问题：发布功能尚未改造

### 当前架构（错误）

```
Windows 端（界面）
    ↓
调用服务器 API
    ↓
服务器执行发布
    ↓
返回结果
```

### 目标架构（改造方案）

```
Windows 端（界面）
    ↓
调用本地 IPC
    ↓
Windows 端执行发布（Playwright）
    ↓
返回结果
```

---

## 📋 需要改造的文件清单

### 1. Windows 端需要新建的文件

```
windows-login-manager/electron/
├── services/
│   ├── AccountService.ts          # 账号管理（本地 SQLite）
│   ├── TaskService.ts             # 任务管理（本地 SQLite）
│   └── PublishingExecutor.ts      # 发布执行器（Playwright）
│
├── browser/
│   ├── BrowserAutomationService.ts  # 浏览器自动化
│   └── LoginStatusChecker.ts        # 登录状态检测
│
├── adapters/                      # 平台适配器（从服务器迁移）
│   ├── PlatformAdapter.ts
│   ├── AdapterRegistry.ts
│   ├── XiaohongshuAdapter.ts
│   ├── DouyinAdapter.ts
│   └── ...（12+ 平台）
│
└── ipc/
    ├── accountHandlers.ts         # 账号相关 IPC
    ├── taskHandlers.ts            # 任务相关 IPC
    └── publishHandlers.ts         # 发布相关 IPC
```

### 2. 前端需要修改的文件

```
client/src/api/publishing.ts       # 改为调用 IPC 而不是 HTTP
```

### 3. 服务器端需要删除的文件

```
server/src/routes/
├── publishingTasks.ts             # 删除（迁移到 Windows 端）
├── publishingRecords.ts           # 删除（迁移到 Windows 端）
└── publishingSSE.ts               # 删除（迁移到 Windows 端）

server/src/services/
├── BrowserAutomationService.ts    # 删除（迁移到 Windows 端）
├── PublishingExecutor.ts          # 删除（迁移到 Windows 端）
└── adapters/                      # 删除（迁移到 Windows 端）
```

---

## 🎯 改造优先级

### 高优先级（核心功能）

1. **账号管理本地化**
   - 创建 `AccountService.ts`（Windows 端）
   - 创建 SQLite 表 `platform_accounts`
   - 实现 Cookie 加密存储
   - 修改前端 API 调用为 IPC

2. **浏览器自动化迁移**
   - 从服务器复制 `BrowserAutomationService.ts`
   - 从服务器复制所有平台适配器
   - 适配 Windows 端环境

3. **发布任务本地化**
   - 创建 `TaskService.ts`（Windows 端）
   - 创建 SQLite 表 `publishing_tasks`
   - 实现任务执行逻辑
   - 修改前端 API 调用为 IPC

### 中优先级（增强功能）

4. **发布记录本地化**
   - 创建 SQLite 表 `publishing_records`
   - 实现记录查询和管理

5. **配额预扣减集成**
   - 发布前调用服务器预扣减配额
   - 发布成功后确认消费
   - 发布失败后释放配额

### 低优先级（可选功能）

6. **分析上报**
   - 发布成功/失败后上报统计数据
   - 支持离线队列

---

## 🔧 改造步骤建议

### 步骤 1：账号管理本地化（2 天）

1. 创建 Windows 端 `AccountService.ts`
2. 创建 SQLite 表 `platform_accounts`
3. 实现 Cookie 加密存储（基于机器码）
4. 创建 IPC handlers：`accountHandlers.ts`
5. 修改前端 `client/src/api/publishing.ts`：
   ```typescript
   // 修改前
   export async function getAccounts(): Promise<Account[]> {
     const response = await apiClient.get('/publishing/accounts');
     return response.data.data;
   }
   
   // 修改后
   export async function getAccounts(): Promise<Account[]> {
     return await window.electron.invoke('account:findAll');
   }
   ```

### 步骤 2：浏览器自动化迁移（1 天）

1. 复制服务器端文件到 Windows 端：
   - `server/src/services/BrowserAutomationService.ts` → `windows-login-manager/electron/browser/`
   - `server/src/services/adapters/*` → `windows-login-manager/electron/adapters/`
2. 修改导入路径
3. 测试浏览器启动

### 步骤 3：发布任务本地化（2 天）

1. 创建 Windows 端 `TaskService.ts`
2. 创建 SQLite 表 `publishing_tasks`
3. 创建 `PublishingExecutor.ts`（集成浏览器自动化）
4. 创建 IPC handlers：`taskHandlers.ts`、`publishHandlers.ts`
5. 修改前端 API 调用

### 步骤 4：配额集成（1 天）

1. 创建 `QuotaClient.ts`（Windows 端）
2. 在发布流程中集成配额预扣减
3. 测试配额验证

### 步骤 5：删除服务器代码（0.5 天）

1. 删除服务器端发布相关路由
2. 删除服务器端浏览器自动化代码
3. 删除服务器端平台适配器

**总计：约 6.5 天**

---

## ⚠️ 当前风险

1. **功能不可用**：如果服务器端代码被删除，但 Windows 端未实现，发布功能将完全不可用
2. **数据丢失**：如果直接切换到本地存储，服务器上的历史发布记录将丢失
3. **用户体验中断**：改造期间用户无法使用发布功能

---

## ✅ 建议

1. **先完成 Windows 端实现，再删除服务器代码**
2. **提供数据迁移工具**：将服务器上的账号和任务数据导出，导入到 Windows 端
3. **分阶段上线**：
   - 阶段 1：Windows 端实现完成，与服务器并行运行
   - 阶段 2：用户测试 Windows 端功能
   - 阶段 3：确认无问题后删除服务器代码

---

## 📝 总结

**当前状态：** 发布功能仍在调用服务器 API，**尚未按照改造方案进行本地化改造**。

**下一步：** 按照上述改造步骤，将发布功能迁移到 Windows 端本地执行。
