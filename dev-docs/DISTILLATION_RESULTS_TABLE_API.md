# 蒸馏结果表格视图 API 文档

## 概述

本文档描述了蒸馏结果表格视图功能的API端点，包括查询带引用次数的话题列表和批量删除话题。

## API 端点

### 1. 获取蒸馏结果列表（带引用次数）

**端点**: `GET /api/distillation/results`

**描述**: 获取所有蒸馏结果（话题）列表，包含每个话题在文章生成中的被引用次数。

**查询参数**:
- `keyword` (可选): 按关键词筛选
- `provider` (可选): 按AI模型筛选 (`deepseek` | `gemini` | `ollama`)
- `page` (可选): 页码，默认为 1
- `pageSize` (可选): 每页数量，默认为 10，最大 100

**响应示例**:
```json
{
  "data": [
    {
      "id": 1,
      "distillationId": 5,
      "keyword": "英国留学",
      "question": "英国留学需要准备哪些材料？",
      "provider": "deepseek",
      "createdAt": "2024-01-15T10:30:00Z",
      "referenceCount": 3
    }
  ],
  "total": 50,
  "page": 1,
  "pageSize": 10,
  "statistics": {
    "totalTopics": 50,
    "totalKeywords": 5,
    "totalReferences": 120
  }
}
```

**错误响应**:
- `400 Bad Request`: 参数验证失败
- `500 Internal Server Error`: 服务器错误

### 2. 批量删除话题

**端点**: `DELETE /api/distillation/topics`

**描述**: 批量删除指定的话题记录。

**请求体**:
```json
{
  "topicIds": [1, 2, 3, 4, 5]
}
```

**响应示例**:
```json
{
  "success": true,
  "deletedCount": 5
}
```

**错误响应**:
- `400 Bad Request`: 参数验证失败（topicIds不是数组或包含无效ID）
- `500 Internal Server Error`: 删除操作失败

## 数据模型

### TopicWithReference

```typescript
interface TopicWithReference {
  id: number;                    // 话题ID
  distillationId: number;        // 所属蒸馏记录ID
  keyword: string;               // 关键词
  question: string;              // 话题内容
  provider: string;              // AI模型提供商
  createdAt: string;             // 创建时间
  referenceCount: number;        // 被引用次数
}
```

### Statistics

```typescript
interface Statistics {
  totalTopics: number;           // 总话题数
  totalKeywords: number;         // 关键词数量
  totalReferences: number;       // 总被引用次数
}
```

## 使用示例

### 前端调用示例

```typescript
import { fetchResultsWithReferences, deleteTopics } from '@/api/distillationResultsApi';

// 获取第一页数据
const result = await fetchResultsWithReferences({
  page: 1,
  pageSize: 10
});

// 按关键词筛选
const filtered = await fetchResultsWithReferences({
  keyword: '英国留学',
  page: 1,
  pageSize: 10
});

// 删除话题
const deleteResult = await deleteTopics([1, 2, 3]);
console.log(`成功删除 ${deleteResult.deletedCount} 个话题`);
```

## 注意事项

1. **引用计数计算**: 由于当前数据库设计中articles表通过distillation_id关联，引用次数通过内容匹配（LIKE查询）计算。这可能影响大数据量时的性能。

2. **分页**: 建议使用分页查询，避免一次性加载过多数据。

3. **删除操作**: 删除话题是永久性操作，无法恢复。建议在删除前进行确认。

4. **筛选性能**: 关键词和AI模型筛选在数据库层面执行，性能较好。搜索功能在前端本地执行。

## 更新日志

- 2024-01-15: 初始版本，添加查询和删除API
