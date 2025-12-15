# 智能选择功能快速测试指南

## 前提条件

1. 数据库中至少有3个以上的蒸馏结果（每个都有话题）
2. 至少有1个图库（包含图片）
3. 至少有1个知识库
4. 至少有1个文章设置
5. 至少有1个活跃的AI配置

## 测试步骤

### 1. 验证数据库迁移

```sql
-- 检查 selected_distillation_ids 字段是否存在
SELECT sql FROM sqlite_master 
WHERE type='table' AND name='generation_tasks';

-- 应该看到 selected_distillation_ids TEXT 字段

-- 检查索引是否存在
SELECT name FROM sqlite_master 
WHERE type='index' AND tbl_name='generation_tasks';

-- 应该看到 idx_generation_tasks_selected_distillations
```

### 2. 检查可用的蒸馏结果

```sql
-- 查看所有有话题的蒸馏结果
SELECT 
  d.id,
  d.keyword,
  d.usage_count,
  d.created_at,
  COUNT(t.id) as topic_count
FROM distillations d
LEFT JOIN topics t ON d.id = t.distillation_id
GROUP BY d.id
HAVING COUNT(t.id) > 0
ORDER BY d.usage_count ASC, d.created_at ASC;
```

### 3. 创建测试任务

使用API创建一个任务：

```bash
curl -X POST http://localhost:3000/api/article-generation/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "distillationId": 1,
    "albumId": 1,
    "knowledgeBaseId": 1,
    "articleSettingId": 1,
    "articleCount": 3
  }'
```

**预期响应：**
```json
{
  "taskId": 1,
  "status": "pending",
  "selectedDistillationIds": [1, 2, 3],
  "createdAt": "2024-01-01T00:00:00Z"
}
```

**验证点：**
- ✅ 响应包含 `selectedDistillationIds` 字段
- ✅ `selectedDistillationIds` 是一个数组
- ✅ 数组长度等于 `articleCount`

### 4. 验证数据库记录

```sql
-- 查看任务记录
SELECT 
  id,
  selected_distillation_ids,
  requested_count,
  status
FROM generation_tasks
WHERE id = 1;

-- 应该看到：
-- selected_distillation_ids: "[1,2,3]" (JSON格式)
-- requested_count: 3
-- status: "pending" 或 "running"
```

### 5. 查看任务详情

```bash
curl http://localhost:3000/api/article-generation/tasks/1
```

**预期响应：**
```json
{
  "id": 1,
  "status": "completed",
  "selectedDistillations": [
    { "id": 1, "keyword": "关键词1" },
    { "id": 2, "keyword": "关键词2" },
    { "id": 3, "keyword": "关键词3" }
  ],
  "generatedArticles": [...]
}
```

**验证点：**
- ✅ 响应包含 `selectedDistillations` 字段
- ✅ `selectedDistillations` 是一个数组
- ✅ 数组按使用顺序排列
- ✅ 每个元素包含 `id` 和 `keyword`

### 6. 查看任务列表

```bash
curl http://localhost:3000/api/article-generation/tasks
```

**预期响应：**
```json
{
  "tasks": [
    {
      "id": 1,
      "keyword": "关键词1",
      "distillationResult": "使用了3个蒸馏结果",
      ...
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 10
}
```

**验证点：**
- ✅ `keyword` 显示第一个蒸馏结果的关键词
- ✅ `distillationResult` 显示"使用了N个蒸馏结果"

### 7. 验证文章生成

```sql
-- 查看生成的文章
SELECT 
  id,
  title,
  keyword,
  distillation_id,
  task_id
FROM articles
WHERE task_id = 1
ORDER BY id;

-- 验证点：
-- 1. 应该有3篇文章
-- 2. 每篇文章的 distillation_id 应该不同
-- 3. distillation_id 应该对应 [1, 2, 3]
```

### 8. 验证使用计数更新

```sql
-- 查看蒸馏结果的使用次数
SELECT 
  id,
  keyword,
  usage_count
FROM distillations
WHERE id IN (1, 2, 3)
ORDER BY id;

-- 验证点：
-- 每个蒸馏结果的 usage_count 应该增加了1
```

### 9. 验证使用记录

```sql
-- 查看使用记录
SELECT 
  distillation_id,
  task_id,
  article_id,
  used_at
FROM distillation_usage
WHERE task_id = 1
ORDER BY distillation_id;

-- 验证点：
-- 1. 应该有3条记录
-- 2. distillation_id 应该是 [1, 2, 3]
-- 3. 每条记录对应一篇文章
```

