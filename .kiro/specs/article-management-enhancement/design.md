# Design Document

## Overview

本设计文档描述了文章管理模块的增强功能架构和实现方案。该增强将为文章管理提供统计数据展示、多维度筛选搜索和批量操作功能，参考蒸馏结果模块的最佳实践，提供更强大和便捷的管理能力。

设计遵循以下原则：

- **数据一致性**: 确保统计数据与实际数据保持同步，删除操作正确维护关联数据
- **用户体验**: 提供直观的统计展示、灵活的筛选组合和便捷的批量操作
- **性能优化**: 使用高效的SQL查询和索引，确保统计和筛选的快速响应
- **代码复用**: 最大化利用现有的API和组件，保持代码一致性

## Architecture

### 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端层 (React)                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  ArticleListPage (增强版)                                │ │
│  │  - 统计卡片区域                                           │ │
│  │  - 筛选搜索工具栏                                         │ │
│  │  - 批量操作按钮                                           │ │
│  │  - 文章列表表格（带复选框）                               │ │
│  └──────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                      API层 (Axios)                           │
│  GET    /api/articles/stats                                 │
│  GET    /api/articles/stats/keywords                        │
│  GET    /api/articles (增强：支持多筛选参数)                 │
│  DELETE /api/articles/batch                                 │
│  DELETE /api/articles/all                                   │
├─────────────────────────────────────────────────────────────┤
│                    后端层 (Express)                          │
│  articleRouter (增强)                                        │
│  - 统计端点                                                  │
│  - 增强的列表查询（多条件筛选）                               │
│  - 批量删除端点                                              │
│  - 删除所有端点                                              │
├─────────────────────────────────────────────────────────────┤
│                    数据层 (PostgreSQL)                       │
│  articles 表                                                 │
│  distillations 表                                            │
│  distillation_usage 表                                       │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 前端组件

#### 1. ArticleListPage 组件增强

```typescript
interface ArticleStats {
  total: number;
  published: number;
  unpublished: number;
}

interface KeywordStats {
  keyword: string;
  count: number;
}

interface FilterState {
  publishStatus: 'all' | 'published' | 'unpublished';
  distillationId: number | null;
  searchKeyword: string;
}

interface ArticleListPageState {
  articles: Article[];
  stats: ArticleStats;
  keywordStats: KeywordStats[];
  filters: FilterState;
  selectedIds: Set<number>;
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
}
```


#### 2. 统计卡片组件

```typescript
interface StatsCardProps {
  title: string;
  value: number;
  color: string;
  onClick?: () => void;
}

// 显示三个统计卡片：总数、已发布、未发布
```

#### 3. 筛选工具栏组件

```typescript
interface FilterToolbarProps {
  filters: FilterState;
  distillations: Array<{ id: number; keyword: string }>;
  onFilterChange: (filters: FilterState) => void;
}

// 包含：发布状态下拉框、话题下拉框、关键词搜索框
```

#### 4. 批量操作工具栏

```typescript
interface BatchActionsProps {
  selectedCount: number;
  totalCount: number;
  onDeleteSelected: () => void;
  onDeleteAll: () => void;
}

// 显示选中数量、删除选中按钮、删除所有按钮
```

### API接口

#### 新增接口

```typescript
// 获取统计数据
GET /api/articles/stats
Response: {
  total: number;
  published: number;
  unpublished: number;
}

// 获取关键词统计
GET /api/articles/stats/keywords
Response: {
  keywords: Array<{
    keyword: string;
    count: number;
  }>;
}

// 批量删除文章
DELETE /api/articles/batch
Body: {
  ids: number[];
}
Response: {
  success: boolean;
  deletedCount: number;
}

// 删除所有文章
DELETE /api/articles/all
Response: {
  success: boolean;
  deletedCount: number;
}
```

#### 增强现有接口

```typescript
// 增强的文章列表查询
GET /api/articles?page=1&pageSize=10&publishStatus=published&distillationId=5&keyword=SEO
Query Parameters:
- page: number (分页页码)
- pageSize: number (每页数量)
- publishStatus: 'all' | 'published' | 'unpublished' (发布状态筛选)
- distillationId: number (话题筛选)
- keyword: string (关键词搜索)

Response: {
  articles: Article[];
  total: number;
  page: number;
  pageSize: number;
}
```

