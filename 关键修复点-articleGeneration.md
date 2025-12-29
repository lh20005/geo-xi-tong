# articleGeneration.ts 关键修复点

## 需要添加的导入和中间件

```typescript
import { authenticate } from '../middleware/adminAuth';
import { setTenantContext, requireTenantContext, getCurrentTenantId } from '../middleware/tenantContext';

articleGenerationRouter.use(authenticate);
articleGenerationRouter.use(setTenantContext);
articleGenerationRouter.use(requireTenantContext);
```

## 需要修改的查询

### 1. POST /tasks - 创建任务
```typescript
const userId = getCurrentTenantId(req);

// 验证资源所有权
const distillationCheck = await pool.query(
  'SELECT id FROM distillations WHERE id = $1 AND user_id = $2',
  [validatedData.distillationId, userId]
);

const albumCheck = await pool.query(
  'SELECT id FROM albums WHERE id = $1 AND user_id = $2',
  [validatedData.albumId, userId]
);

// ... 其他资源验证也要加 user_id

// 创建任务时关联 user_id
const taskId = await service.createTask({
  ...validatedData,
  userId  // 传递给服务层
});
```

### 2. GET /tasks - 任务列表
```typescript
const userId = getCurrentTenantId(req);
const result = await service.getTasks(page, pageSize, userId);
```

### 3. GET /tasks/:id - 任务详情
```typescript
const userId = getCurrentTenantId(req);
const task = await service.getTaskDetail(taskId, userId);
```

### 4. 其他操作
所有任务相关操作都需要验证任务属于当前用户

## 服务层修改

`ArticleGenerationService` 也需要修改以支持 user_id 过滤
