# PostgreSQL 迁移 - 阶段 6：代码迁移执行计划

**创建时间**: 2026-01-16  
**状态**: 📋 计划中  
**预计工作量**: 中等

---

## 目标

将 Windows 端代码从 SQLite 迁移到 PostgreSQL，包括：
- 更新数据库连接管理
- 集成 PostgreSQL Service 类
- 更新 IPC 处理器为异步
- 测试基本功能

---

## 前置条件

✅ 已完成：
- PostgreSQL 数据库已创建（geo_windows）
- 17 个表已创建
- 13 个函数已导入
- 4594 条测试数据已导入
- 14 个 PostgreSQL Service 类已创建

---

## 执行步骤

### 步骤 1: 更新数据库连接管理 ⏳

**目标**: 将主进程的数据库连接从 SQLite 切换到 PostgreSQL

**文件**:
- `windows-login-manager/electron/main.ts`
- `windows-login-manager/electron/database/postgres.ts`

**任务**:
1. 在 main.ts 中初始化 PostgreSQL 连接
2. 移除 SQLite 初始化代码
3. 添加数据库连接错误处理
4. 确保应用退出时正确关闭连接

**预计时间**: 30 分钟

---

### 步骤 2: 创建 Service 工厂类 ⏳

**目标**: 创建统一的 Service 实例管理

**文件**:
- `windows-login-manager/electron/services/ServiceFactory.ts` (新建)

**任务**:
1. 创建 ServiceFactory 类
2. 管理所有 Service 实例
3. 提供统一的获取接口
4. 处理 user_id 注入

**预计时间**: 45 分钟

---

### 步骤 3: 更新 IPC 处理器 - 文章模块 ⏳

**目标**: 更新文章相关的 IPC 处理器

**文件**:
- `windows-login-manager/electron/ipc/articleHandlers.ts`

**任务**:
1. 将所有同步调用改为 async/await
2. 使用 ArticleServicePostgres
3. 添加错误处理
4. 更新返回值处理

**预计时间**: 1 小时

---

### 步骤 4: 更新 IPC 处理器 - 图片模块 ⏳

**目标**: 更新图片相关的 IPC 处理器

**文件**:
- `windows-login-manager/electron/ipc/imageHandlers.ts`
- `windows-login-manager/electron/ipc/albumHandlers.ts`

**任务**:
1. 将所有同步调用改为 async/await
2. 使用 ImageServicePostgres 和 AlbumServicePostgres
3. 添加错误处理
4. 更新返回值处理

**预计时间**: 1 小时

---

### 步骤 5: 更新 IPC 处理器 - 知识库模块 ⏳

**目标**: 更新知识库相关的 IPC 处理器

**文件**:
- `windows-login-manager/electron/ipc/knowledgeBaseHandlers.ts`

**任务**:
1. 将所有同步调用改为 async/await
2. 使用 KnowledgeBaseServicePostgres
3. 添加错误处理
4. 更新返回值处理

**预计时间**: 1 小时

---

### 步骤 6: 更新 IPC 处理器 - 平台账号模块 ⏳

**目标**: 更新平台账号相关的 IPC 处理器

**文件**:
- `windows-login-manager/electron/ipc/platformAccountHandlers.ts`

**任务**:
1. 将所有同步调用改为 async/await
2. 使用 PlatformAccountServicePostgres
3. 添加错误处理
4. 更新返回值处理

**预计时间**: 45 分钟

---

### 步骤 7: 更新 IPC 处理器 - 发布模块 ⏳

**目标**: 更新发布相关的 IPC 处理器

**文件**:
- `windows-login-manager/electron/ipc/publishingHandlers.ts`

**任务**:
1. 将所有同步调用改为 async/await
2. 使用 PublishingTaskServicePostgres 和 PublishingRecordServicePostgres
3. 添加错误处理
4. 更新返回值处理

**预计时间**: 1.5 小时

---

### 步骤 8: 更新 IPC 处理器 - 蒸馏模块 ⏳

**目标**: 更新蒸馏相关的 IPC 处理器

**文件**:
- `windows-login-manager/electron/ipc/distillationHandlers.ts`
- `windows-login-manager/electron/ipc/topicHandlers.ts`

**任务**:
1. 将所有同步调用改为 async/await
2. 使用 DistillationServicePostgres 和 TopicServicePostgres
3. 添加错误处理
4. 更新返回值处理

**预计时间**: 1 小时

---

### 步骤 9: 更新 IPC 处理器 - 其他模块 ⏳

**目标**: 更新其他模块的 IPC 处理器

**文件**:
- `windows-login-manager/electron/ipc/conversionTargetHandlers.ts`
- `windows-login-manager/electron/ipc/articleSettingHandlers.ts`

**任务**:
1. 将所有同步调用改为 async/await
2. 使用对应的 Service 类
3. 添加错误处理
4. 更新返回值处理

**预计时间**: 45 分钟

---

### 步骤 10: 测试基本功能 ⏳

**目标**: 验证迁移后的基本功能

**测试项**:
1. 文章 CRUD 操作
2. 图片上传和管理
3. 知识库操作
4. 平台账号管理
5. 发布任务创建
6. 蒸馏和话题生成

**预计时间**: 2 小时

---

## 总体时间估算

| 步骤 | 预计时间 |
|------|---------|
| 1. 数据库连接管理 | 30 分钟 |
| 2. Service 工厂类 | 45 分钟 |
| 3. 文章模块 | 1 小时 |
| 4. 图片模块 | 1 小时 |
| 5. 知识库模块 | 1 小时 |
| 6. 平台账号模块 | 45 分钟 |
| 7. 发布模块 | 1.5 小时 |
| 8. 蒸馏模块 | 1 小时 |
| 9. 其他模块 | 45 分钟 |
| 10. 功能测试 | 2 小时 |
| **总计** | **约 10.5 小时** |

---

## 风险和注意事项

### 风险

1. **IPC 处理器数量多** - 可能有遗漏的处理器
2. **异步转换复杂** - 需要仔细处理 Promise 和错误
3. **前端兼容性** - 前端代码可能需要调整
4. **性能问题** - PostgreSQL 可能比 SQLite 慢

### 注意事项

1. **保留 SQLite 代码** - 暂时不删除，作为备份
2. **逐步测试** - 每完成一个模块就测试
3. **错误处理** - 所有异步操作都要有 try-catch
4. **user_id 管理** - 确保从 JWT 正确获取

---

## 成功标准

- ✅ 所有 IPC 处理器都是异步的
- ✅ 所有数据库操作使用 PostgreSQL Service 类
- ✅ 基本 CRUD 功能正常工作
- ✅ 没有明显的性能问题
- ✅ 错误处理完善

---

## 下一步

完成代码迁移后，进入阶段 7：测试验证
- 单元测试
- 集成测试
- 性能测试
- 端到端测试

---

**文档版本**: 1.0  
**最后更新**: 2026-01-16  
**负责人**: AI Assistant