## Data Models

### 数据库表结构（现有）

```sql
-- 文章表
CREATE TABLE articles (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500),
  keyword VARCHAR(255) NOT NULL,
  distillation_id INTEGER REFERENCES distillations(id),
  task_id INTEGER REFERENCES generation_tasks(id),
  requirements TEXT,
  content TEXT NOT NULL,
  image_url TEXT,
  provider VARCHAR(20) NOT NULL,
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 蒸馏结果表
CREATE TABLE distillations (
  id SERIAL PRIMARY KEY,
  keyword VARCHAR(255) NOT NULL,
  provider VARCHAR(20) NOT NULL,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 使用记录表
CREATE TABLE distillation_usage (
  id SERIAL PRIMARY KEY,
  distillation_id INTEGER REFERENCES distillations(id) ON DELETE CASCADE,
  article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 索引优化

```sql
-- 为筛选和统计查询添加索引
CREATE INDEX idx_articles_is_published ON articles(is_published);
CREATE INDEX idx_articles_distillation_id ON articles(distillation_id);
CREATE INDEX idx_articles_keyword ON articles(keyword);
CREATE INDEX idx_articles_created_at ON articles(created_at DESC);
```


### URL状态管理

```typescript
// URL查询参数格式
/articles?status=published&topic=5&search=SEO&page=2

