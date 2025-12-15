# 设计文档

## 概述

本功能是对现有文章生成和蒸馏结果管理系统的前端展示增强。后端的均衡使用逻辑和使用次数追踪功能已经实现,本设计主要关注:

1. **前端展示增强**: 在蒸馏结果列表和详情页显示被引用次数
2. **使用历史查询**: 提供查看每个蒸馏结果使用历史的功能
3. **API扩展**: 扩展现有API以支持使用统计数据的查询
4. **数据同步验证**: 确保数据修改时的一致性

核心设计原则:
- **复用优先**: 优先使用已有的数据库字段(usage_count)和API接口
- **渐进增强**: 在现有功能基础上增加展示层功能
- **性能优化**: 使用索引和分页确保大数据量下的性能
- **用户体验**: 提供直观的使用统计信息和历史查询功能

## 架构

### 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端层 (React)                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  DistillationResultsPage (增强)                          │  │
│  │  - 蒸馏结果列表 + 被引用次数列                            │  │
│  │  - 排序和筛选功能                                         │  │
│  │  - 使用历史弹窗                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  UsageHistoryModal (新增)                                │  │
│  │  - 显示使用历史列表                                       │  │
│  │  - 分页展示                                               │  │
│  │  - 跳转到文章详情                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│           │                  │                                  │
│           └──────────────────┼──────────────────────────────────┘
│                              │ HTTP/REST API                     
└──────────────────────────────┼───────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────┐
│                              │          后端层 (Express)         │
│                      ┌───────▼────────┐                          │
│                      │  Router层      │                          │
│                      │ - distillation │                          │
│                      │   (扩展)       │                          │
│                      └───────┬────────┘                          │
│                              │                                   │
│                      ┌───────▼────────┐                          │
│                      │  Service层     │                          │
│                      │ Distillation   │                          │
│                      │ Service(扩展)  │                          │
│                      └───────┬────────┘                          │
│                              │                                   │
│                      ┌───────▼────────┐                          │
│                      │  Database      │                          │
│                      │  - distillations (已有usage_count)       │
│                      │  - distillation_usage (已有)              │
│                      │  - articles (已有)                        │
│                      └────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

### 技术栈

- **前端**: React 18, TypeScript, Ant Design 5
- **后端**: Node.js, Express, TypeScript
- **数据库**: PostgreSQL (已有schema)
- **状态管理**: React Hooks (useState, useEffect)
- **HTTP客户端**: Axios

## 组件和接口

### 前端组件

#### 1. DistillationResultsPage (增强现有组件)

**新增State**:
```typescript
interface DistillationResultsPageState {
  // 现有state...
  sortField: 'created_at' | 'usage_count' | null;
  sortOrder: 'asc' | 'desc';
  filterUsageStatus: 'all' | 'used' | 'unused';
  usageHistoryVisible: boolean;
  selectedDistillationId: number | null;
}
```

**新增方法**:
- `handleSortChange(field: string)`: 处理排序变化
- `handleFilterChange(status: string)`: 处理筛选变化
- `handleShowUsageHistory(distillationId: number)`: 显示使用历史
- `handleCloseUsageHistory()`: 关闭使用历史弹窗

**UI增强**:
- 在表格中添加"被引用次数"列
- 添加排序和筛选控件
- 使用Badge组件显示使用次数
- 添加点击事件处理

#### 2. UsageHistoryModal (新组件)

**Props**:
```typescript
interface UsageHistoryModalProps {
  visible: boolean;
  distillationId: number | null;
  onClose: () => void;
}
```

**State**:
```typescript
interface UsageHistoryModalState {
  loading: boolean;
  usageHistory: UsageRecord[];
  keyword: string;
  totalUsageCount: number;
  currentPage: number;
  pageSize: number;
  total: number;
}
```

**功能**:
- 加载并显示使用历史
- 分页展示
- 跳转到文章详情
- 处理空状态和错误状态

