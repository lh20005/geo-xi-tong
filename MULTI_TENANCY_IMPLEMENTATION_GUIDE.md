# 多租户数据隔离实施指南

## 📋 概述

当前系统所有用户共享同一套数据，需要实现**多租户（Multi-tenancy）数据隔离**，让每个用户只能访问和管理自己的数据。

## 🎯 目标

- ✅ 每个用户拥有独立的数据空间
- ✅ 用户之间数据完全隔离
- ✅ 为后续按用户销售套餐做准备
- ✅ 支持基于用户的配额管理

## 📊 当前问题

### 共享数据的表
以下表目前**没有** `user_id` 字段，所有用户共享数据：

1. **albums** - 相册
2. **knowledge_bases** - 知识库
3. **conversion_targets** - 转化目标
4. **article_settings** - 文章设置
5. **distillations** - 关键词蒸馏记录
6. **articles** - 文章
7. **generation_tasks** - 文章生成任务
8. **platform_accounts** - 平台账号
9. **api_configs** - API配置
10. **distillation_config** - 蒸馏配置

## 🚀 实施步骤

### 第1步：数据库迁移

执行迁移脚本，为所有核心业务表添加 `user_id` 字段：

```bash
# 执行迁移
npm run migrate:multi-tenancy

# 或者直接运行
ts-node server/src/db/migrate-multi-tenancy.ts
```

**迁移内容：**
- 为每个表添加 `user_id` 字段
- 为现有数据设置默认用户（ID=1）
- 添加外键约束和索引
- 修改唯一约束（如公司名称改为用户级唯一）

### 第2步：更新认证中间件

修改 JWT 认证中间件，将用户信息注入到请求对象：

```typescript
// server/src/middleware/auth.ts
import { setTenantContext } from './tenantContext';

// 在认证成功后调用
app.use(authenticateToken);
app.use(setTenantContext);
```

### 第3步：修改现有路由

为每个路由添加数据隔离逻辑。参考示例：`server/src/routes/albums-multi-tenant-example.ts`

#### 修改前（共享数据）：
```typescript
// 获取所有相册
router.get('/albums', async (req, res) => {
  const result = await pool.query('SELECT * FROM albums');
  res.json(result.rows);
});
```

#### 修改后（隔离数据）：
```typescript
// 只获取当前用户的相册
router.get('/albums', requireTenantContext, async (req, res) => {
  const userId = getCurrentTenantId(req);
  const result = await pool.query(
    'SELECT * FROM albums WHERE user_id = $1',
    [userId]
  );
  res.json(result.rows);
});
```

### 第4步：更新所有服务层

修改所有服务类，在数据库操作中添加 `user_id` 过滤：

#### 需要修改的服务：
- [ ] `server/src/services/AccountService.ts` - 平台账号
- [ ] `server/src/services/articleGenerationService.ts` - 文章生成
- [ ] `server/src/services/distillationService.ts` - 关键词蒸馏
- [ ] `server/src/services/knowledgeBaseService.ts` - 知识库
- [ ] 相册相关服务
- [ ] 文章相关服务

#### 修改模式：

```typescript
// 修改前
async getAlbums() {
  return pool.query('SELECT * FROM albums');
}

// 修改后
async getAlbums(userId: number) {
  return pool.query(
    'SELECT * FROM albums WHERE user_id = $1',
    [userId]
  );
}
```

### 第5步：更新前端代码

前端不需要大改，因为：
- JWT token 已经包含用户信息
- 后端自动过滤数据
- API 接口保持不变

但需要注意：
- 移除任何"全局数据"的假设
- 确保所有请求都带上认证 token

### 第6步：管理员特权

管理员可能需要查看所有用户的数据，添加特殊处理：

```typescript
router.get('/admin/albums', requireAdmin, async (req, res) => {
  const { userId } = req.query;
  
  let query = 'SELECT * FROM albums';
  const params = [];
  
  if (userId) {
    query += ' WHERE user_id = $1';
    params.push(userId);
  }
  
  const result = await pool.query(query, params);
  res.json(result.rows);
});
```

## 📝 需要修改的路由文件

### 核心业务路由
- [ ] `server/src/routes/gallery.ts` - 相册管理
- [ ] `server/src/routes/knowledgeBase.ts` - 知识库
- [ ] `server/src/routes/article.ts` - 文章管理
- [ ] `server/src/routes/articleGeneration.ts` - 文章生成
- [ ] `server/src/routes/distillation.ts` - 关键词蒸馏
- [ ] `server/src/routes/conversionTarget.ts` - 转化目标
- [ ] `server/src/routes/articleSettings.ts` - 文章设置
- [ ] `server/src/routes/platformAccounts.ts` - 平台账号
- [ ] `server/src/routes/config.ts` - API配置

### 管理路由
- [ ] `server/src/routes/admin.ts` - 管理员功能
- [ ] `server/src/routes/dashboard.ts` - 仪表板

## 🔍 测试清单

