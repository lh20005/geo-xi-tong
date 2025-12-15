# 紧急问题诊断和修复

## 问题1: 关键词蒸馏页面显示空白

### 可能原因
1. API端点返回错误
2. 前端路由配置问题
3. 数据库连接问题

### 诊断步骤

#### 1. 检查API是否正常
```bash
# 测试蒸馏历史API
curl http://localhost:3000/api/distillation/history

# 应该返回JSON数据，如果返回错误，检查数据库连接
```

#### 2. 检查浏览器控制台
- 打开浏览器开发者工具（F12）
- 查看Console标签页是否有错误
- 查看Network标签页，检查API请求是否成功

#### 3. 检查数据库连接
```bash
cd server
# 检查.env文件中的DATABASE_URL是否正确
cat ../.env | grep DATABASE_URL
```

### 快速修复

如果API返回空数组，这是正常的（表示还没有蒸馏记录）。页面应该显示"暂无蒸馏记录"的提示。

---

## 问题2: 文章生成只使用一个蒸馏结果

### 根本原因分析

代码逻辑是**正确的**，但可能存在以下情况：

1. **数据库中只有一个蒸馏结果有话题**
2. **旧任务使用了旧逻辑（向后兼容）**
3. **任务配置的文章数量为1**

### 验证步骤

#### 1. 检查数据库中的蒸馏结果数量
```sql
-- 查询有话题的蒸馏结果数量
SELECT 
  d.id,
  d.keyword,
  d.usage_count,
  COUNT(t.id) as topic_count
FROM distillations d
LEFT JOIN topics t ON d.id = t.distillation_id
GROUP BY d.id, d.keyword, d.usage_count
HAVING COUNT(t.id) > 0
ORDER BY d.usage_count ASC, d.created_at ASC;
```

#### 2. 检查最近的任务记录
```sql
-- 查看最近的任务使用了哪些蒸馏结果
SELECT 
  id,
  requested_count,
  generated_count,
  selected_distillation_ids,
  status,
  created_at
FROM generation_tasks
ORDER BY created_at DESC
LIMIT 5;
```

#### 3. 检查文章使用的蒸馏结果
```sql
-- 查看最近生成的文章使用了哪些蒸馏结果
SELECT 
  a.id,
  a.title,
  a.distillation_id,
  d.keyword,
  a.created_at
FROM articles a
JOIN distillations d ON a.distillation_id = d.id
ORDER BY a.created_at DESC
LIMIT 10;
```

### 解决方案

#### 方案1: 创建更多蒸馏结果

如果数据库中只有1个蒸馏结果，需要创建更多：

1. 访问"关键词蒸馏"页面
2. 输入不同的关键词（例如：Python、Java、React等）
3. 点击"开始蒸馏"
4. 重复多次，创建至少3-5个蒸馏结果

#### 方案2: 验证均衡选择算法

创建测试任务，验证算法是否正常工作：

```bash
# 使用curl创建任务
curl -X POST http://localhost:3000/api/article-generation/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "distillationId": 1,
    "albumId": 1,
    "knowledgeBaseId": 1,
    "articleSettingId": 1,
    "articleCount": 5
  }'
```

然后检查任务的`selected_distillation_ids`字段：

```sql
SELECT 
  id,
  selected_distillation_ids,
  requested_count
FROM generation_tasks
WHERE id = (SELECT MAX(id) FROM generation_tasks);
```

应该看到类似：`[1, 2, 3, 4, 5]` 的数组（如果有5个蒸馏结果）

#### 方案3: 清理旧任务数据

如果有很多旧任务（没有`selected_distillation_ids`），它们会使用旧逻辑：

```sql
-- 查看有多少旧任务
SELECT COUNT(*) 
FROM generation_tasks 
WHERE selected_distillation_ids IS NULL;

-- 可选：删除旧任务（谨慎操作！）
-- DELETE FROM generation_tasks WHERE selected_distillation_ids IS NULL;
```

---

## 快速验证脚本

创建一个快速验证脚本：

```bash
#!/bin/bash

echo "=== 1. 检查API健康状态 ==="
curl -s http://localhost:3000/api/distillation/history | jq '.data | length'

echo -e "\n=== 2. 检查有话题的蒸馏结果数量 ==="
psql $DATABASE_URL -c "SELECT COUNT(DISTINCT d.id) FROM distillations d INNER JOIN topics t ON d.id = t.distillation_id;"

echo -e "\n=== 3. 检查最近任务的selected_distillation_ids ==="
psql $DATABASE_URL -c "SELECT id, selected_distillation_ids, requested_count FROM generation_tasks ORDER BY created_at DESC LIMIT 3;"

echo -e "\n=== 4. 检查usage_count分布 ==="
psql $DATABASE_URL -c "SELECT d.id, d.keyword, d.usage_count, COUNT(t.id) as topics FROM distillations d LEFT JOIN topics t ON d.id = t.distillation_id GROUP BY d.id ORDER BY d.usage_count ASC;"
```

---

## 预期行为

### 正确的均衡选择行为

假设有5个蒸馏结果，usage_count分别为：[0, 0, 1, 2, 3]

当请求生成5篇文章时：
1. 选择usage_count最小的5个：[0, 0, 1, 2, 3]
2. 每篇文章使用不同的蒸馏结果
3. 生成后，usage_count变为：[1, 1, 2, 3, 4]

下次生成5篇文章时：
1. 选择usage_count最小的5个：[1, 1, 2, 3, 4]
2. 继续均衡使用

### 如何验证是否正常工作

1. 创建3个不同的蒸馏结果
2. 创建一个任务，生成3篇文章
3. 检查3篇文章是否使用了3个不同的蒸馏结果
4. 再创建一个任务，生成3篇文章
5. 检查usage_count是否均衡增长

---

## 常见问题

### Q1: 为什么我的任务只使用了一个蒸馏结果？

**A**: 可能原因：
1. 数据库中只有1个蒸馏结果有话题
2. 任务是旧任务（没有selected_distillation_ids）
3. 任务配置的文章数量为1

### Q2: 如何强制使用新的均衡选择算法？

**A**: 创建新任务即可。所有新任务都会自动使用均衡选择算法。

### Q3: 旧任务会影响新任务吗？

**A**: 不会。旧任务使用旧逻辑，新任务使用新逻辑，互不影响。

---

## 联系支持

如果以上步骤都无法解决问题，请提供：
1. 浏览器控制台的错误信息
2. 数据库查询结果
3. 任务创建的响应数据