#### 3. UsageCountBadge (新组件)

**Props**:
```typescript
interface UsageCountBadgeProps {
  count: number;
  onClick?: () => void;
}
```

**功能**:
- 根据count值显示不同样式的Badge
- count为0时显示灰色
- count大于0时显示蓝色
- 支持点击事件

### 后端接口

#### API路由: `/api/distillation` (扩展现有路由)

##### 1. 获取蒸馏结果列表 (扩展现有接口)

```
GET /api/distillation/history?page=1&pageSize=10&sortBy=usage_count&sortOrder=asc&filterUsage=all
```

**新增查询参数**:
- `sortBy`: 排序字段 (created_at | usage_count)
- `sortOrder`: 排序顺序 (asc | desc)
- `filterUsage`: 筛选条件 (all | used | unused)

**响应** (扩展现有响应):
```json
{
  "data": [
    {
      "id": 1,
      "keyword": "人工智能",
      "provider": "deepseek",
      "topicCount": 5,
      "usageCount": 12,
      "lastUsedAt": "2024-01-15T10:30:00Z",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 50,
  "page": 1,
  "pageSize": 10
}
```

##### 2. 获取蒸馏结果详情 (扩展现有接口)

```
GET /api/distillation/history/:id
```

**响应** (扩展现有响应):
```json
{
  "id": 1,
  "keyword": "人工智能",
  "provider": "deepseek",
  "topics": ["话题1", "话题2"],
  "usageCount": 12,
  "lastUsedAt": "2024-01-15T10:30:00Z",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

##### 3. 获取使用历史 (新接口)

```
GET /api/distillation/history/:id/usage?page=1&pageSize=10
```

**响应**:
```json
{
  "distillationId": 1,
  "keyword": "人工智能",
  "totalUsageCount": 12,
  "usageHistory": [
    {
      "id": 1,
      "taskId": 5,
      "articleId": 101,
      "articleTitle": "人工智能的未来发展",
      "articleDeleted": false,
      "usedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 12,
  "page": 1,
  "pageSize": 10
}
```

##### 4. 修复使用计数 (新接口 - 管理员功能)

```
POST /api/distillation/fix-usage-count
```

**请求体**:
```json
{
  "distillationId": 1  // 可选,不提供则修复所有
}
```

**响应**:
```json
{
  "success": true,
  "message": "使用计数修复完成",
  "fixedCount": 5,
  "details": [
    {
      "distillationId": 1,
      "oldCount": 10,
      "newCount": 12,
      "actualCount": 12
    }
  ]
}
```

### 服务层

#### DistillationService (扩展现有服务)

**新增方法**:

```typescript
class DistillationService {
  /**
   * 获取蒸馏结果列表(带使用统计)
   */
  async getDistillationsWithUsage(
    page: number,
    pageSize: number,
    sortBy?: 'created_at' | 'usage_count',
    sortOrder?: 'asc' | 'desc',
    filterUsage?: 'all' | 'used' | 'unused'
  ): Promise<{ data: DistillationWithUsage[]; total: number }>;

  /**
   * 获取蒸馏结果详情(带使用统计)
   */
  async getDistillationDetailWithUsage(
    distillationId: number
  ): Promise<DistillationDetailWithUsage | null>;

  /**
   * 获取使用历史
   */
  async getUsageHistory(
    distillationId: number,
    page: number,
    pageSize: number
  ): Promise<{ 
    distillationId: number;
    keyword: string;
    totalUsageCount: number;
    usageHistory: UsageRecord[];
    total: number;
  }>;

  /**
   * 修复使用计数
   */
  async fixUsageCount(
    distillationId?: number
  ): Promise<{ 
    fixedCount: number;
    details: FixDetail[];
  }>;

  /**
   * 删除文章时更新usage_count
   */
  async decrementUsageCount(
    distillationId: number
  ): Promise<void>;
}
```

## 数据模型

### 数据库表 (使用现有表)

#### 1. distillations 表 (已存在,已有usage_count字段)

```sql
-- 已有字段:
-- id, keyword, provider, created_at, usage_count

-- 确保索引存在
CREATE INDEX IF NOT EXISTS idx_distillations_usage_count 
ON distillations(usage_count ASC, created_at ASC);
```

#### 2. distillation_usage 表 (已存在)

```sql
-- 已有字段:
-- id, distillation_id, task_id, article_id, used_at

-- 确保索引存在
CREATE INDEX IF NOT EXISTS idx_distillation_usage_distillation_id 
ON distillation_usage(distillation_id);

CREATE INDEX IF NOT EXISTS idx_distillation_usage_used_at 
ON distillation_usage(used_at DESC);
```

#### 3. articles 表 (已存在)

```sql
-- 已有字段:
-- id, title, content, distillation_id, task_id, created_at, ...

-- 确保索引存在
CREATE INDEX IF NOT EXISTS idx_articles_distillation_id 
ON articles(distillation_id);
```

### TypeScript类型定义

```typescript
// 带使用统计的蒸馏结果
interface DistillationWithUsage {
  id: number;
  keyword: string;
  provider: string;
  topicCount: number;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
}

// 带使用统计的蒸馏结果详情
interface DistillationDetailWithUsage {
  id: number;
  keyword: string;
  provider: string;
  topics: string[];
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
}

// 使用记录
interface UsageRecord {
  id: number;
  taskId: number;
  articleId: number;
  articleTitle: string;
  articleDeleted: boolean;
  usedAt: string;
}

// 修复详情
interface FixDetail {
  distillationId: number;
  keyword: string;
  oldCount: number;
  newCount: number;
  actualCount: number;
}
```

## 正确性属性

*属性是指在系统的所有有效执行中都应该成立的特征或行为——本质上是关于系统应该做什么的正式声明。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### 属性 1: 列表显示完整性

*对于任意*蒸馏结果数据集,渲染的列表应该包含"被引用次数"列,且每行都显示对应的usage_count值
**验证: 需求 1.1, 1.2**

### 属性 2: 使用次数格式化

*对于任意*正整数usage_count,显示的文本应该符合"N次"格式
**验证: 需求 1.4**

### 属性 3: 详情页数据完整性

*对于任意*蒸馏结果,详情页应该包含usage_count和lastUsedAt字段
**验证: 需求 2.1, 2.2**

### 属性 4: 使用历史查询完整性

*对于任意*蒸馏结果,查询使用历史应该返回所有相关的文章记录
**验证: 需求 2.4, 3.1**

### 属性 5: 使用历史排序正确性

*对于任意*使用历史列表,记录应该按used_at降序排列(最新的在前)
**验证: 需求 3.2**

### 属性 6: 分页逻辑正确性

*对于任意*数量的使用记录,分页应该正确工作,每页显示指定数量的记录
**验证: 需求 3.3**

### 属性 7: 删除文章后的数据一致性

*对于任意*文章删除操作,关联的蒸馏结果的usage_count应该减1
**验证: 需求 6.2**

### 属性 8: API响应结构一致性

*对于任意*蒸馏结果查询,API响应应该包含usage_count字段
**验证: 需求 4.1, 4.2**

### 属性 9: 均衡选择算法正确性

*对于任意*蒸馏结果集合,选择算法应该返回usage_count最小的N个结果
**验证: 需求 5.2**

### 属性 10: 次要排序条件正确性

*对于任意*usage_count相同的蒸馏结果,应该按created_at升序排序
**验证: 需求 5.3**

### 属性 11: 文章生成数据唯一性

*对于任意*文章生成任务,每篇文章应该使用不同的蒸馏结果ID
**验证: 需求 5.4**

### 属性 12: 事务原子性

*对于任意*文章保存操作,保存文章和更新usage_count应该在同一事务中完成
**验证: 需求 5.5**

### 属性 13: 级联删除正确性

*对于任意*蒸馏结果删除操作,所有相关的使用记录应该被自动删除
**验证: 需求 6.1**

### 属性 14: 修复工具正确性

*对于任意*蒸馏结果,运行修复工具后,usage_count应该等于实际使用记录数
**验证: 需求 6.4**

### 属性 15: 并发安全性

*对于任意*并发的文章生成操作,最终的usage_count应该等于实际生成的文章数
**验证: 需求 6.5**

### 属性 16: 筛选逻辑正确性

*对于任意*数据集,筛选"未使用"应该只返回usage_count为0的记录
**验证: 需求 9.3**

### 属性 17: 排序功能正确性

*对于任意*蒸馏结果列表,按usage_count排序应该正确改变记录顺序
**验证: 需求 9.1**

### 属性 18: 错误处理完整性

*对于任意*API错误,系统应该显示用户友好的错误提示
**验证: 需求 11.1**

### 属性 19: 响应式布局正确性

*对于任意*屏幕尺寸,系统应该使用适当的布局方式
**验证: 需求 12.1**

### 属性 20: 导出数据完整性

*对于任意*蒸馏结果数据集,导出的CSV应该包含所有必需字段
**验证: 需求 13.1, 13.2**

### 属性 21: 实时更新正确性

*对于任意*文章生成完成事件,蒸馏结果列表的usage_count应该自动更新
**验证: 需求 14.1**

### 属性 22: 局部更新正确性

*对于任意*数据刷新操作,应该只更新usage_count列,不重新加载整个列表
**验证: 需求 14.2**

## 错误处理

### 客户端错误处理

1. **API请求失败**:
   - 显示Toast错误提示
   - 提供重试按钮
   - 记录错误日志到控制台

2. **数据加载失败**:
   - 显示空状态或错误状态
   - 提供刷新按钮
   - 保持UI可用性

3. **网络超时**:
   - 显示超时提示
   - 提供重试选项
   - 设置合理的超时时间(30秒)

4. **数据格式错误**:
   - 使用默认值(usage_count默认为0)
   - 记录错误日志
   - 不阻塞UI渲染

### 服务端错误处理

1. **资源不存在**:
   - 返回404状态码
   - 提供清晰的错误消息
   - 记录访问日志

2. **数据库查询失败**:
   - 返回500状态码
   - 记录详细错误日志
   - 不暴露敏感信息

3. **并发冲突**:
   - 使用数据库事务
   - 重试机制(最多3次)
   - 记录冲突日志

4. **数据不一致**:
   - 提供修复工具
   - 记录不一致详情
   - 通知管理员

## 测试策略

### 单元测试

1. **组件测试**:
   - UsageCountBadge: 不同count值的样式
   - UsageHistoryModal: 数据加载和显示
   - DistillationResultsPage: 排序和筛选逻辑

2. **服务测试**:
   - getDistillationsWithUsage: 查询和排序
   - getUsageHistory: 分页和数据完整性
   - fixUsageCount: 修复逻辑正确性
   - decrementUsageCount: 原子操作

3. **API路由测试**:
   - 扩展的列表接口
   - 使用历史接口
   - 修复接口

### 属性测试

使用fast-check进行属性测试,最小迭代次数100次:

1. **列表显示属性**: 生成随机蒸馏结果数据,验证列表渲染完整性
   - `// Feature: distillation-usage-display-enhancement, Property 1: 列表显示完整性`

2. **格式化属性**: 生成随机usage_count,验证格式化逻辑
   - `// Feature: distillation-usage-display-enhancement, Property 2: 使用次数格式化`

3. **排序属性**: 生成随机数据集,验证排序正确性
   - `// Feature: distillation-usage-display-enhancement, Property 17: 排序功能正确性`

4. **筛选属性**: 生成随机数据集,验证筛选逻辑
   - `// Feature: distillation-usage-display-enhancement, Property 16: 筛选逻辑正确性`

5. **分页属性**: 生成随机数量记录,验证分页逻辑
   - `// Feature: distillation-usage-display-enhancement, Property 6: 分页逻辑正确性`

6. **均衡选择属性**: 生成随机蒸馏结果,验证选择算法
   - `// Feature: distillation-usage-display-enhancement, Property 9: 均衡选择算法正确性`

7. **数据一致性属性**: 验证删除文章后usage_count更新
   - `// Feature: distillation-usage-display-enhancement, Property 7: 删除文章后的数据一致性`

8. **修复工具属性**: 验证修复后usage_count正确性
   - `// Feature: distillation-usage-display-enhancement, Property 14: 修复工具正确性`

### 集成测试

1. **端到端流程**: 测试完整的查看使用历史流程
2. **数据库集成**: 验证usage_count的更新和查询
3. **并发测试**: 验证多任务并发时的数据一致性
4. **实时更新测试**: 验证文章生成后的自动刷新

### 测试配置

- **属性测试库**: fast-check
- **最小迭代次数**: 100次
- **属性测试标记格式**: `// Feature: distillation-usage-display-enhancement, Property {number}: {property_text}`

## 安全考虑

1. **SQL注入防护**: 使用参数化查询
2. **XSS防护**: React自动转义,额外验证用户输入
3. **权限控制**: 修复工具仅管理员可访问
4. **数据验证**: 验证所有查询参数
5. **错误信息**: 生产环境不暴露敏感信息

## 性能考虑

1. **数据库索引**:
   - usage_count和created_at的复合索引
   - distillation_id的索引
   - used_at的索引

2. **查询优化**:
   - 使用JOIN减少查询次数
   - 使用聚合函数计算统计数据
   - 使用LIMIT限制返回数量

3. **前端优化**:
   - 使用React.memo减少重渲染
   - 虚拟滚动处理大列表
   - 防抖搜索和筛选操作

4. **缓存策略**:
   - 缓存蒸馏结果列表(5分钟)
   - 缓存使用历史(1分钟)
   - 文章生成完成后清除缓存

5. **分页加载**:
   - 默认每页10条
   - 支持用户自定义页大小
   - 使用游标分页优化大数据集

## 部署注意事项

1. **数据库迁移**:
   - 验证usage_count字段存在
   - 验证distillation_usage表存在
   - 创建必要的索引
   - 运行修复工具初始化usage_count

2. **API兼容性**:
   - 扩展现有API,保持向后兼容
   - 新增字段为可选
   - 提供API版本控制

3. **前端部署**:
   - 更新组件库
   - 测试响应式布局
   - 验证移动端体验

4. **监控和日志**:
   - 记录usage_count更新日志
   - 监控API响应时间
   - 跟踪错误率

5. **数据一致性检查**:
   - 定期运行修复工具
   - 监控usage_count异常
   - 设置告警阈值

## 未来扩展

1. **高级统计**:
   - 使用趋势图表
   - 热门蒸馏结果排行
   - 使用频率分析

2. **批量操作**:
   - 批量重置usage_count
   - 批量导出数据
   - 批量删除未使用的蒸馏结果

3. **智能推荐**:
   - 推荐使用次数少的蒸馏结果
   - 推荐相似的蒸馏结果
   - 推荐最佳生成时机

4. **实时通知**:
   - WebSocket实时更新
   - 使用次数达到阈值通知
   - 数据不一致告警

5. **数据分析**:
   - 使用模式分析
   - 生成效率统计
   - 成本分析

6. **多语言支持**:
   - 国际化UI
   - 多语言导出
   - 本地化日期格式

7. **权限管理**:
   - 细粒度权限控制
   - 角色管理
   - 操作审计日志
