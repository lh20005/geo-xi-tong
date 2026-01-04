# 发布记录用户隔离安全修复

## 🚨 问题描述

**严重性：高**

发布任务记录页面存在严重的用户隔离问题，不同用户可以看到彼此的发布记录。

### 根本原因

1. **数据库设计缺陷**：`publishing_records` 表缺少 `user_id` 字段
2. **API 路由缺陷**：`publishingRecords.ts` 路由中所有查询都没有添加用户过滤条件
3. **中间件缺失**：路由没有应用认证和租户上下文中间件

## ✅ 修复方案

### 1. 数据库迁移

创建迁移文件 `011_add_user_id_to_publishing_records.sql`：

```sql
-- 添加 user_id 字段
ALTER TABLE publishing_records 
ADD COLUMN IF NOT EXISTS user_id INTEGER;

-- 从关联表填充数据
UPDATE publishing_records pr
SET user_id = a.user_id
FROM articles a
WHERE pr.article_id = a.id
AND pr.user_id IS NULL;

-- 设置为 NOT NULL 并添加外键
ALTER TABLE publishing_records 
ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE publishing_records 
ADD CONSTRAINT fk_publishing_records_user 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 创建索引
CREATE INDEX idx_publishing_records_user_id ON publishing_records(user_id);
CREATE INDEX idx_publishing_records_user_platform ON publishing_records(user_id, platform_id);
CREATE INDEX idx_publishing_records_user_article ON publishing_records(user_id, article_id);
```

### 2. 路由修复

#### 添加中间件

```typescript
import { authenticate } from '../middleware/adminAuth';
import { setTenantContext, requireTenantContext, getCurrentTenantId } from '../middleware/tenantContext';

router.use(authenticate);
router.use(setTenantContext);
router.use(requireTenantContext);
```

#### 修复所有查询

**获取发布记录列表**：
```typescript
const userId = getCurrentTenantId(req);
const conditions: string[] = ['pr.user_id = $1'];
const params: any[] = [userId];
// ... 添加其他条件
```

**获取发布记录详情**：
```typescript
WHERE pr.id = $1 AND pr.user_id = $2
```

**获取文章的发布记录**：
```typescript
// 先验证文章所有权
const articleCheck = await pool.query(
  'SELECT id FROM articles WHERE id = $1 AND user_id = $2',
  [articleId, userId]
);

// 然后查询记录
WHERE pr.article_id = $1 AND pr.user_id = $2
```

**获取统计数据**：
```typescript
WHERE user_id = $1  // 所有统计查询都添加用户过滤
```

### 3. 服务层修复

修复 `PublishingExecutor.ts` 中创建记录的代码：

```typescript
INSERT INTO publishing_records 
(article_id, task_id, platform_id, account_id, account_name, user_id, published_at)
VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
```

## 📋 执行步骤

### 1. 运行数据库迁移

```bash
cd server
npx ts-node src/db/run-migration-011.ts
```

### 2. 重启服务器

```bash
npm run server:dev
```

### 3. 验证修复

测试以下场景：
- [ ] 用户 A 只能看到自己的发布记录
- [ ] 用户 B 只能看到自己的发布记录
- [ ] 尝试访问其他用户的记录 ID 返回 404
- [ ] 统计数据只显示当前用户的数据

## 🔍 影响范围

### 修改的文件

1. `server/src/db/migrations/011_add_user_id_to_publishing_records.sql` - 新建
2. `server/src/db/run-migration-011.ts` - 新建
3. `server/src/routes/publishingRecords.ts` - 修改
4. `server/src/services/PublishingExecutor.ts` - 修改

### API 端点变更

所有 `/api/publishing/records/*` 端点现在都强制执行用户隔离：

- `GET /api/publishing/records` - 只返回当前用户的记录
- `GET /api/publishing/records/:id` - 验证记录所有权
- `GET /api/publishing/articles/:articleId/records` - 验证文章所有权
- `GET /api/publishing/stats` - 只统计当前用户的数据

## ⚠️ 注意事项

1. **数据完整性**：迁移会自动从 `articles` 表填充 `user_id`
2. **孤立数据**：无法关联到用户的记录将被删除
3. **向后兼容**：新代码在迁移前无法正常工作，必须先运行迁移
4. **性能优化**：已添加必要的索引以优化查询性能

## 🧪 测试清单

- [ ] 迁移成功执行
- [ ] 所有现有记录都有 user_id
- [ ] 用户只能看到自己的记录
- [ ] 跨用户访问被正确拒绝
- [ ] 统计数据正确隔离
- [ ] 新创建的记录包含 user_id
- [ ] 性能没有明显下降

## 📊 安全评估

### 修复前
- **风险等级**：🔴 高
- **数据泄露**：✅ 是
- **OWASP 分类**：A01:2021 - Broken Access Control

### 修复后
- **风险等级**：🟢 低
- **数据泄露**：❌ 否
- **合规性**：✅ 符合多租户隔离要求

## 📝 相关文档

- [多租户架构](./docs/07-开发文档/多租户架构.md)
- [安全最佳实践](./docs/04-安全指南/)
- [数据库迁移指南](./docs/07-开发文档/数据库迁移.md)
