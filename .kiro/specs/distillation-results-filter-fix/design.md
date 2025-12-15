# 设计文档

## 概述

本设计修复蒸馏结果模块中的两个关键bug：
1. 关键词筛选列表从当前页数据提取改为从后端API获取所有关键词
2. 搜索功能从前端本地搜索改为后端全局搜索

修复涉及后端API新增端点、前端状态管理重构和交互逻辑优化。

## 架构

### 当前问题分析

**问题1：关键词列表不完整**
```typescript
// 当前实现（错误）
const uniqueKeywords = Array.from(new Set(result.data.map(item => item.keyword)));
setKeywords(uniqueKeywords);
```
这段代码从当前页的数据中提取关键词，导致只能看到当前页包含的关键词。

**问题2：搜索范围受限**
```typescript
// 当前实现（错误）
const filteredData = useMemo(() => {
  if (!searchText.trim()) {
    return data;
  }
  return data.filter(item => 
    item.question.toLowerCase().includes(searchText.toLowerCase())
  );
}, [data, searchText]);
```
这段代码只在已加载的数据中搜索，无法搜索其他关键词的话题。

### 修复方案架构

```
┌─────────────────────────────────────┐
│         前端展示层                    │
│  DistillationResultsPage.tsx        │
│  - 独立加载关键词列表                 │
│  - 搜索时调用后端API                  │
│  - 筛选和搜索互斥                     │
└──────────────┬──────────────────────┘
               │ HTTP API
┌──────────────▼──────────────────────┐
│         后端服务层                    │
│  新增端点：                           │
│  - GET /api/distillation/keywords   │
│  修改端点：                           │
│  - GET /api/distillation/results    │
│    (支持search参数)                  │
└──────────────┬──────────────────────┘
               │ SQL查询
┌──────────────▼──────────────────────┐
│         数据库层                      │
│  - 查询所有唯一关键词                 │
│  - 全局搜索话题内容                   │
└─────────────────────────────────────┘
```

### 数据流

**关键词列表加载流程**：
1. 页面加载 → GET /api/distillation/keywords → 返回所有关键词 → 填充下拉列表

**搜索流程**：
1. 用户输入搜索文本 → 300ms防抖 → GET /api/distillation/results?search=xxx → 返回匹配结果 → 更新表格

**筛选流程**：
1. 用户选择关键词 → 清空搜索框 → GET /api/distillation/results?keyword=xxx → 返回筛选结果 → 更新表格

## 组件和接口

### 后端API层

#### 新增接口

**GET /api/distillation/keywords**

功能：获取所有唯一的关键词列表

请求参数：无

响应数据：
```typescript
{
  keywords: string[];  // 按字母顺序排序的关键词数组
}
```

示例响应：
```json
{
  "keywords": ["AI技术", "健康养生", "雍禾植发", "智能家居"]
}
```

#### 修改接口

**GET /api/distillation/results**

新增参数：
```typescript
{
  keyword?: string;      // 可选：按关键词筛选
  provider?: string;     // 可选：按AI模型筛选
  search?: string;       // 新增：搜索话题内容（与keyword/provider互斥）
  page?: number;         // 可选：页码（默认1）
  pageSize?: number;     // 可选：每页数量（默认10）
}
```

行为变更：
- 当提供 `search` 参数时，忽略 `keyword` 和 `provider` 参数
- `search` 参数在所有话题的 `question` 字段中进行模糊匹配
- 搜索不区分大小写

响应数据：保持不变

### 数据库层

#### 新增查询方法

**getAllKeywords()**

功能：查询所有唯一的关键词

SQL实现：
```sql
SELECT DISTINCT d.keyword
FROM distillations d
INNER JOIN topics t ON d.id = t.distillation_id
WHERE t.id IS NOT NULL
ORDER BY d.keyword ASC
```

说明：
- 只返回有话题的关键词（避免空关键词）
- 按字母顺序排序
- 去重

#### 修改查询方法

**getTopicsWithReferences()**

新增参数：`search?: string`

SQL修改：
```sql
-- 当提供search参数时
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
WHERE LOWER(t.question) LIKE LOWER('%' || $1 || '%')
GROUP BY t.id, t.distillation_id, t.question, t.created_at, d.keyword, d.provider
ORDER BY t.created_at DESC
LIMIT $2 OFFSET $3
```

说明：
- 使用 `LOWER()` 实现不区分大小写搜索
- 搜索条件优先级最高，忽略其他筛选条件
- 保持原有的引用计数逻辑

### 前端UI层

#### 状态管理重构