### 功能测试
- [ ] 用户A创建的相册，用户B看不到
- [ ] 用户A创建的文章，用户B看不到
- [ ] 用户A的知识库，用户B无法访问
- [ ] 用户A无法修改用户B的数据
- [ ] 用户A无法删除用户B的数据

### 边界测试
- [ ] 尝试访问不存在的资源返回404
- [ ] 尝试访问其他用户的资源返回403或404
- [ ] 管理员可以查看所有用户数据
- [ ] 未登录用户无法访问任何数据

### 性能测试
- [ ] 添加 user_id 索引后查询性能正常
- [ ] 大量数据下过滤性能可接受

## 💡 最佳实践

### 1. 统一的数据访问模式
```typescript
// 使用 TenantService 统一处理
import { tenantService } from '../services/TenantService';

// 查询
const albums = await tenantService.query(
  userId,
  'SELECT * FROM albums WHERE user_id = $1',
  [userId]
);

// 插入
await tenantService.insert(userId, 'albums', { name: '新相册' });

// 更新
await tenantService.update(userId, 'albums', albumId, { name: '更新名称' });

// 删除
await tenantService.delete(userId, 'albums', albumId);
```

### 2. 所有权验证
```typescript
// 在操作前验证所有权
const hasAccess = await tenantService.checkOwnership(userId, 'albums', albumId);
if (!hasAccess) {
  return res.status(403).json({ message: '无权访问' });
}
```

### 3. 配额检查
```typescript
// 检查用户资源数量
const albumCount = await tenantService.countUserResources(userId, 'albums');
const quota = await getUserQuota(userId, 'albums');

if (albumCount >= quota) {
  return res.status(403).json({ message: '已达到相册数量上限' });
}
```

## 🎁 后续功能

实现多租户后，可以轻松添加：

### 1. 套餐配额管理
```typescript
// 不同套餐有不同的配额
const quotas = {
  free: { albums: 5, articles: 50, knowledge_bases: 2 },
  basic: { albums: 20, articles: 200, knowledge_bases: 10 },
  pro: { albums: 100, articles: 1000, knowledge_bases: 50 }
};
```

### 2. 使用量统计
```typescript
// 统计用户使用情况
const usage = {
  albums: await tenantService.countUserResources(userId, 'albums'),
  articles: await tenantService.countUserResources(userId, 'articles'),
  storage: await calculateUserStorage(userId)
};
```

### 3. 数据导出/导入
```typescript
// 导出用户所有数据
async function exportUserData(userId: number) {
  return {
    albums: await getUserAlbums(userId),
    articles: await getUserArticles(userId),
    knowledgeBases: await getUserKnowledgeBases(userId)
  };
}
```

### 4. 数据共享（可选）
```typescript
// 允许用户之间共享特定资源
CREATE TABLE shared_resources (
  id SERIAL PRIMARY KEY,
  resource_type VARCHAR(50),
  resource_id INTEGER,
  owner_id INTEGER REFERENCES users(id),
  shared_with_id INTEGER REFERENCES users(id),
  permission VARCHAR(20) -- 'read', 'write'
);
```

## ⚠️ 注意事项

1. **现有数据处理**
   - 迁移脚本会将所有现有数据关联到用户ID=1
   - 如果需要分配给其他用户，需要手动调整

2. **级联删除**
   - 删除用户时会自动删除其所有数据（ON DELETE CASCADE）
   - 考虑是否需要软删除或数据归档

3. **性能优化**
   - 确保所有 `user_id` 字段都有索引
   - 复合索引：`(user_id, created_at)` 用于分页查询

4. **安全性**
   - 永远不要信任前端传来的 `userId`
   - 始终从 JWT token 中提取用户ID
   - 所有数据库查询都要包含 `user_id` 过滤

## 📚 相关文件

- `server/src/db/migrations/add-multi-tenancy.sql` - 数据库迁移SQL
- `server/src/db/migrate-multi-tenancy.ts` - 迁移执行脚本
- `server/src/middleware/tenantContext.ts` - 租户上下文中间件
- `server/src/services/TenantService.ts` - 租户服务
- `server/src/routes/albums-multi-tenant-example.ts` - 路由修改示例

## 🚦 执行顺序

1. ✅ 备份数据库
2. ✅ 执行数据库迁移
3. ✅ 更新中间件
4. ✅ 修改服务层
5. ✅ 修改路由层
6. ✅ 测试功能
7. ✅ 部署上线

## 💬 常见问题

**Q: 迁移后现有用户的数据会丢失吗？**
A: 不会。迁移脚本会将所有现有数据关联到用户ID=1。

**Q: 管理员能看到所有用户的数据吗？**
A: 可以。需要在管理员路由中特殊处理，不添加 `user_id` 过滤。

**Q: 如何处理共享资源？**
A: 可以创建 `shared_resources` 表来管理资源共享关系。

**Q: 性能会受影响吗？**
A: 不会。添加了 `user_id` 索引后，查询性能反而可能提升（数据量减少）。

---

**准备好了吗？开始实施多租户数据隔离！** 🚀
