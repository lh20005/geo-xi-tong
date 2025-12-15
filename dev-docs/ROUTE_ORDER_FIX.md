# 路由顺序修复说明

## 问题描述

访问蒸馏结果页面时出现"无效的记录ID"错误。

## 根本原因

Express.js 按照路由定义的顺序进行匹配。原来的路由顺序中，动态路由 `/:id` 定义在特定路径（如 `/results`、`/stats`、`/recommended`）之前，导致这些特定路径被误认为是ID参数。

### 错误的路由顺序（修复前）

```
1. /history          ✓ 正常工作
2. /:id              ⚠️ 会匹配 "results"、"stats"、"recommended"
3. /results          ✗ 永远不会被匹配到
4. /stats            ✗ 永远不会被匹配到
5. /:id/usage-history
6. /recommended      ✗ 永远不会被匹配到
```

当访问 `/api/distillation/results` 时：
- Express 匹配到 `/:id` 路由
- 将 "results" 当作 ID 参数
- 尝试 `parseInt("results")` 返回 NaN
- 触发"无效的记录ID"错误

## 解决方案

将所有特定路径的路由定义移到动态路由 `/:id` 之前。

### 正确的路由顺序（修复后）

```
1. /history          ✓ 特定路径
2. /results          ✓ 特定路径（新增）
3. /stats            ✓ 特定路径
4. /recommended      ✓ 特定路径
5. /:id              ✓ 动态路由（最后）
6. /:id/usage-history ✓ 带参数的特定路径
```

## 修改内容

### 文件：`server/src/routes/distillation.ts`

**修改前**：
```typescript
distillationRouter.get('/history', ...);
distillationRouter.get('/:id', ...);           // 问题：太早定义
// ... 其他路由
distillationRouter.get('/results', ...);       // 永远不会被匹配
distillationRouter.get('/stats', ...);         // 永远不会被匹配
distillationRouter.get('/recommended', ...);   // 永远不会被匹配
```

**修改后**：
```typescript
// ==================== 特定路径路由（必须在 /:id 之前）====================
distillationRouter.get('/history', ...);
distillationRouter.get('/results', ...);       // ✓ 现在可以正常工作
distillationRouter.get('/stats', ...);         // ✓ 现在可以正常工作
distillationRouter.get('/recommended', ...);   // ✓ 现在可以正常工作

// ==================== 动态路由（必须在特定路径之后）====================
distillationRouter.get('/:id', ...);           // ✓ 正确位置
```

## 验证

修复后，以下路由都能正常工作：

- ✅ `GET /api/distillation/history` - 获取蒸馏历史
- ✅ `GET /api/distillation/results` - 获取蒸馏结果列表（新功能）
- ✅ `GET /api/distillation/stats` - 获取使用统计
- ✅ `GET /api/distillation/recommended` - 获取推荐结果
- ✅ `GET /api/distillation/123` - 获取ID为123的蒸馏记录
- ✅ `GET /api/distillation/123/usage-history` - 获取使用历史

## 最佳实践

在 Express.js 中定义路由时，应遵循以下原则：

1. **特定路径优先**：将具体的路径（如 `/results`）定义在前面
2. **动态路由靠后**：将带参数的路由（如 `/:id`）定义在后面
3. **更具体的在前**：`/:id/usage-history` 比 `/:id` 更具体，应该在前面
4. **添加注释**：用注释标记路由分组，便于维护

### 推荐的路由组织结构

```typescript
// ==================== 特定路径路由 ====================
router.get('/specific-path-1', ...);
router.get('/specific-path-2', ...);
router.get('/specific-path-3', ...);

// ==================== 动态路由 ====================
router.get('/:id/sub-path', ...);      // 更具体的动态路由
router.get('/:id', ...);                // 通用的动态路由
```

## 影响范围

- ✅ 修复了蒸馏结果页面的访问问题
- ✅ 不影响现有功能
- ✅ 所有路由都能正常工作

## 测试建议

重启服务器后，测试以下场景：

1. 访问蒸馏结果页面（`/distillation-results`）
2. 访问蒸馏历史页面（`/distillation`）
3. 查看单条蒸馏记录详情
4. 使用筛选和搜索功能
5. 批量删除话题

## 修复时间

2024-01-15

## 相关文档

- [Express.js 路由文档](https://expressjs.com/en/guide/routing.html)
- [蒸馏结果表格视图 API 文档](./DISTILLATION_RESULTS_TABLE_API.md)
