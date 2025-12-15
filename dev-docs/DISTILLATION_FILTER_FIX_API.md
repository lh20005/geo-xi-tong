# 蒸馏结果筛选和搜索功能修复 - API文档

## 概述

本文档描述了蒸馏结果模块筛选和搜索功能的修复，包括新增的API端点和修改的端点。

## 修复的问题

1. **关键词筛选列表不完整**：之前只显示当前页的关键词，现在显示所有关键词
2. **搜索范围受限**：之前只能搜索当前筛选的数据，现在可以搜索所有数据

## 新增API端点

### GET /api/distillation/keywords

获取所有唯一的关键词列表。

**请求参数**：无

**响应示例**：
```json
{
  "keywords": ["AI技术", "健康养生", "雍禾植发", "智能家居"]
}
```

**说明**：
- 只返回有话题的关键词
- 按字母顺序排序
- 自动去重

**使用示例**：
```typescript
import { fetchAllKeywords } from '../api/distillationResultsApi';

const result = await fetchAllKeywords();
console.log(result.keywords); // ["AI技术", "健康养生", ...]
```

## 修改的API端点

### GET /api/distillation/results

获取带引用次数的蒸馏结果列表，现在支持全局搜索。

**新增参数**：
- `search` (string, 可选): 搜索话题内容的关键词

**完整参数列表**：
```typescript
{
  keyword?: string;      // 按关键词筛选
  provider?: string;     // 按AI模型筛选
  search?: string;       // 搜索话题内容（新增）
  page?: number;         // 页码（默认1）
  pageSize?: number;     // 每页数量（默认10）
}
```

**参数优先级**：
- 当提供 `search` 参数时，`keyword` 和 `provider` 参数会被忽略
- 搜索不区分大小写
- 搜索在所有话题的 `question` 字段中进行模糊匹配

**响应示例**：
```json
{
  "data": [
    {
      "id": 1,
      "distillationId": 10,
      "keyword": "AI技术",
      "question": "人工智能在医疗领域的应用有哪些？",
      "provider": "deepseek",
      "createdAt": "2024-01-15T10:30:00Z",
      "referenceCount": 5
    }
  ],
  "total": 100,
  "page": 1,
  "pageSize": 10,
  "statistics": {
    "totalTopics": 100,
    "totalKeywords": 15,
    "totalReferences": 250
  }
}
```

**使用示例**：

1. **按关键词筛选**：
```typescript
const result = await fetchResultsWithReferences({
  keyword: "AI技术",
  page: 1,
  pageSize: 10
});
```

2. **全局搜索**：
```typescript
const result = await fetchResultsWithReferences({
  search: "医疗",
  page: 1,
  pageSize: 10
});
// 注意：即使同时提供了keyword，也会被忽略
```

3. **按AI模型筛选**：
```typescript
const result = await fetchResultsWithReferences({
  provider: "deepseek",
  page: 1,
  pageSize: 10
});
```

## 前端实现要点

### 1. 独立加载关键词列表

```typescript
// 组件挂载时独立加载所有关键词
useEffect(() => {
  loadAllKeywords();
}, []);

const loadAllKeywords = async () => {
  try {
    const result = await fetchAllKeywords();
    setAllKeywords(result.keywords);
  } catch (error) {
    console.error('加载关键词列表失败:', error);
  }
};
```

### 2. 搜索和筛选互斥

```typescript
// 搜索时清空筛选
useEffect(() => {
  const timer = setTimeout(() => {
    if (searchInput.trim()) {
      setSearchText(searchInput);
      setFilterKeyword('');      // 清空关键词筛选
      setFilterProvider('');     // 清空模型筛选
      setIsSearchMode(true);
      setCurrentPage(1);
    }
  }, 300);
  return () => clearTimeout(timer);
}, [searchInput]);

// 筛选时清空搜索
const handleKeywordChange = (value: string) => {
  setFilterKeyword(value);
  setSearchInput('');
  setSearchText('');
  setIsSearchMode(false);
  setCurrentPage(1);
};
```

### 3. 搜索防抖

搜索输入延迟300ms后执行，避免频繁的API调用：

```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    setSearchText(searchInput);
  }, 300);
  return () => clearTimeout(timer);
}, [searchInput]);
```

### 4. UI反馈

- **搜索模式提示**：显示当前搜索的关键词
- **清除筛选按钮**：根据是否有活动筛选条件启用/禁用
- **空状态提示**：区分搜索无结果和筛选无结果

## 数据库实现

### 关键词查询

```sql
SELECT DISTINCT d.keyword
FROM distillations d
INNER JOIN topics t ON d.id = t.distillation_id
WHERE t.id IS NOT NULL
ORDER BY d.keyword ASC
```

### 搜索查询

```sql
SELECT 
  t.id,
  t.distillation_id,
  t.question,
  t.created_at,
  d.keyword,
  d.provider,
  COUNT(DISTINCT a.id) as reference_count
FROM topics t
LEFT JOIN distillations d ON t.distillation_id = d.id
LEFT JOIN articles a ON a.distillation_id = t.distillation_id 
  AND a.content LIKE '%' || t.question || '%'
WHERE LOWER(t.question) LIKE LOWER('%搜索词%')
GROUP BY t.id, t.distillation_id, t.question, t.created_at, d.keyword, d.provider
ORDER BY t.created_at DESC
LIMIT 10 OFFSET 0
```

## 性能优化

1. **数据库索引**：确保 `distillations.keyword` 和 `topics.question` 字段有索引
2. **搜索防抖**：前端300ms延迟，减少API调用
3. **分页**：支持分页，避免一次加载大量数据
4. **缓存**：关键词列表可以缓存5分钟

## 错误处理

### 后端错误

- **500**: 服务器内部错误，返回详细错误信息
- **400**: 参数验证失败

### 前端错误处理

```typescript
try {
  const result = await fetchAllKeywords();
  setAllKeywords(result.keywords);
} catch (error) {
  console.error('加载关键词列表失败:', error);
  // 不阻止其他功能使用，只记录错误
}
```

## 测试建议

1. **关键词列表测试**：
   - 验证返回所有唯一关键词
   - 验证按字母顺序排序
   - 验证只返回有话题的关键词

2. **搜索功能测试**：
   - 验证搜索能找到所有匹配的话题
   - 验证搜索不区分大小写
   - 验证搜索时忽略其他筛选条件

3. **互斥行为测试**：
   - 验证搜索时清空筛选
   - 验证筛选时清空搜索
   - 验证清除筛选的完整性

4. **UI测试**：
   - 验证搜索模式提示显示
   - 验证清除筛选按钮状态
   - 验证空状态提示

## 更新日志

### 2024-12-14
- 新增 GET /api/distillation/keywords 端点
- 修改 GET /api/distillation/results 端点支持search参数
- 前端重构：独立加载关键词列表
- 前端重构：搜索和筛选互斥逻辑
- 添加搜索模式UI反馈
- 优化空状态提示
