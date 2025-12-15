# 设计文档

## 概述

本设计将蒸馏结果页面从当前的卡片式布局改造为表格式布局，并增加被引用次数统计功能。改造涉及数据库查询优化、后端API增强和前端UI重构三个层面。

## 架构

### 系统层次

```
┌─────────────────────────────────────┐
│         前端展示层                    │
│  DistillationResultsPage.tsx        │
│  (Ant Design Table组件)              │
└──────────────┬──────────────────────┘
               │ HTTP API
┌──────────────▼──────────────────────┐
│         后端服务层                    │
│  distillationRoutes.ts               │
│  distillationService.ts              │
└──────────────┬──────────────────────┘
               │ SQL查询
┌──────────────▼──────────────────────┐
│         数据库层                      │
│  topics表 + articles表               │
│  (LEFT JOIN + COUNT聚合)             │
└─────────────────────────────────────┘
```

### 数据流

1. **查询流程**：前端 → GET /api/distillation/results → 后端执行JOIN查询 → 返回带引用次数的结果
2. **删除流程**：前端 → DELETE /api/distillation/topics → 后端删除topics记录 → 级联更新articles
3. **筛选流程**：前端本地筛选（已加载数据）或后端筛选（大数据量）

## 组件和接口

### 数据库层

#### 查询优化

现有表结构：
- `topics` 表：存储蒸馏结果（话题）
- `articles` 表：存储生成的文章，通过 `distillation_id` 关联

新增查询逻辑：
```sql
SELECT 
  t.id,
  t.distillation_id,
  t.question,
  t.created_at,
  d.keyword,
  d.provider,
  COUNT(a.id) as reference_count
FROM topics t
LEFT JOIN distillations d ON t.distillation_id = d.id
LEFT JOIN articles a ON a.distillation_id = t.distillation_id 
  AND a.content LIKE '%' || t.question || '%'
GROUP BY t.id, t.distillation_id, t.question, t.created_at, d.keyword, d.provider
ORDER BY t.created_at DESC
```

**注意**：由于当前数据库设计中，articles表通过`distillation_id`关联到distillations表，而不是直接关联到topics表，我们需要通过内容匹配来判断引用关系。这不是最优方案，但可以在不修改数据库结构的情况下实现功能。

#### 索引优化

现有索引已足够：
- `idx_topics_distillation` - 用于JOIN操作
- `idx_articles_distillation` - 用于JOIN操作
- `idx_articles_title` - 可用于内容搜索

### 后端API层

#### 新增/修改接口

**GET /api/distillation/results**

请求参数：
```typescript
{
  keyword?: string;      // 可选：按关键词筛选
  provider?: string;     // 可选：按AI模型筛选
  page?: number;         // 可选：页码（默认1）
  pageSize?: number;     // 可选：每页数量（默认10）
}
```

响应数据：
```typescript
{
  data: Array<{
    id: number;
    distillationId: number;
    keyword: string;
    question: string;
    provider: string;
    createdAt: string;
    referenceCount: number;
  }>;
  total: number;
  page: number;
  pageSize: number;
  statistics: {
    totalTopics: number;
    totalKeywords: number;
    totalReferences: number;
  };
}
```

**DELETE /api/distillation/topics**

请求体：
```typescript
{
  topicIds: number[];  // 要删除的话题ID数组
}
```

响应数据：
```typescript
{
  success: boolean;
  deletedCount: number;
}
```

#### 服务层实现

创建 `distillationService.ts` 中的新方法：

```typescript
// 获取带引用次数的蒸馏结果列表
async getResultsWithReferences(filters?: {
  keyword?: string;
  provider?: string;
  page?: number;
  pageSize?: number;
}): Promise<ResultsResponse>

// 批量删除话题
async deleteTopics(topicIds: number[]): Promise<{ deletedCount: number }>

// 获取统计信息
async getStatistics(filters?: {
  keyword?: string;
  provider?: string;
}): Promise<Statistics>
```

### 前端UI层

#### 组件结构

```
DistillationResultsPage
├── 统计卡片区域 (Row + Col + Statistic)
│   ├── 总话题数
│   ├── 关键词数量
│   ├── 总被引用次数
│   └── 当前显示数量
├── 筛选工具栏 (Space)
│   ├── 关键词下拉选择
│   ├── AI模型下拉选择
│   ├── 搜索框
│   └── 清除筛选按钮
├── 操作栏 (Space)
│   ├── 全选复选框
│   ├── 删除选中按钮
│   └── 刷新按钮
└── 数据表格 (Table)
    ├── 选择列 (Checkbox)
    ├── 关键词列 (Tag)
    ├── 蒸馏结果列 (Text)
    ├── 被引用次数列 (Badge/Number)
    └── 蒸馏时间列 (DateTime)
```