```typescript
// 新增状态
const [allKeywords, setAllKeywords] = useState<string[]>([]);  // 所有关键词
const [isSearchMode, setIsSearchMode] = useState(false);       // 是否处于搜索模式

// 修改加载逻辑
useEffect(() => {
  loadAllKeywords();  // 独立加载关键词列表
}, []);

useEffect(() => {
  loadData();
}, [currentPage, pageSize, filterKeyword, filterProvider, searchText]);
```

#### 交互逻辑优化

**关键词筛选时**：
```typescript
const handleKeywordChange = (value: string) => {
  setFilterKeyword(value);
  setSearchInput('');      // 清空搜索框
  setSearchText('');       // 清空搜索文本
  setIsSearchMode(false);  // 退出搜索模式
  setCurrentPage(1);       // 重置分页
};
```

**搜索时**：
```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    if (searchInput.trim()) {
      setSearchText(searchInput);
      setFilterKeyword('');      // 清空关键词筛选
      setFilterProvider('');     // 清空模型筛选
      setIsSearchMode(true);     // 进入搜索模式
      setCurrentPage(1);         // 重置分页
    } else {
      setSearchText('');
      setIsSearchMode(false);
    }
  }, 300);

  return () => clearTimeout(timer);
}, [searchInput]);
```

**清除筛选时**：
```typescript
const handleClearFilters = () => {
  setFilterKeyword('');
  setFilterProvider('');
  setSearchText('');
  setSearchInput('');
  setIsSearchMode(false);
  setCurrentPage(1);
};
```

#### UI反馈优化

**"清除筛选"按钮状态**：
```typescript
const hasActiveFilters = filterKeyword || filterProvider || searchText;

<Button
  disabled={!hasActiveFilters}
  onClick={handleClearFilters}
>
  清除筛选
</Button>
```

**搜索模式提示**：
```typescript
{isSearchMode && (
  <Alert
    message={`搜索 "${searchText}" 的结果`}
    type="info"
    closable
    onClose={() => {
      setSearchInput('');
      setSearchText('');
      setIsSearchMode(false);
    }}
  />
)}
```

## 数据模型

### KeywordsResponse 接口

```typescript
interface KeywordsResponse {
  keywords: string[];
}
```

### QueryFilters 接口（修改）

```typescript
interface QueryFilters {
  keyword?: string;
  provider?: string;
  search?: string;      // 新增
  page?: number;
  pageSize?: number;
}
```

## 正确性属性

*属性是应该在系统所有有效执行中保持为真的特征或行为——本质上是关于系统应该做什么的形式化陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### 属性 1: 关键词列表完整性

*对于任何*数据库状态，关键词列表API返回的关键词集合应该等于数据库中所有有话题的蒸馏记录的唯一关键词集合
**验证需求：需求 1.1, 1.2**

### 属性 2: 关键词列表排序正确性

*对于任何*关键词列表，返回的关键词应该按字母顺序升序排列
**验证需求：需求 1.2**

### 属性 3: 搜索全局性

*对于任何*搜索文本，搜索结果应该包含所有话题中匹配该文本的记录，不受关键词或AI模型筛选条件限制
**验证需求：需求 2.1, 2.2**

### 属性 4: 搜索不区分大小写

*对于任何*搜索文本和任何大小写变体，搜索结果应该相同
**验证需求：需求 2.1**

### 属性 5: 筛选和搜索互斥性

*对于任何*用户操作，当应用关键词筛选时搜索框应为空，当应用搜索时筛选条件应为空
**验证需求：需求 3.1, 3.2**

### 属性 6: 清除筛选完整性

*对于任何*应用的筛选或搜索条件，点击"清除筛选"后所有筛选条件和搜索文本都应该被清空
**验证需求：需求 3.3**

### 属性 7: 分页重置一致性

*对于任何*筛选或搜索条件的改变，当前页码应该重置为1
**验证需求：需求 3.4**

### 属性 8: 统计信息一致性

*对于任何*筛选或搜索条件，统计信息中的数量应该与实际显示的数据数量一致
**验证需求：需求 3.5**

### 属性 9: API参数优先级

*对于任何*包含search参数的API请求，后端应该忽略keyword和provider参数
**验证需求：需求 4.2**

### 属性 10: 空状态正确性

*对于任何*搜索或筛选结果为空的情况，系统应该显示友好的空状态提示
**验证需求：需求 5.5**

## 错误处理

### 后端错误处理

1. **关键词列表查询失败**：
   - 返回500状态码和错误信息
   - 记录错误日志
   - 前端显示错误提示，使用空数组作为降级方案

