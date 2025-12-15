# 设计文档

## 概述

蒸馏结果使用追踪和智能循环使用功能通过在数据库中记录每条蒸馏结果的使用次数和详细使用历史，实现文章生成时的智能选择策略。系统将优先选择使用次数较少的蒸馏结果，确保所有蒸馏结果被平均使用并循环利用，避免重复使用同一个蒸馏结果生成文章。

同时，本功能修复了文章生成任务列表中"蒸馏结果"列显示错误的问题。当前该列显示的是大模型提供商（provider），但应该显示的是蒸馏结果的关键词（keyword），以便用户清楚地了解每个任务使用了哪个蒸馏结果。

该功能涉及数据库架构扩展、后端服务逻辑增强、前端UI更新三个主要方面，需要确保数据一致性和并发安全性。

## 架构

### 系统层次

```
┌─────────────────────────────────────────────────────────────┐
│                        前端层 (React)                         │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │ 蒸馏结果页面      │  │ 文章生成任务页面  │                 │
│  │ - 使用次数显示    │  │ - 关键词显示修复  │                 │
│  │ - 使用历史查看    │  │ - 蒸馏结果选择    │                 │
│  │ - 推荐标记        │  │ - 使用次数提示    │                 │
│  └──────────────────┘  └──────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTP API
┌─────────────────────────────────────────────────────────────┐
│                        后端层 (Node.js)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           ArticleGenerationService                    │   │
│  │  - 智能选择蒸馏结果                                    │   │
│  │  - 记录使用历史                                        │   │
│  │  - 更新使用次数                                        │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           DistillationService (新增)                  │   │
│  │  - 查询使用统计                                        │   │
│  │  - 获取使用历史                                        │   │
│  │  - 提供推荐结果                                        │   │
│  │  - 重置使用统计                                        │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           TaskRoutes (修改)                           │   │
│  │  - 修复任务列表查询（JOIN distillations表）           │   │
│  │  - 返回keyword而非provider                            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓ SQL
┌─────────────────────────────────────────────────────────────┐
│                      数据库层 (PostgreSQL)                    │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ distillations│  │ distillation_    │  │ articles     │  │
│  │ + usage_count│  │ usage (新表)     │  │              │  │
│  └──────────────┘  └──────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 数据流

**显示错误修复流程：**
1. 前端请求任务列表
2. 后端通过JOIN查询获取distillations.keyword
3. 返回包含keyword字段的任务数据
4. 前端在"蒸馏结果"列显示keyword而非provider

**文章生成流程：**
1. 用户创建文章生成任务
2. 系统查询usage_count最小的蒸馏结果
3. 按顺序为每篇文章分配蒸馏结果
4. 生成文章并保存
5. 在事务中创建使用记录并更新usage_count

**使用统计查询流程：**
1. 前端请求蒸馏结果列表
2. 后端查询distillations表（包含usage_count）
3. 返回排序后的结果（按usage_count升序）
4. 前端展示使用次数和推荐标记

## 组件和接口

### 数据库架构扩展

#### 1. distillations表扩展

```sql
-- 添加usage_count字段
ALTER TABLE distillations ADD COLUMN usage_count INTEGER DEFAULT 0 NOT NULL;