#### 表格列定义

```typescript
const columns = [
  {
    title: '选择',
    dataIndex: 'id',
    width: 60,
    render: (id) => <Checkbox />
  },
  {
    title: '关键词',
    dataIndex: 'keyword',
    width: 150,
    sorter: true,
    render: (text) => <Tag color="blue">{text}</Tag>
  },
  {
    title: '蒸馏结果',
    dataIndex: 'question',
    ellipsis: true,
    render: (text) => <Tooltip title={text}>{text}</Tooltip>
  },
  {
    title: '被引用次数',
    dataIndex: 'referenceCount',
    width: 120,
    sorter: true,
    render: (count) => (
      <Badge 
        count={count} 
        showZero 
        style={{ 
          backgroundColor: count > 0 ? '#52c41a' : '#d9d9d9' 
        }}
      />
    )
  },
  {
    title: '蒸馏时间',
    dataIndex: 'createdAt',
    width: 180,
    sorter: true,
    render: (date) => new Date(date).toLocaleString('zh-CN')
  }
];
```

## 数据模型

### TopicWithReference 接口

```typescript
interface TopicWithReference {
  id: number;
  distillationId: number;
  keyword: string;
  question: string;
  provider: 'deepseek' | 'gemini' | 'ollama';
  createdAt: string;
  referenceCount: number;
}
```

### ResultsResponse 接口

```typescript
interface ResultsResponse {
  data: TopicWithReference[];
  total: number;
  page: number;
  pageSize: number;
  statistics: {
    totalTopics: number;
    totalKeywords: number;
    totalReferences: number;
  };
}
```

### Statistics 接口

```typescript
interface Statistics {
  totalTopics: number;
  totalKeywords: number;
  totalReferences: number;
}
```

## 正确性属性

*属性是应该在系统所有有效执行中保持为真的特征或行为——本质上是关于系统应该做什么的形式化陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### 属性 1: 引用计数准确性

*对于任何*话题，其显示的引用次数应该等于articles表中实际引用该话题的文章数量，无论引用次数是0、1还是多次
**验证需求：需求 2.1, 2.2, 2.3**

### 属性 2: 删除操作完整性

*对于任何*被删除的话题ID集合，删除操作后这些话题既不应该出现在前端查询结果中，也不应该存在于数据库的topics表中
**验证需求：需求 4.3, 4.4**

### 属性 3: 筛选结果正确性

*对于任何*筛选条件（关键词、AI模型或搜索文本），返回的结果集中的每个话题都应该满足该筛选条件，且筛选后的统计信息应该与筛选结果一致
**验证需求：需求 3.1, 3.2, 3.3, 3.4**

### 属性 4: 筛选可逆性

*对于任何*应用的筛选条件，清除筛选后应该恢复显示完整的数据集，且数据集大小应该等于清除筛选前的总数据量
**验证需求：需求 3.5**

### 属性 5: 统计数据一致性

*对于任何*数据集（包括筛选后的数据），统计信息中的总话题数应该等于实际话题数量，关键词数量应该等于去重后的关键词数，总引用次数应该等于所有话题引用次数之和
**验证需求：需求 5.1, 5.2, 5.3, 5.4**

### 属性 6: 表格列完整性

*对于任何*蒸馏结果数据，渲染后的表格应该包含关键词、蒸馏结果、被引用次数和蒸馏时间这四列
**验证需求：需求 1.2**

### 属性 7: 默认排序正确性

*对于任何*未指定排序条件的查询，返回的结果应该按照蒸馏时间倒序排列（最新的在前）
**验证需求：需求 1.3**

### 属性 8: 排序功能正确性

*对于任何*可排序的列和任何数据集，按该列排序后的结果应该符合升序或降序规则
**验证需求：需求 1.5**

### 属性 9: 选择状态一致性

*对于任何*表格行，勾选后该行应该被标记为选中状态，且全选操作应该选中当前页的所有行
**验证需求：需求 4.1, 4.2**

### 属性 10: 引用计数更新一致性

*对于任何*被删除的文章，如果该文章引用了某个话题，则该话题的引用计数应该相应减少
**验证需求：需求 2.4**

### 属性 11: API响应格式完整性

*对于任何*前端请求，后端API响应应该包含完整的数据结构，包括话题数据、引用次数和统计信息
**验证需求：需求 6.3**

### 属性 12: 错误处理正确性