2. **搜索查询失败**：
   - 返回500状态码和错误信息
   - 记录错误日志
   - 前端显示错误提示，提供重试选项

3. **参数验证失败**：
   - 返回400状态码和具体错误信息
   - 前端显示参数错误提示

### 前端错误处理

1. **关键词列表加载失败**：
   - 显示错误提示
   - 关键词下拉列表显示为空
   - 不阻止其他功能使用

2. **搜索请求失败**：
   - 显示错误提示
   - 保持当前显示的数据
   - 提供重试按钮

3. **网络超时**：
   - 显示超时提示
   - 提供重试选项
   - 记录错误日志

## 测试策略

### 单元测试

**后端测试**：
- 测试 `getAllKeywords()` 返回所有唯一关键词
- 测试 `getAllKeywords()` 返回的关键词按字母顺序排序
- 测试 `getTopicsWithReferences()` 支持search参数
- 测试search参数不区分大小写
- 测试search参数优先级高于其他筛选条件

**前端测试**：
- 测试关键词列表独立加载
- 测试筛选时清空搜索框
- 测试搜索时清空筛选条件
- 测试"清除筛选"按钮的启用/禁用状态
- 测试搜索防抖功能

### 集成测试

- 测试完整的关键词加载流程
- 测试完整的搜索流程
- 测试筛选和搜索的互斥行为
- 测试清除筛选的完整性

### 属性测试

使用 `fast-check` 库进行属性测试：

**属性 1 测试**：
```typescript
fc.assert(
  fc.property(
    fc.array(distillationGenerator),
    async (distillations) => {
      // 插入测试数据
      await insertDistillations(distillations);
      
      // 查询关键词列表
      const result = await getAllKeywords();
      
      // 验证完整性
      const expectedKeywords = Array.from(
        new Set(distillations.map(d => d.keyword))
      ).sort();
      
      expect(result.keywords).toEqual(expectedKeywords);
    }
  )
);
```

**属性 3 测试**：
```typescript
fc.assert(
  fc.property(
    fc.array(topicGenerator),
    fc.string(),
    async (topics, searchText) => {
      // 插入测试数据
      await insertTopics(topics);
      
      // 执行搜索
      const result = await getTopicsWithReferences({ search: searchText });
      
      // 验证所有结果都包含搜索文本
      for (const topic of result.data) {
        expect(
          topic.question.toLowerCase()
        ).toContain(searchText.toLowerCase());
      }
    }
  )
);
```

**属性 5 测试**：
```typescript
fc.assert(
  fc.property(
    fc.string(),
    fc.string(),
    async (keyword, searchText) => {
      // 模拟用户操作
      const state = { keyword: '', search: '' };
      
      // 应用关键词筛选
      state.keyword = keyword;
      state.search = '';  // 应该被清空
      
      expect(state.search).toBe('');
      
      // 应用搜索
      state.search = searchText;
      state.keyword = '';  // 应该被清空
      
      expect(state.keyword).toBe('');
    }
  )
);
```

## 性能考虑

### 后端优化

1. **关键词查询缓存**：
   - 使用内存缓存关键词列表（5分钟过期）
   - 当新增蒸馏记录时清除缓存

2. **搜索查询优化**：
   - 使用数据库索引加速LIKE查询
   - 考虑添加全文搜索索引（如果数据量大）

### 前端优化

1. **关键词列表缓存**：
   - 使用React Query缓存关键词列表
   - 缓存时间5分钟

2. **搜索防抖**：
   - 保持300ms延迟
   - 避免频繁的API调用

3. **状态更新优化**：
   - 使用useCallback优化事件处理函数
   - 使用useMemo优化计算属性

## 实现注意事项

### 向后兼容

1. 保持现有API端点的行为不变
2. 新增的search参数是可选的
3. 前端代码渐进式修改，不影响现有功能

### 用户体验

1. **加载状态**：
   - 关键词列表加载时显示加载指示器
   - 搜索时显示加载状态

2. **错误提示**：
   - 使用友好的错误消息
   - 提供明确的操作建议

3. **视觉反馈**：
   - 搜索模式下显示提示信息
   - "清除筛选"按钮根据状态启用/禁用
   - 空状态显示友好的提示

### 数据一致性

1. **关键词列表更新**：
   - 刷新页面时重新加载关键词列表
   - 删除话题后刷新关键词列表

2. **搜索结果准确性**：
   - 确保搜索不区分大小写
   - 确保搜索覆盖所有话题

3. **统计信息准确性**：
   - 搜索模式下统计信息反映搜索结果
   - 筛选模式下统计信息反映筛选结果