## 测试场景

### 场景1：可用蒸馏结果不足

```bash
# 尝试创建一个请求数量超过可用蒸馏结果的任务
curl -X POST http://localhost:3000/api/article-generation/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "distillationId": 1,
    "albumId": 1,
    "knowledgeBaseId": 1,
    "articleSettingId": 1,
    "articleCount": 999
  }'
```

**预期响应：**
```json
{
  "error": "创建任务失败",
  "details": "可用蒸馏结果不足，当前只有X个可用，但请求生成999篇文章"
}
```

### 场景2：向后兼容性测试

```sql
-- 创建一个旧格式的任务（没有 selected_distillation_ids）
INSERT INTO generation_tasks 
  (distillation_id, album_id, knowledge_base_id, article_setting_id, requested_count, status)
VALUES 
  (1, 1, 1, 1, 1, 'pending');

-- 获取任务ID
SELECT last_insert_rowid();
```

然后手动触发任务执行，验证系统使用旧逻辑。

### 场景3：智能选择验证

```sql
-- 重置所有蒸馏结果的使用次数
UPDATE distillations SET usage_count = 0;

-- 设置不同的使用次数
UPDATE distillations SET usage_count = 5 WHERE id = 1;
UPDATE distillations SET usage_count = 2 WHERE id = 2;
UPDATE distillations SET usage_count = 8 WHERE id = 3;
UPDATE distillations SET usage_count = 2 WHERE id = 4;
```

创建一个任务，验证系统选择使用次数最少的蒸馏结果：

```bash
curl -X POST http://localhost:3000/api/article-generation/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "distillationId": 1,
    "albumId": 1,
    "knowledgeBaseId": 1,
    "articleSettingId": 1,
    "articleCount": 2
  }'
```

**预期：** 系统应该选择ID为2和4的蒸馏结果（usage_count都是2）

## 日志检查

查看服务器日志，应该看到类似的输出：

```
[智能选择] 开始选择 3 个蒸馏结果...
[智能选择] 可用蒸馏结果数量: 10
[智能选择] 成功选择 3 个蒸馏结果: [1, 2, 3]
[任务创建] 开始创建任务，请求生成 3 篇文章
[任务创建] 选择的蒸馏结果IDs: [1,2,3]
[任务创建] 任务创建成功，ID: 1
[任务 1] 开始执行
[任务 1] 读取到预选的蒸馏结果IDs: [1, 2, 3]
[任务 1] 批量加载蒸馏结果数据...
[批量加载] 开始加载 3 个蒸馏结果的数据...
[批量加载] 成功加载 3 个蒸馏结果的数据
[任务 1] 使用蒸馏结果ID 1，关键词: 关键词1
[任务 1] 使用蒸馏结果ID 2，关键词: 关键词2
[任务 1] 使用蒸馏结果ID 3，关键词: 关键词3
[任务 1] 成功生成 3 篇文章，标记为完成
```

## 常见问题

### Q1: 任务创建失败，提示"可用蒸馏结果不足"

**原因：** 数据库中没有足够的有话题的蒸馏结果

**解决：**
```sql
-- 检查有话题的蒸馏结果数量
SELECT COUNT(DISTINCT d.id)
FROM distillations d
INNER JOIN topics t ON d.id = t.distillation_id;
```

如果数量不足，需要创建更多的蒸馏结果或减少 `articleCount`。

### Q2: 任务执行失败，日志显示"使用旧的单蒸馏结果逻辑"

**原因：** 任务的 `selected_distillation_ids` 字段为空

**解决：**
```sql
-- 检查任务记录
SELECT id, selected_distillation_ids 
FROM generation_tasks 
WHERE id = ?;

-- 如果为NULL，说明是旧任务或迁移失败
-- 可以手动更新：
UPDATE generation_tasks 
SET selected_distillation_ids = json_array(distillation_id)
WHERE id = ? AND selected_distillation_ids IS NULL;
```

### Q3: API响应中没有 selectedDistillationIds 字段

**原因：** 可能是旧版本的代码或API路由没有更新

**解决：** 确保使用最新的代码，检查 `server/src/routes/articleGeneration.ts` 文件。

## 成功标准

✅ 所有测试步骤都通过
✅ 日志输出正确
✅ 数据库记录正确
✅ API响应格式正确
✅ 每个蒸馏结果被使用恰好一次
✅ 使用计数正确更新
✅ 向后兼容性正常工作