// 参数映射
interface URLParams {
  status?: 'all' | 'published' | 'unpublished';
  topic?: string; // distillationId
  search?: string; // keyword
  page?: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 统计数据准确性

*For any* 时刻查询统计数据，返回的总数应该等于已发布数加未发布数，且每个数值应该与数据库中实际的文章数量一致

**Validates: Requirements 1.1, 1.2**

### Property 2: 关键词统计完整性

*For any* 时刻查询关键词统计，返回的每个关键词的文章数量应该与数据库中该关键词的实际文章数量一致，且所有有文章的关键词都应该出现在统计列表中

**Validates: Requirements 2.1, 2.4**

### Property 3: 发布状态筛选正确性

*For any* 发布状态筛选条件（已发布/未发布/全部），返回的文章列表中所有文章的is_published字段应该符合筛选条件

**Validates: Requirements 4.2, 4.3, 4.4**

### Property 4: 话题筛选正确性

*For any* 选中的话题（distillationId），返回的文章列表中所有文章的distillation_id应该等于选中的话题ID

**Validates: Requirements 5.3**

### Property 5: 关键词搜索正确性

*For any* 搜索关键词，返回的文章列表中所有文章的keyword字段应该包含该搜索关键词（不区分大小写）

**Validates: Requirements 6.2**

### Property 6: 组合筛选AND逻辑

*For any* 同时应用的多个筛选条件（发布状态、话题、关键词搜索），返回的文章列表中所有文章应该同时满足所有筛选条件

**Validates: Requirements 11.1, 11.2, 11.3**

### Property 7: 批量删除原子性

*For any* 批量删除操作，要么所有选中的文章都被删除（包括关联数据），要么在发生错误时所有文章都保持不变

**Validates: Requirements 8.4, 10.2, 10.3**

### Property 8: 删除后统计一致性

*For any* 删除操作（单个、批量或全部），删除完成后的统计数据应该准确反映删除后的文章数量

**Validates: Requirements 8.5, 1.2**

### Property 9: 删除后usage_count一致性

*For any* 删除的文章，对应蒸馏结果的usage_count应该减少相应的数量，且不会小于0

**Validates: Requirements 10.1**

### Property 10: 级联删除完整性

*For any* 删除的文章，所有关联的distillation_usage记录应该被自动删除

**Validates: Requirements 10.4**

### Property 11: 选中状态跨页保持

*For any* 在某页选中的文章，切换到其他页面后再返回，这些文章的选中状态应该保持不变

**Validates: Requirements 7.4**

### Property 12: URL状态同步

*For any* 应用的筛选条件，URL查询参数应该准确反映这些筛选条件，且从URL恢复的筛选条件应该与原始条件一致

**Validates: Requirements 12.1, 12.2, 12.3**

### Property 13: 话题列表完整性

*For any* 时刻查询话题下拉框数据，返回的话题列表应该包含所有至少有一篇文章关联的蒸馏关键词

**Validates: Requirements 5.2**

### Property 14: 筛选条件独立性

*For any* 清除某个筛选条件，其他筛选条件应该保持不变，且结果应该只反映剩余的筛选条件

**Validates: Requirements 11.4**

## Error Handling

### 前端错误处理

1. **API调用失败**
   - 统计数据加载失败：显示错误提示，使用默认值（0）
   - 文章列表加载失败：显示错误消息，保持当前列表
   - 删除操作失败：显示具体错误信息，不刷新列表

2. **数据验证错误**
   - 无效的筛选参数：使用默认值
   - 无效的URL参数：忽略无效参数，使用默认筛选
   - 空的选中列表：禁用批量删除按钮

3. **用户操作错误**
   - 删除确认取消：不执行任何操作
   - 网络超时：显示重试选项
   - 并发操作冲突：刷新数据后重试


### 后端错误处理

1. **参数验证错误**
   - 无效的分页参数：返回400状态码和错误消息
   - 无效的筛选参数：返回400状态码和错误消息
   - 空的删除ID列表：返回400状态码

2. **数据库错误**
   - 查询失败：返回500状态码和错误详情
   - 事务失败：自动回滚，返回500状态码
   - 外键约束违反：返回400状态码和友好提示

3. **业务逻辑错误**
   - 删除不存在的文章：跳过该ID，继续处理其他ID
   - 统计查询超时：返回503状态码，建议重试
   - 并发删除冲突：使用数据库锁机制处理

## Testing Strategy

### 单元测试

**前端组件测试**
- 统计卡片组件渲染和点击事件
- 筛选工具栏组件的筛选条件变更
- 批量操作工具栏的按钮状态
- 复选框选中状态管理
- URL参数解析和生成

**后端API测试**
- 统计端点返回正确的数据格式和数值
- 筛选查询构建正确的SQL条件
- 批量删除正确处理ID列表
- 错误场景的状态码和消息

**测试工具**: React Testing Library, Jest, Supertest

### 集成测试

**端到端筛选流程**
- 应用单个筛选条件 → 验证结果
- 应用多个筛选条件 → 验证AND逻辑
- 清除筛选条件 → 验证恢复默认状态

**批量操作流程**
- 选中文章 → 批量删除 → 验证数据和统计更新
- 删除所有 → 验证数据库清空和UI空状态

**数据一致性测试**
- 删除文章 → 验证usage_count更新
- 批量删除 → 验证事务原子性
- 级联删除 → 验证关联记录清理

### 属性测试

使用fast-check库进行属性测试，每个测试运行100次迭代：

**Property 1: 统计数据准确性测试**
- 生成随机数量的文章（不同发布状态）
- 调用统计API
- 验证total = published + unpublished
- 验证每个数值与数据库一致
- 标签: `Feature: article-management-enhancement, Property 1: 统计数据准确性`

**Property 2: 关键词统计完整性测试**
- 生成随机文章（不同关键词）
- 调用关键词统计API
- 验证每个关键词的count与实际一致
- 验证所有有文章的关键词都在列表中
- 标签: `Feature: article-management-enhancement, Property 2: 关键词统计完整性`

**Property 3: 发布状态筛选正确性测试**
- 生成随机文章（混合发布状态）
- 对每种筛选条件（已发布/未发布/全部）进行测试
- 验证返回的文章都符合筛选条件
- 标签: `Feature: article-management-enhancement, Property 3: 发布状态筛选正确性`

**Property 4: 话题筛选正确性测试**
- 生成随机文章（不同distillationId）
- 随机选择一个distillationId进行筛选
- 验证返回的文章都属于该话题
- 标签: `Feature: article-management-enhancement, Property 4: 话题筛选正确性`

**Property 5: 关键词搜索正确性测试**
- 生成随机文章（不同关键词）
- 随机生成搜索关键词
- 验证返回的文章keyword都包含搜索词
- 标签: `Feature: article-management-enhancement, Property 5: 关键词搜索正确性`

**Property 6: 组合筛选AND逻辑测试**
- 生成随机文章
- 随机组合多个筛选条件
- 验证返回的文章同时满足所有条件
- 标签: `Feature: article-management-enhancement, Property 6: 组合筛选AND逻辑`

**Property 7: 批量删除原子性测试**
- 生成随机文章
- 随机选择部分文章进行批量删除
- 模拟删除过程中的错误
- 验证要么全部删除，要么全部保留
- 标签: `Feature: article-management-enhancement, Property 7: 批量删除原子性`

**Property 8: 删除后统计一致性测试**
- 生成随机文章
- 执行删除操作（单个/批量/全部）
- 验证删除后统计数据准确
- 标签: `Feature: article-management-enhancement, Property 8: 删除后统计一致性`

**Property 9: 删除后usage_count一致性测试**
- 生成随机文章和蒸馏结果
- 删除文章
- 验证对应蒸馏结果的usage_count正确减少
- 验证usage_count不会小于0
- 标签: `Feature: article-management-enhancement, Property 9: 删除后usage_count一致性`

**Property 10: 级联删除完整性测试**
- 生成随机文章和distillation_usage记录
- 删除文章
- 验证关联的distillation_usage记录被删除
- 标签: `Feature: article-management-enhancement, Property 10: 级联删除完整性`

**Property 11: 选中状态跨页保持测试**
- 生成随机文章（多页）
- 在不同页面选中文章
- 切换页面
- 验证选中状态保持
- 标签: `Feature: article-management-enhancement, Property 11: 选中状态跨页保持`

**Property 12: URL状态同步测试**
- 生成随机筛选条件
- 应用筛选条件
- 验证URL参数正确
- 从URL恢复筛选条件
- 验证恢复的条件与原始一致
- 标签: `Feature: article-management-enhancement, Property 12: URL状态同步`


## Implementation Notes

### SQL查询优化

#### 统计查询

```sql
-- 基础统计
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_published = true) as published,
  COUNT(*) FILTER (WHERE is_published = false) as unpublished
FROM articles;

-- 关键词统计
SELECT 
  keyword,
  COUNT(*) as count
FROM articles
GROUP BY keyword
ORDER BY count DESC, keyword ASC;
```

#### 筛选查询

```sql
-- 组合筛选查询
SELECT 
  a.id,
  a.title,
  a.keyword,
  a.distillation_id,
  d.keyword as distillation_keyword,
  a.task_id,
  gt.conversion_target_id,
  ct.company_name as conversion_target_name,
  a.image_url,
  a.is_published,
  a.published_at,
  a.created_at,
  a.updated_at
FROM articles a
LEFT JOIN distillations d ON a.distillation_id = d.id
LEFT JOIN generation_tasks gt ON a.task_id = gt.id
LEFT JOIN conversion_targets ct ON gt.conversion_target_id = ct.id
WHERE 1=1
  AND ($1::text IS NULL OR a.is_published = $1::boolean)  -- 发布状态筛选
  AND ($2::integer IS NULL OR a.distillation_id = $2)     -- 话题筛选
  AND ($3::text IS NULL OR a.keyword ILIKE '%' || $3 || '%')  -- 关键词搜索
ORDER BY a.created_at DESC
LIMIT $4 OFFSET $5;
```

#### 批量删除查询

```sql
-- 批量删除（在事务中执行）
BEGIN;

-- 获取要删除的文章的distillation_id
SELECT distillation_id, COUNT(*) as count
FROM articles
WHERE id = ANY($1::integer[])
GROUP BY distillation_id;

-- 删除文章（级联删除distillation_usage）
DELETE FROM articles
WHERE id = ANY($1::integer[]);

-- 更新usage_count
UPDATE distillations
SET usage_count = GREATEST(usage_count - $2, 0)
WHERE id = $3;

COMMIT;
```

### 前端状态管理

#### 使用React Hooks

```typescript
// 主要状态
const [articles, setArticles] = useState<Article[]>([]);
const [stats, setStats] = useState<ArticleStats>({ total: 0, published: 0, unpublished: 0 });
const [filters, setFilters] = useState<FilterState>({
  publishStatus: 'all',
  distillationId: null,
  searchKeyword: ''
});
const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

// URL同步
useEffect(() => {
  const params = new URLSearchParams(location.search);
  const urlFilters = parseFiltersFromURL(params);
  setFilters(urlFilters);
}, [location.search]);

useEffect(() => {
  const params = buildURLParams(filters);
  navigate(`?${params.toString()}`, { replace: true });
}, [filters]);

// 数据加载
useEffect(() => {
  loadArticles();
  loadStats();
}, [filters, page]);
```

#### 复选框状态管理

```typescript
// 全选/取消全选
const handleSelectAll = (checked: boolean) => {
  if (checked) {
    const currentPageIds = articles.map(a => a.id);
    setSelectedIds(new Set([...selectedIds, ...currentPageIds]));
  } else {
    const currentPageIds = new Set(articles.map(a => a.id));
    setSelectedIds(new Set([...selectedIds].filter(id => !currentPageIds.has(id))));
  }
};

// 单选
const handleSelectOne = (id: number, checked: boolean) => {
  const newSelected = new Set(selectedIds);
  if (checked) {
    newSelected.add(id);
  } else {
    newSelected.delete(id);
  }
  setSelectedIds(newSelected);
};

// 筛选条件变更时清空选中
useEffect(() => {
  setSelectedIds(new Set());
}, [filters]);
```

### 性能优化

1. **数据库索引**
   - 为常用筛选字段添加索引
   - 使用复合索引优化组合查询

2. **前端优化**
   - 使用防抖处理搜索输入
   - 虚拟滚动处理大量数据
   - 缓存统计数据（短时间内不重复请求）

3. **API优化**
   - 统计查询使用单个SQL完成
   - 批量删除使用单个事务
   - 合理设置分页大小

### UI/UX设计

#### 统计卡片布局

```
┌─────────────────────────────────────────────────────────┐
│  [总文章数: 150]  [已发布: 80]  [未发布: 70]            │
└─────────────────────────────────────────────────────────┘
```

#### 筛选工具栏布局

```
┌─────────────────────────────────────────────────────────┐
│  发布状态: [全部 ▼]  话题: [选择话题 ▼]                 │
│  搜索: [输入关键词...] [搜索]                            │
└─────────────────────────────────────────────────────────┘
```

#### 批量操作工具栏

```
┌─────────────────────────────────────────────────────────┐
│  已选中 5 篇文章  [删除选中] [删除所有]                  │
└─────────────────────────────────────────────────────────┘
```

#### 表格布局

```
┌───┬──────────┬──────┬──────────┬──────────┬──────────┬────────┐
│ ☐ │ 转化目标 │ 关键词│ 蒸馏结果 │ 发布状态 │ 创建时间 │ 操作   │
├───┼──────────┼──────┼──────────┼──────────┼──────────┼────────┤
│ ☑ │ 公司A    │ SEO  │ 优化技巧 │ 已发布   │ 2024-01  │ 查看...│
│ ☐ │ 公司B    │ 营销 │ 策略分析 │ 草稿     │ 2024-01  │ 查看...│
└───┴──────────┴──────┴──────────┴──────────┴──────────┴────────┘
```

## Migration Checklist

- [ ] 创建统计API端点（/api/articles/stats, /api/articles/stats/keywords）
- [ ] 增强文章列表API支持多条件筛选
- [ ] 创建批量删除API端点（/api/articles/batch）
- [ ] 创建删除所有API端点（/api/articles/all）
- [ ] 添加数据库索引优化查询性能
- [ ] 更新ArticleListPage组件添加统计卡片
- [ ] 实现筛选工具栏组件
- [ ] 实现批量操作工具栏组件
- [ ] 在表格中添加复选框列
- [ ] 实现选中状态管理逻辑
- [ ] 实现URL状态同步
- [ ] 编写单元测试
- [ ] 编写属性测试
- [ ] 编写集成测试
- [ ] 更新API文档
- [ ] 更新用户文档
