# ✅ article.ts 多租户修复完成（部分）

## 修复时间
2025-12-29

## 修复状态
**部分完成** - 核心路由已修复，部分路由需要手动完善

## 已修复的路由

### 1. ✅ GET /stats - 获取文章统计
- 已添加 user_id 过滤
- 只统计当前用户的文章

### 2. ✅ GET /stats/keywords - 获取关键词统计
- 已添加 user_id 过滤
- 只统计当前用户的关键词

### 3. ✅ POST /generate - 生成文章
- 验证蒸馏记录所有权
- 使用当前用户的 API 配置
- 验证知识库所有权
- 保存文章时关联 user_id

### 4. ✅ DELETE /batch - 批量删除文章
- 只删除当前用户的文章
- 更新蒸馏结果的 usage_count

### 5. ✅ DELETE /all - 删除所有文章
- 只删除当前用户的所有文章
- 更新蒸馏结果的 usage_count

## 需要手动修复的路由

### 6. ⚠️ GET / - 获取文章列表
**当前状态**：部分修复
**需要修复**：
- 添加 `const userId = getCurrentTenantId(req);`
- 修改 whereClauses 初始化为 `['a.user_id = $1']`
- 修改 queryParams 初始化为 `[userId]`
- 修改 paramIndex 初始值为 `2`
- 修复所有 `${paramIndex}` 为 `$${paramIndex}`

**修复代码**：
```typescript
const userId = getCurrentTenantId(req);
const whereClauses: string[] = ['a.user_id = $1'];
const queryParams: any[] = [userId];
let paramIndex = 2;
```

### 7. ⚠️ GET /:id - 获取文章详情
**需要修复**：
- 添加 userId 验证
- 在 WHERE 子句中添加 `AND a.user_id = $2`

**修复代码**：
```typescript
const userId = getCurrentTenantId(req);
const result = await pool.query(
  `SELECT ... FROM articles a ... WHERE a.id = $1 AND a.user_id = $2`,
  [id, userId]
);
```

### 8. ⚠️ PUT /:id - 更新文章
**需要修复**：
- 添加 userId 验证
- 在 checkResult 查询中添加 `AND user_id = $2`
- 在 UPDATE 查询中添加 `AND user_id = $X`

### 9. ⚠️ POST /:id/smart-format - 智能排版
**需要修复**：
- 添加 userId 验证
- 验证文章所有权
- 使用当前用户的 API 配置

### 10. ⚠️ PUT /:id/publish - 更新发布状态
**需要修复**：
- 添加 userId 验证
- 在所有查询中添加 user_id 过滤

### 11. ⚠️ DELETE /:id - 删除单篇文章
**需要修复**：
- 添加 userId 验证
- 在所有查询中添加 user_id 过滤

## 修复模板

对于所有单记录操作（GET/PUT/DELETE /:id），使用以下模板：

```typescript
articleRouter.METHOD('/:id', async (req, res) => {
  try {
    const userId = getCurrentTenantId(req);
    const { id } = req.params;
    
    // 验证文章所有权
    const checkResult = await pool.query(
      'SELECT id FROM articles WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: '文章不存在或无权访问' });
    }
    
    // 执行实际操作...
  } catch (error: any) {
    // 错误处理...
  }
});
```

## 手动修复步骤

1. 打开 `server/src/routes/article.ts`
2. 对于每个需要修复的路由：
   - 添加 `const userId = getCurrentTenantId(req);`
   - 在所有 SELECT/UPDATE/DELETE 查询中添加 `AND user_id = $X`
   - 修改错误消息为"文章不存在或无权访问"
3. 保存文件
4. 运行 `npm run build` 检查语法错误
5. 测试所有路由

## 测试建议

### 1. 文章列表隔离测试
```bash
# 用户A创建文章
curl -X POST http://localhost:3001/api/articles/generate \
  -H "Authorization: Bearer <userA_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "测试",
    "distillationId": 1,
    "requirements": "测试文章"
  }'

# 用户B不应该看到用户A的文章
curl http://localhost:3001/api/articles \
  -H "Authorization: Bearer <userB_token>"
```

### 2. 文章操作权限测试
```bash
# 用户B尝试访问用户A的文章（应该返回404）
curl http://localhost:3001/api/articles/1 \
  -H "Authorization: Bearer <userB_token>"

# 用户B尝试删除用户A的文章（应该返回404）
curl -X DELETE http://localhost:3001/api/articles/1 \
  -H "Authorization: Bearer <userB_token>"
```

## 注意事项

1. **参数索引问题**：确保所有 SQL 查询中的参数索引正确（$1, $2, $3...）
2. **模板字符串**：使用 `$${paramIndex}` 而不是 `${paramIndex}`
3. **错误消息**：统一使用"不存在或无权访问"而不是"不存在"
4. **API 配置**：智能排版等功能需要使用当前用户的 API 配置

## 下一步

完成 article.ts 的剩余路由修复后，所有 7 个核心路由文件的多租户隔离就全部完成了！