*对于任何*查询失败的情况，系统应该返回明确的错误信息并记录日志
**验证需求：需求 6.5**

## 错误处理

### 数据库层错误

1. **查询失败**：捕获SQL错误，返回500状态码和错误信息
2. **连接超时**：实现重试机制，最多重试3次
3. **数据不一致**：记录警告日志，返回部分数据

### API层错误

1. **参数验证失败**：返回400状态码和具体错误信息
2. **资源不存在**：返回404状态码
3. **删除失败**：返回500状态码，回滚事务

### 前端错误

1. **网络请求失败**：显示错误提示，提供重试按钮
2. **数据加载失败**：显示空状态页面，引导用户刷新
3. **删除操作失败**：显示错误消息，不更新本地状态

## 测试策略

### 单元测试

**后端服务层测试**：
- 测试 `getResultsWithReferences` 方法返回正确的数据结构
- 测试筛选参数正确应用到SQL查询
- 测试 `deleteTopics` 方法正确删除记录
- 测试统计信息计算准确性

**前端组件测试**：
- 测试表格正确渲染数据
- 测试筛选功能正确过滤数据
- 测试排序功能正确排列数据
- 测试删除操作正确更新UI

### 集成测试

- 测试完整的查询流程：前端请求 → 后端查询 → 数据返回
- 测试完整的删除流程：前端删除 → 后端删除 → 数据库更新 → 前端刷新
- 测试筛选和分页的组合使用

### 属性测试

使用 `fast-check` 库进行属性测试：

**属性 1 测试**：
```typescript
fc.assert(
  fc.property(
    fc.array(topicGenerator),
    fc.array(articleGenerator),
    async (topics, articles) => {
      // 插入测试数据
      await insertTopics(topics);
      await insertArticles(articles);
      
      // 查询结果
      const results = await getResultsWithReferences();
      
      // 验证每个话题的引用次数
      for (const result of results.data) {
        const expectedCount = articles.filter(a => 
          a.content.includes(result.question)
        ).length;
        expect(result.referenceCount).toBe(expectedCount);
      }
    }
  )
);
```

**属性 2 测试**：
```typescript
fc.assert(
  fc.property(
    fc.array(topicGenerator),
    fc.array(fc.integer({ min: 0 })),
    async (topics, deleteIndices) => {
      // 插入测试数据
      const inserted = await insertTopics(topics);
      
      // 选择要删除的ID
      const idsToDelete = deleteIndices
        .map(i => inserted[i % inserted.length]?.id)
        .filter(Boolean);
      
      // 执行删除
      await deleteTopics(idsToDelete);
      
      // 查询结果
      const results = await getResultsWithReferences();
      
      // 验证删除的话题不在结果中
      const resultIds = results.data.map(r => r.id);
      for (const id of idsToDelete) {
        expect(resultIds).not.toContain(id);
      }
    }
  )
);
```

## 性能考虑

### 数据库优化

1. **使用LEFT JOIN而非子查询**：减少查询次数
2. **添加LIMIT和OFFSET**：支持分页，减少数据传输
3. **使用COUNT聚合**：一次查询获取引用次数

### 前端优化

1. **虚拟滚动**：当数据量超过1000条时启用虚拟滚动
2. **本地筛选**：对已加载数据进行本地筛选，减少API调用
3. **防抖搜索**：搜索输入延迟300ms后执行，避免频繁请求

### 缓存策略

1. **后端缓存**：使用Redis缓存统计信息（5分钟过期）
2. **前端缓存**：使用React Query缓存查询结果（1分钟过期）

## 实现注意事项

### 数据库关联问题

当前数据库设计中，`articles`表通过`distillation_id`关联到`distillations`表，而不是直接关联到`topics`表。这意味着：

1. **引用计数的实现方式**：需要通过内容匹配（`LIKE`查询）来判断文章是否引用了某个话题
2. **性能影响**：`LIKE`查询可能影响性能，建议：
   - 限制查询范围（只查询相同distillation_id的文章）
   - 考虑添加全文索引
   - 未来可考虑在articles表添加topic_id字段

### 向后兼容

1. 保留原有的LocalStorage存储逻辑，确保与其他页面的兼容性
2. 保留原有的API端点，新增端点不影响现有功能
3. 渐进式迁移：先实现新页面，测试稳定后再移除旧代码

### 用户体验

1. **加载状态**：显示骨架屏而非空白页面
2. **错误提示**：使用友好的错误消息，提供解决建议
3. **操作反馈**：删除、筛选等操作提供即时反馈
4. **数据刷新**：提供手动刷新按钮，自动刷新间隔5分钟