-- 创建索引优化查询性能
CREATE INDEX idx_distillations_usage_count ON distillations(usage_count ASC, created_at ASC);
```

**字段说明：**
- `usage_count`: 该蒸馏结果被使用的总次数，默认为0
- 索引设计：按usage_count升序和created_at升序，支持智能选择算法的高效查询

#### 2. distillation_usage表（新增）

```sql
CREATE TABLE distillation_usage (
  id SERIAL PRIMARY KEY,
  distillation_id INTEGER NOT NULL REFERENCES distillations(id) ON DELETE CASCADE,
  task_id INTEGER NOT NULL REFERENCES generation_tasks(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_article_usage UNIQUE (article_id)
);

CREATE INDEX idx_distillation_usage_distillation ON distillation_usage(distillation_id);
CREATE INDEX idx_distillation_usage_task ON distillation_usage(task_id);
CREATE INDEX idx_distillation_usage_article ON distillation_usage(article_id);
CREATE INDEX idx_distillation_usage_used_at ON distillation_usage(used_at DESC);
```

**字段说明：**
- `id`: 主键
- `distillation_id`: 关联的蒸馏结果ID
- `task_id`: 关联的文章生成任务ID
- `article_id`: 关联的文章ID（唯一约束确保每篇文章只有一条使用记录）
- `used_at`: 使用时间戳

**级联删除策略：**
- 删除蒸馏结果时，自动删除所有相关使用记录
- 删除任务时，自动删除所有相关使用记录
- 删除文章时，自动删除对应的使用记录

### 后端服务接口

#### 1. DistillationService（新增服务）

```typescript
interface DistillationUsageStats {
  distillationId: number;
  keyword: string;
  provider: string;
  usageCount: number;
  lastUsedAt: string | null;
  topicCount: number;
  createdAt: string;
}

interface DistillationUsageHistory {
  id: number;
  taskId: number;
  articleId: number;
  articleTitle: string | null;
  usedAt: string;
}

interface RecommendedDistillation {
  distillationId: number;
  keyword: string;
  usageCount: number;
  topicCount: number;
  isRecommended: boolean;
  recommendReason: string;
}

class DistillationService {
  /**
   * 获取蒸馏结果列表（包含使用统计）
   * 按usage_count升序排序，使用次数少的排在前面
   */
  async getDistillationsWithStats(
    page: number,
    pageSize: number
  ): Promise<{ distillations: DistillationUsageStats[]; total: number }>;

  /**
   * 获取单条蒸馏结果的使用历史
   * 按used_at降序排序，最新的在前
   */
  async getUsageHistory(
    distillationId: number,
    page: number,
    pageSize: number
  ): Promise<{ history: DistillationUsageHistory[]; total: number }>;

  /**
   * 获取推荐的蒸馏结果（使用次数最少的前N条）
   * 过滤掉没有话题的蒸馏结果
   */
  async getRecommendedDistillations(
    limit: number = 3
  ): Promise<RecommendedDistillation[]>;

  /**
   * 重置单条蒸馏结果的使用统计
   * 将usage_count设为0并删除所有使用记录
   */
  async resetUsageStats(distillationId: number): Promise<void>;

  /**
   * 重置所有蒸馏结果的使用统计
   * 将所有usage_count设为0并清空使用记录表
   */
  async resetAllUsageStats(): Promise<void>;

  /**
   * 修复使用统计（重新计算usage_count）
   * 比对usage_count与实际使用记录数量，修复不一致的数据
   */
  async repairUsageStats(): Promise<{ 
    fixed: number; 
    errors: string[];
    details: Array<{ distillationId: number; oldCount: number; newCount: number }>;
  }>;
}
```

#### 2. ArticleGenerationService扩展

```typescript
class ArticleGenerationService {
  /**
   * 智能选择蒸馏结果（按使用次数升序）
   * 1. 查询所有有话题的蒸馏结果
   * 2. 按usage_count ASC, created_at ASC排序
   * 3. 选择前N个结果
   * 4. 如果可用数量少于请求数量，抛出错误
   */
  private async selectDistillationsForTask(
    requestedCount: number
  ): Promise<Array<{ id: number; keyword: string; topicCount: number }>>;

  /**
   * 记录蒸馏结果使用
   * 在distillation_usage表中插入新记录
   */
  private async recordDistillationUsage(
    distillationId: number,
    taskId: number,
    articleId: number,
    client: PoolClient
  ): Promise<void>;

  /**
   * 更新蒸馏结果使用次数（原子操作）
   * 使用SQL的INCREMENT确保并发安全
   */
  private async incrementUsageCount(
    distillationId: number,
    client: PoolClient
  ): Promise<void>;

  /**
   * 在事务中保存文章并记录使用
   * 1. 保存文章
   * 2. 创建使用记录
   * 3. 更新usage_count
   * 4. 如果任何步骤失败，回滚整个事务
   */
  private async saveArticleWithUsageTracking(
    taskId: number,
    distillationId: number,
    keyword: string,
    title: string,
    content: string,
    imageUrl: string,
    provider: string
  ): Promise<number>;

  /**
   * 执行文章生成任务（修改）
   * 使用智能选择算法选择蒸馏结果
   */
  async executeTask(taskId: number): Promise<void>;
}
```

#### 3. TaskRoutes修改

```typescript
// 修改任务列表查询，JOIN distillations表获取keyword
router.get('/tasks', async (req, res) => {
  const query = `
    SELECT 
      gt.*,
      d.keyword,
      ct.company_name as conversion_target_name
    FROM generation_tasks gt
    LEFT JOIN distillations d ON gt.distillation_id = d.id
    LEFT JOIN conversion_targets ct ON gt.conversion_target_id = ct.id
    ORDER BY gt.created_at DESC
    LIMIT $1 OFFSET $2
  `;
  // ...
});
```

### API路由

#### 1. 蒸馏结果统计API

```typescript
// GET /api/distillation/stats
// 获取蒸馏结果列表（包含使用统计）
// Query参数: page (默认1), pageSize (默认10)
// 响应: { distillations: DistillationUsageStats[], total: number }

// GET /api/distillation/:id/usage-history
// 获取单条蒸馏结果的使用历史
// Query参数: page (默认1), pageSize (默认10)
// 响应: { history: DistillationUsageHistory[], total: number }

// GET /api/distillation/recommended
// 获取推荐的蒸馏结果（使用次数最少的前3条）
// Query参数: limit (默认3)
// 响应: RecommendedDistillation[]

// POST /api/distillation/:id/reset-usage
// 重置单条蒸馏结果的使用统计
// 响应: { success: boolean, message: string }

// POST /api/distillation/reset-all-usage
// 重置所有蒸馏结果的使用统计
// 响应: { success: boolean, message: string }

// POST /api/distillation/repair-usage-stats
// 修复使用统计（重新计算）
// 响应: { fixed: number, errors: string[], details: Array }
```

#### 2. 任务API修改

```typescript
// GET /api/generation/tasks
// 修改响应数据结构，添加keyword字段
// 响应: { 
//   tasks: Array<{
//     id: number;
//     status: string;
//     keyword: string;  // 新增：蒸馏结果的关键词
//     conversionTargetName: string | null;
//     progress: number;
//     generatedCount: number;
//     requestedCount: number;
//     createdAt: string;
//   }>,
//   total: number
// }
```

## 数据模型

### Distillation（扩展）

```typescript
interface Distillation {
  id: number;
  keyword: string;
  provider: string;
  usageCount: number;  // 新增字段
  createdAt: string;
}
```

### DistillationUsage（新增）

```typescript
interface DistillationUsage {
  id: number;
  distillationId: number;
  taskId: number;
  articleId: number;
  usedAt: string;
}
```

### DistillationUsageStats（新增）

```typescript
interface DistillationUsageStats {
  distillationId: number;
  keyword: string;
  provider: string;
  usageCount: number;
  lastUsedAt: string | null;
  topicCount: number;
  createdAt: string;
}
```

### GenerationTask（修改）

```typescript
interface GenerationTask {
  id: number;
  distillationId: number;
  status: string;
  keyword: string;  // 新增：从distillations表JOIN获取
  conversionTargetName: string | null;
  progress: number;
  generatedCount: number;
  requestedCount: number;
  createdAt: string;
  updatedAt: string;
}
```

## 正确性属性

*属性是一个特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的正式陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*


### 属性反思

在编写正确性属性之前，我需要识别并消除冗余：

**冗余分析：**
1. 需求1.1、1.2、10.1、10.2 都是关于显示关键词而非提供商 → 合并为一个属性
2. 需求2.2、6.1、12.1 都是关于API返回包含usage_count → 合并为一个属性
3. 需求4.2、6.2 都是关于按usage_count升序排序 → 合并为一个属性
4. 需求3.4、3.5、9.1、9.2 都是关于事务完整性 → 合并为一个属性
5. 需求7.2、11.2 都是关于相同usage_count时按created_at排序 → 合并为一个属性
6. 需求11.1、12.3 都是关于推荐算法 → 合并为一个属性
7. 需求4.4、5.2 都是关于使用历史数据完整性 → 合并为一个属性

### 正确性属性

#### 属性 1: 任务列表显示关键词
*对于任何*文章生成任务查询，返回的数据应当包含keyword字段，且该字段值应该来自关联的蒸馏结果
**验证需求: 1.1, 1.2, 1.5, 10.1, 10.2**

#### 属性 2: 新蒸馏结果初始化
*对于任何*新创建的蒸馏结果，其usage_count字段应当初始化为0
**验证需求: 2.1**

#### 属性 3: 查询结果包含使用次数
*对于任何*蒸馏结果查询，返回的数据应当包含usage_count字段
**验证需求: 2.2, 6.1, 12.1**

#### 属性 4: 使用记录创建完整性
*对于任何*保存的文章，系统应当在distillation_usage表中创建一条包含distillation_id、task_id、article_id和used_at的使用记录
**验证需求: 2.4, 3.1, 3.2**

#### 属性 5: 级联删除一致性
*对于任何*被删除的蒸馏结果或文章，系统应当自动删除所有相关的使用记录
**验证需求: 2.5, 2.6**

#### 属性 6: 唯一约束保证
*对于任何*文章，系统应当确保在distillation_usage表中最多只有一条使用记录
**验证需求: 3.3**

#### 属性 7: 事务完整性
*对于任何*文章保存操作，如果使用记录创建或usage_count更新失败，则整个事务应当回滚，文章不应被保存
**验证需求: 3.4, 3.5, 9.1, 9.2**

#### 属性 8: 蒸馏结果排序规则
*对于任何*蒸馏结果列表查询，结果应当按usage_count升序排序，当usage_count相同时按created_at升序排序
**验证需求: 4.2, 6.2, 7.2, 11.2**

#### 属性 9: 使用历史数据完整性
*对于任何*使用历史记录，应当包含任务ID、文章ID、文章标题和使用时间
**验证需求: 4.4, 5.2**

#### 属性 10: 使用历史查询正确性
*对于任何*蒸馏结果的使用历史查询，返回的所有记录应当只包含该蒸馏结果的使用记录，且按used_at降序排序
**验证需求: 5.1, 5.3**

#### 属性 11: 推荐结果标记
*对于任何*蒸馏结果列表，使用次数最少的前3个结果应当被标记为推荐
**验证需求: 6.3**

#### 属性 12: 智能选择最小使用次数
*对于任何*蒸馏结果选择操作，系统应当优先选择usage_count最小的蒸馏结果（排除没有话题的结果）
**验证需求: 7.1**

#### 属性 13: 循环使用策略
*对于任何*蒸馏结果选择操作，即使所有结果都被使用过，系统仍应当能够选择usage_count最小的结果，实现循环使用
**验证需求: 7.4**

#### 属性 14: 批量选择正确性
*对于任何*请求N个蒸馏结果的操作，系统应当返回usage_count最小的N个结果（按usage_count和created_at排序）
**验证需求: 8.1, 8.2**

#### 属性 15: 立即更新使用次数
*对于任何*生成的文章，对应蒸馏结果的usage_count应当立即增加1
**验证需求: 8.4**

#### 属性 16: 任务内选择唯一性
*对于任何*单个任务中的蒸馏结果选择，每个蒸馏结果应当最多被选择一次
**验证需求: 8.5**

#### 属性 17: 删除操作一致性
*对于任何*被删除的文章，对应蒸馏结果的usage_count应当减少1，且使用记录应当被删除
**验证需求: 9.3**

#### 属性 18: 推荐算法正确性
*对于任何*推荐请求，系统应当返回usage_count最小的前3个有话题的蒸馏结果
**验证需求: 11.1, 12.3**

#### 属性 19: 推荐结果数据完整性
*对于任何*推荐结果，应当包含关键词、使用次数、话题数量等信息
**验证需求: 11.4**

#### 属性 20: API响应数据一致性
*对于任何*API调用，响应数据应当符合预期的数据结构和完整性要求
**验证需求: 12.4**

#### 属性 21: 并发选择正确性
*对于任何*并发的蒸馏结果选择操作，系统应当使用数据库锁确保每个蒸馏结果不会被重复选择
**验证需求: 15.1, 15.5**

#### 属性 22: 并发更新准确性
*对于任何*并发的usage_count更新操作，系统应当使用原子操作确保最终的usage_count值准确反映实际使用次数
**验证需求: 15.2**

## 错误处理

### 1. 数据不存在错误

**场景：** 查询不存在的蒸馏结果或任务
**处理：**
- 返回404 Not Found
- 提供清晰的错误消息："蒸馏结果不存在"或"任务不存在"

### 2. 数据一致性错误

**场景：** usage_count与实际使用记录数量不一致
**处理：**
- 记录错误日志
- 提供修复工具自动修正
- 返回500 Internal Server Error（如果在关键操作中发现）

### 3. 并发冲突错误

**场景：** 多个任务同时更新同一蒸馏结果的usage_count
**处理：**
- 使用数据库行级锁
- 实现重试机制（最多3次）
- 如果重试失败，记录错误日志并返回500

### 4. 事务失败错误

**场景：** 保存文章或创建使用记录失败
**处理：**
- 回滚整个事务
- 记录详细的错误日志
- 返回500 Internal Server Error
- 提供错误详情给前端显示

### 5. 可用蒸馏结果不足错误

**场景：** 请求的文章数量超过可用蒸馏结果数量
**处理：**
- 在任务创建时验证
- 返回400 Bad Request
- 提供清晰的错误消息："可用蒸馏结果不足，当前只有X个可用，但请求生成Y篇文章"

### 6. 级联删除错误

**场景：** 删除蒸馏结果或文章时级联删除失败
**处理：**
- 回滚删除操作
- 记录错误日志
- 返回500 Internal Server Error
- 提供错误详情

### 7. 数据迁移错误

**场景：** 执行数据库迁移时失败
**处理：**
- 回滚迁移
- 记录详细的错误日志
- 提供迁移失败的具体原因
- 确保数据库状态一致

## 测试策略

### 单元测试

**目标：** 验证各个服务方法的正确性

**测试范围：**
1. DistillationService的所有方法
   - getDistillationsWithStats: 测试查询和排序
   - getUsageHistory: 测试历史记录查询和分页
   - getRecommendedDistillations: 测试推荐算法
   - resetUsageStats: 测试重置功能
   - repairUsageStats: 测试修复功能

2. ArticleGenerationService的扩展方法
   - selectDistillationsForTask: 测试智能选择算法
   - recordDistillationUsage: 测试使用记录创建
   - incrementUsageCount: 测试使用次数更新
   - saveArticleWithUsageTracking: 测试事务处理

3. 边缘情况测试
   - 蒸馏结果被删除后的显示
   - 没有可用话题的蒸馏结果
   - 可用数量少于请求数量
   - 并发冲突和重试
   - 事务回滚场景

### 属性测试

**目标：** 验证系统在各种输入下的正确性属性

**测试框架：** 使用fast-check（JavaScript的属性测试库）

**配置：** 每个属性测试运行至少100次迭代

**测试范围：**
1. 数据初始化属性（属性1-3）
2. 使用记录创建属性（属性4-7）
3. 查询和排序属性（属性8-11）
4. 智能选择属性（属性12-16）
5. 删除和一致性属性（属性17）
6. 推荐算法属性（属性18-20）
7. 并发控制属性（属性21-22）

**属性测试标记：**
每个属性测试必须包含注释，格式为：
```typescript
// Feature: distillation-usage-tracking, Property X: [属性描述]
// Validates: Requirements X.Y
```

### 集成测试

**目标：** 验证完整的文章生成流程和数据一致性

**测试场景：**
1. 完整的文章生成流程
   - 创建任务 → 选择蒸馏结果 → 生成文章 → 记录使用 → 更新次数
   - 验证每个步骤的数据正确性

2. 并发场景测试
   - 多个任务同时执行
   - 验证usage_count的准确性
   - 验证选择的唯一性

3. 删除操作测试
   - 删除文章后验证usage_count减少
   - 删除蒸馏结果后验证级联删除
   - 删除任务后验证使用记录删除

4. 数据修复测试
   - 人为制造数据不一致
   - 运行修复工具
   - 验证修复后的数据正确性

### 前端测试

**目标：** 验证UI正确显示和用户交互

**测试范围：**
1. 任务列表页面
   - 验证"蒸馏结果"列显示关键词
   - 验证蒸馏结果被删除时的显示

2. 蒸馏结果页面
   - 验证使用次数列的显示
   - 验证使用历史弹窗
   - 验证推荐标记

3. 任务配置页面
   - 验证蒸馏结果下拉列表显示使用次数
   - 验证推荐标记和提示
   - 验证没有话题的蒸馏结果被禁用

## 性能考虑

### 1. 数据库索引优化

**索引设计：**
```sql
-- 支持智能选择查询
CREATE INDEX idx_distillations_usage_count ON distillations(usage_count ASC, created_at ASC);

-- 支持使用历史查询
CREATE INDEX idx_distillation_usage_distillation ON distillation_usage(distillation_id);
CREATE INDEX idx_distillation_usage_used_at ON distillation_usage(used_at DESC);
```

**查询优化：**
- 使用复合索引支持排序查询
- 避免全表扫描
- 使用LIMIT限制返回结果数量

### 2. 并发控制

**策略：**
- 使用数据库行级锁（SELECT FOR UPDATE）
- 使用原子操作更新usage_count（UPDATE ... SET usage_count = usage_count + 1）
- 实现重试机制处理并发冲突

**性能影响：**
- 行级锁只锁定被选择的蒸馏结果，不影响其他操作
- 原子操作避免了读-修改-写的竞态条件
- 重试机制确保最终一致性

### 3. 分页查询

**实现：**
- 使用LIMIT和OFFSET实现分页
- 默认页大小：10条记录
- 最大页大小：100条记录

**优化：**
- 使用索引支持分页查询
- 缓存总数查询结果（短时间内）
- 避免深度分页（offset过大）

### 4. 事务管理

**策略：**
- 使用数据库连接池
- 尽量缩短事务持有时间
- 避免在事务中执行耗时操作（如AI生成）

**实现：**
```typescript
// 在事务外生成文章内容
const content = await generateArticle(...);

// 在事务内保存数据
await pool.query('BEGIN');
try {
  await saveArticle(...);
  await recordUsage(...);
  await incrementCount(...);
  await pool.query('COMMIT');
} catch (error) {
  await pool.query('ROLLBACK');
  throw error;
}
```

## 安全考虑

### 1. SQL注入防护

**措施：**
- 使用参数化查询
- 避免字符串拼接SQL
- 验证和清理用户输入

### 2. 数据验证

**验证规则：**
- distillation_id必须存在
- task_id必须存在
- article_id必须存在
- usage_count必须为非负整数
- 分页参数必须为正整数

### 3. 权限控制

**考虑：**
- 管理功能（重置、修复）应该有权限限制
- 普通用户只能查看统计信息
- 系统操作（记录使用、更新次数）不应暴露给前端

### 4. 数据完整性

**保护措施：**
- 使用外键约束
- 使用唯一约束
- 使用检查约束（usage_count >= 0）
- 使用级联删除确保一致性

## 部署和迁移

### 1. 数据库迁移步骤

**步骤1：** 创建迁移脚本
```sql
-- 002_add_usage_tracking.sql
ALTER TABLE distillations ADD COLUMN usage_count INTEGER DEFAULT 0 NOT NULL;

CREATE TABLE distillation_usage (
  id SERIAL PRIMARY KEY,
  distillation_id INTEGER NOT NULL REFERENCES distillations(id) ON DELETE CASCADE,
  task_id INTEGER NOT NULL REFERENCES generation_tasks(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_article_usage UNIQUE (article_id)
);

CREATE INDEX idx_distillations_usage_count ON distillations(usage_count ASC, created_at ASC);
CREATE INDEX idx_distillation_usage_distillation ON distillation_usage(distillation_id);
CREATE INDEX idx_distillation_usage_task ON distillation_usage(task_id);
CREATE INDEX idx_distillation_usage_article ON distillation_usage(article_id);
CREATE INDEX idx_distillation_usage_used_at ON distillation_usage(used_at DESC);
```

**步骤2：** 初始化现有数据
```sql
-- 为所有现有蒸馏结果初始化usage_count为0（已通过DEFAULT完成）

-- 根据现有文章记录重新计算usage_count
UPDATE distillations d
SET usage_count = (
  SELECT COUNT(*)
  FROM articles a
  WHERE a.distillation_id = d.id
);
```

**步骤3：** 运行迁移
```bash
npm run migrate
```

**步骤4：** 验证迁移
```sql
-- 验证usage_count字段存在
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'distillations' AND column_name = 'usage_count';

-- 验证distillation_usage表存在
SELECT table_name FROM information_schema.tables
WHERE table_name = 'distillation_usage';

-- 验证索引存在
SELECT indexname FROM pg_indexes
WHERE tablename IN ('distillations', 'distillation_usage');

-- 验证数据一致性
SELECT d.id, d.keyword, d.usage_count, COUNT(a.id) as actual_count
FROM distillations d
LEFT JOIN articles a ON d.id = a.distillation_id
GROUP BY d.id, d.keyword, d.usage_count
HAVING d.usage_count != COUNT(a.id);
```

### 2. 回滚计划

**如果迁移失败：**
```sql
-- 回滚迁移
DROP INDEX IF EXISTS idx_distillation_usage_used_at;
DROP INDEX IF EXISTS idx_distillation_usage_article;
DROP INDEX IF EXISTS idx_distillation_usage_task;
DROP INDEX IF EXISTS idx_distillation_usage_distillation;
DROP INDEX IF EXISTS idx_distillations_usage_count;
DROP TABLE IF EXISTS distillation_usage;
ALTER TABLE distillations DROP COLUMN IF EXISTS usage_count;
```

### 3. 部署检查清单

- [ ] 备份数据库
- [ ] 运行迁移脚本
- [ ] 验证表结构
- [ ] 验证索引创建
- [ ] 验证数据一致性
- [ ] 运行修复工具（如果需要）
- [ ] 部署后端代码
- [ ] 部署前端代码
- [ ] 运行集成测试
- [ ] 监控错误日志
- [ ] 验证功能正常

## 监控和维护

### 1. 监控指标

**数据一致性监控：**
- 定期检查usage_count与实际使用记录数量是否一致
- 监控级联删除是否正常工作
- 监控事务失败率

**性能监控：**
- 监控智能选择查询的响应时间
- 监控使用历史查询的响应时间
- 监控并发冲突和重试次数

**业务监控：**
- 监控蒸馏结果的使用分布
- 监控推荐算法的效果
- 监控文章生成成功率

### 2. 定期维护任务

**每日任务：**
- 检查错误日志
- 验证数据一致性

**每周任务：**
- 分析使用统计
- 优化查询性能
- 清理过期数据（如果有）

**每月任务：**
- 运行修复工具验证数据
- 分析并发冲突情况
- 评估索引效果

### 3. 故障恢复

**数据不一致：**
1. 运行修复工具：`POST /api/distillation/repair-usage-stats`
2. 检查修复结果
3. 如果修复失败，手动检查数据库

**并发冲突频繁：**
1. 检查数据库连接池配置
2. 检查事务隔离级别
3. 考虑增加重试次数或延迟

**性能下降：**
1. 检查索引是否存在
2. 分析慢查询日志
3. 考虑增加数据库资源
4. 优化查询语句
