# 蒸馏结果显示修复 - 快速测试指南

## 测试目的

验证文章生成任务列表中的"蒸馏结果"列是否正确显示蒸馏结果内容，而不是关键词。

## 前置条件

1. 服务器和客户端都已启动
2. 数据库中存在文章生成任务记录

## 测试步骤

### 方法 1：通过 UI 测试

1. 打开浏览器访问：http://localhost:5174/article-generation
2. 查看任务列表表格
3. 对比"关键词"列和"蒸馏结果"列的内容
4. **预期结果**：
   - "关键词"列显示关键词（如：雍和植发、如心采耳）
   - "蒸馏结果"列显示对应的话题内容（如：专业的如心采耳怎么样）
   - 两列内容应该不同

### 方法 2：通过 API 测试

```bash
# 测试任务列表 API
curl http://localhost:3000/api/article-generation/tasks?page=1&pageSize=5 | jq '.'

# 检查返回的数据结构
curl http://localhost:3000/api/article-generation/tasks?page=1&pageSize=1 | jq '.tasks[0] | {keyword, distillationResult}'
```

**预期输出示例：**
```json
{
  "keyword": "雍和植发",
  "distillationResult": "<think>"
}
```

或

```json
{
  "keyword": "如心采耳",
  "distillationResult": "专业的如心采耳怎么样"
}
```

### 方法 3：数据库验证

```sql
-- 查看任务及其对应的蒸馏结果
SELECT 
  gt.id as task_id,
  d.keyword,
  (SELECT question FROM topics WHERE distillation_id = gt.distillation_id ORDER BY id ASC LIMIT 1) as distillation_result
FROM generation_tasks gt
INNER JOIN distillations d ON gt.distillation_id = d.id
ORDER BY gt.created_at DESC
LIMIT 5;
```

## 验证要点

✅ **成功标志：**
- API 返回的数据包含 `distillationResult` 字段
- `distillationResult` 的值与 `keyword` 不同
- UI 上"蒸馏结果"列显示的是话题内容，不是关键词

❌ **失败标志：**
- API 返回的数据没有 `distillationResult` 字段
- `distillationResult` 的值与 `keyword` 相同
- UI 上"蒸馏结果"列显示的是关键词

## 常见问题

### Q: 蒸馏结果显示为 null 或"已删除"
A: 这是正常的，说明该蒸馏记录没有关联的话题数据。

### Q: 某些任务的蒸馏结果显示为 "<think>"
A: 这可能是 AI 生成的话题内容，属于正常数据。

### Q: 修改后前端没有变化
A: 请清除浏览器缓存或强制刷新（Ctrl+Shift+R / Cmd+Shift+R）

## 回滚方案

如果需要回滚修改：

1. 恢复 `server/src/services/articleGenerationService.ts` 中的 SQL 查询，移除 `distillation_result` 子查询
2. 恢复 `client/src/pages/ArticleGenerationPage.tsx` 中的 `dataIndex` 为 `'keyword'`
3. 重启服务器和客户端

## 相关文档

- 详细修复说明：`dev-docs/DISTILLATION_RESULT_DISPLAY_FIX.md`
