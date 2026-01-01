# ✅ publishingTasks.ts 多租户修复完成

## 修复时间
2025-12-29

## 修复内容

### 1. 添加认证和租户中间件
```typescript
import { authenticate } from '../middleware/auth';
import { setTenantContext, requireTenantContext, getCurrentTenantId } from '../middleware/tenantContext';

router.use(authenticate);
router.use(setTenantContext);
router.use(requireTenantContext);
```

### 2. 创建任务 (POST /tasks)
- ✅ 获取当前用户ID
- ✅ 验证文章所有权（article_id + user_id）
- ✅ 验证账号所有权（account_id + user_id）
- ✅ 更新文章状态时添加 user_id 过滤
- ✅ 创建任务时传入 user_id

### 3. 获取任务列表 (GET /tasks)
- ✅ 添加 user_id 过滤到所有查询
- ✅ 重写查询逻辑，不使用 PublishingService（避免修改过多）

### 4. 获取任务详情 (GET /tasks/:id)
- ✅ 验证任务所有权（task_id + user_id）

### 5. 获取任务日志 (GET /tasks/:id/logs)
- ✅ 验证任务所有权后再获取日志

### 6. 实时日志流 (GET /tasks/:id/logs/stream)
- ✅ 验证任务所有权后再建立 SSE 连接

### 7. 取消任务 (POST /tasks/:id/cancel)
- ✅ 验证任务所有权

### 8. 重新发布 (POST /tasks/:id/retry)
- ✅ 验证原任务所有权
- ✅ 创建新任务时传入 user_id

### 9. 立即执行任务 (POST /tasks/:id/execute)
- ✅ 验证任务所有权

### 10. 终止任务 (POST /tasks/:id/terminate)
- ✅ 验证任务所有权

### 11. 删除单个任务 (DELETE /tasks/:id)
- ✅ 验证任务所有权

### 12. 批量删除任务 (POST /tasks/batch-delete)
- ✅ 逐个验证任务所有权

### 13. 删除所有任务 (POST /tasks/delete-all)
- ✅ 添加 user_id 过滤到所有删除操作

### 14. 批次操作
- ✅ 停止批次 (POST /batches/:batchId/stop) - 验证批次所有权
- ✅ 删除批次 (DELETE /batches/:batchId) - 验证批次所有权
- ✅ 获取批次信息 (GET /batches/:batchId) - 验证批次所有权

### 15. 综合修复 (POST /comprehensive-fix)
- ✅ 所有修复操作添加 user_id 过滤

### 16. 修复被锁定文章 (POST /fix-stuck-articles)
- ✅ 只修复当前用户的文章
- ✅ 验证任务所有权

## 数据库修改

### 更新迁移脚本
在 `server/src/db/migrations/add-multi-tenancy.sql` 中添加：

```sql
-- 11. 为发布任务表添加用户关联
ALTER TABLE publishing_tasks 
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

UPDATE publishing_tasks SET user_id = 1 WHERE user_id IS NULL;
ALTER TABLE publishing_tasks ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_publishing_tasks_user_id ON publishing_tasks(user_id);
```

## 服务层修改

### PublishingService.ts
1. ✅ 更新 `CreateTaskInput` 接口，添加 `user_id` 字段
2. ✅ 更新 `createTask` 方法，在 INSERT 时包含 `user_id`

## 测试建议

### 1. 创建任务测试
```bash
# 用户A创建任务
curl -X POST http://localhost:3001/api/publishing/tasks \
  -H "Authorization: Bearer <userA_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "article_id": 1,
    "account_id": 1,
    "platform_id": "xiaohongshu"
  }'

# 用户B不应该看到用户A的任务
curl http://localhost:3001/api/publishing/tasks \
  -H "Authorization: Bearer <userB_token>"
```

### 2. 任务操作测试
```bash
# 用户B尝试访问用户A的任务（应该返回404）
curl http://localhost:3001/api/publishing/tasks/1 \
  -H "Authorization: Bearer <userB_token>"

# 用户B尝试取消用户A的任务（应该返回404）
curl -X POST http://localhost:3001/api/publishing/tasks/1/cancel \
  -H "Authorization: Bearer <userB_token>"
```

### 3. 批次操作测试
```bash
# 用户B尝试访问用户A的批次（应该返回404）
curl http://localhost:3001/api/publishing/batches/batch-123 \
  -H "Authorization: Bearer <userB_token>"
```

## 修复特点

1. **最小化修改**：尽量在路由层添加验证，避免大量修改 PublishingService
2. **完整隔离**：所有任务操作都验证所有权
3. **批次支持**：批次操作也实现了租户隔离
4. **修复工具**：综合修复和修复被锁定文章也支持多租户

## 下一步

继续修复剩余路由文件：
- platformAccounts.ts（需要修改 AccountService）
- distillation.ts（15+ 路由）
- article.ts（10+ 路由）
