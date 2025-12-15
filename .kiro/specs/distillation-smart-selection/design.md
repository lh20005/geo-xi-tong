# 设计文档

## 概述

蒸馏结果智能选择功能旨在解决文章生成模块中的一个关键问题：当前实现在生成多篇文章时，重复使用同一个蒸馏结果，导致其他蒸馏结果从未被使用。这违背了平均使用所有蒸馏结果的设计目标。

新的实现将采用任务级别的智能选择策略：
1. **任务创建阶段**：根据请求的文章数量N，查询并选择使用次数最少的N个蒸馏结果，将选择的ID列表保存到任务记录中
2. **任务执行阶段**：从任务记录中读取预选的蒸馏结果ID列表，为每篇文章分配不同的蒸馏结果
3. **使用追踪阶段**：每篇文章生成并保存后，在事务中更新对应蒸馏结果的usage_count
4. **循环使用策略**：确保所有蒸馏结果被平均使用，当所有结果使用次数相同时，优先选择创建时间较早的

核心改进：
- 从"单蒸馏结果重复使用"改为"多蒸馏结果智能分配"
- 从"执行时选择"改为"创建时预选"
- 确保每个任务中的每篇文章使用不同的蒸馏结果
- 保持使用计数的准确性和数据一致性

## 架构

### 系统层次

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端层 (React)                             │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │ 任务创建页面      │  │ 任务详情页面      │                     │
│  │ - 验证可用数量    │  │ - 显示蒸馏结果列表│                     │
│  │ - 显示错误提示    │  │ - 显示使用顺序    │                     │
│  └──────────────────┘  └──────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
                            ↓ HTTP API
┌─────────────────────────────────────────────────────────────────┐
│                        后端层 (Node.js)                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │           ArticleGenerationService (修改)                 │   │
│  │  - selectDistillationsForTask: 智能选择N个蒸馏结果        │   │
│  │  - createTask: 保存选择的ID列表                           │   │
│  │  - executeTask: 使用预选的蒸馏结果                        │   │
│  │  - saveArticleWithUsageTracking: 更新usage_count         │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            ↓ SQL
┌─────────────────────────────────────────────────────────────────┐
│                      数据库层 (SQLite)                            │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────┐      │
│  │ generation_  │  │ distillations    │  │ distillation_│      │
│  │ tasks        │  │ + usage_count    │  │ usage        │      │
│  │ + selected_  │  │                  │  │              │      │
│  │ distillation_│  │                  │  │              │      │
│  │ ids (JSON)   │  │                  │  │              │      │
│  └──────────────┘  └──────────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

### 数据流

**任务创建流程（新）：**
1. 用户请求创建生成N篇文章的任务
2. 系统验证至少有N个有话题的蒸馏结果可用
3. 系统查询所有有话题的蒸馏结果，按usage_count ASC, created_at ASC排序
4. 系统选择前N个蒸馏结果
5. 系统将选择的蒸馏结果ID列表保存到generation_tasks.selected_distillation_ids
6. 系统异步启动任务执行

**任务执行流程（修改）：**
1. 系统从任务记录中读取selected_distillation_ids
2. 系统批量加载所有预选的蒸馏结果的关键词和话题
3. 对于第i篇文章，系统使用selected_distillation_ids[i]对应的蒸馏结果
4. 系统生成文章并在事务中保存文章、创建使用记录、更新usage_count
5. 系统继续处理下一篇文章，直到所有文章生成完成

## 组件和接口

### 数据库架构扩展

#### 1. generation_tasks表扩展

```sql
-- 添加selected_distillation_ids字段
ALTER TABLE generation_tasks ADD COLUMN selected_distillation_ids TEXT;

-- 创建索引（可选，用于查询优化）
CREATE INDEX IF NOT EXISTS idx_generation_tasks_selected_distillations 
ON generation_tasks(selected_distillation_ids);
```

**字段说明：**
- `selected_distillation_ids`: JSON数组格式的字符串，存储预选的蒸馏结果ID列表
  - 示例：`"[1, 5, 3, 8]"` 表示任务将依次使用ID为1、5、3、8的蒸馏结果
  - NULL或空数组表示使用旧的单蒸馏结果逻辑（向后兼容）


### 后端服务接口

#### ArticleGenerationService扩展

```typescript
class ArticleGenerationService {
  /**
   * 智能选择蒸馏结果（任务创建时调用）
   * 1. 查询所有有话题的蒸馏结果
   * 2. 按usage_count ASC, created_at ASC排序
   * 3. 选择前N个结果
   * 4. 验证可用数量是否足够
   * 5. 返回选择的蒸馏结果ID列表
   */
  async selectDistillationsForTask(
    requestedCount: number
  ): Promise<number[]>;

  /**
   * 创建生成任务（修改）
   * 1. 调用selectDistillationsForTask选择蒸馏结果
   * 2. 将选择的ID列表保存到selected_distillation_ids字段
   * 3. 创建任务记录
   * 4. 异步启动任务执行
   */
  async createTask(config: TaskConfig): Promise<number>;

  /**
   * 执行生成任务（修改）
   * 1. 读取selected_distillation_ids
   * 2. 如果为空，使用旧逻辑（向后兼容）
   * 3. 批量加载所有预选蒸馏结果的数据
   * 4. 为每篇文章分配不同的蒸馏结果
   * 5. 生成文章并更新usage_count
   */
  async executeTask(taskId: number): Promise<void>;

  /**
   * 批量加载蒸馏结果数据（新增）
   * 根据ID列表批量查询蒸馏结果的关键词和话题
   */
  private async loadDistillationData(
    distillationIds: number[]
  ): Promise<Map<number, { keyword: string; topics: string[] }>>;

  /**
   * 获取任务详情（修改）
   * 返回数据中包含selectedDistillations字段
   */
  async getTaskDetail(taskId: number): Promise<GenerationTask | null>;
}
```

### API路由

#### 任务创建API（修改）

```typescript
// POST /api/article-generation/tasks
// 请求体保持不变
// 响应增加selectedDistillationIds字段

// 响应示例：
{
  "taskId": 1,
  "status": "pending",
  "selectedDistillationIds": [1, 5, 3, 8],
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### 任务详情API（修改）

```typescript
// GET /api/article-generation/tasks/:id
// 响应增加selectedDistillations字段

// 响应示例：
{
  "id": 1,
  "status": "completed",
  "selectedDistillations": [
    { "id": 1, "keyword": "关键词1" },
    { "id": 5, "keyword": "关键词5" },
    { "id": 3, "keyword": "关键词3" },
    { "id": 8, "keyword": "关键词8" }
  ],
  "generatedArticles": [...]
}
```

#### 任务列表API（修改）

```typescript
// GET /api/article-generation/tasks
// 响应中的distillationResult字段改为显示多个蒸馏结果的摘要

// 响应示例：
{
  "tasks": [
    {
      "id": 1,
      "keyword": "关键词1",  // 第一个蒸馏结果的关键词
      "distillationResult": "使用了4个蒸馏结果",  // 摘要信息
      ...
    }
  ]
}
```

## 数据模型

### GenerationTask（扩展）

```typescript
interface GenerationTask {
  id: number;
  distillationId: number;  // 保留用于向后兼容
  albumId: number;
  knowledgeBaseId: number;
  articleSettingId: number;
  conversionTargetId?: number | null;
  requestedCount: number;
  generatedCount: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  errorMessage: string | null;
  selectedDistillationIds: number[] | null;  // 新增字段
  createdAt: string;
  updatedAt: string;
  
  // 查询时关联的数据
  keyword: string;  // 第一个蒸馏结果的关键词
  provider: string;
  distillationResult: string | null;
  selectedDistillations?: Array<{  // 新增字段
    id: number;
    keyword: string;
  }>;
}
```

### DistillationData（新增）

```typescript
interface DistillationData {
  id: number;
  keyword: string;
  topics: string[];
}
```

## 正确性属性

*属性是一个特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的正式陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*


### 属性 1: 智能选择排序正确性
*对于任何*蒸馏结果选择请求，返回的结果应当按usage_count升序排序，当usage_count相同时按created_at升序排序
**验证需求: 1.1, 1.5**

### 属性 2: 选择数量正确性
*对于任何*请求N个蒸馏结果的选择操作，当可用数量充足时，系统应当返回恰好N个蒸馏结果
**验证需求: 1.2**

### 属性 3: ID列表持久化
*对于任何*创建的任务，系统应当将选择的蒸馏结果ID列表保存到generation_tasks.selected_distillation_ids字段
**验证需求: 1.4, 4.1, 4.2**

### 属性 4: 蒸馏结果分配正确性
*对于任何*任务执行，生成第i篇文章时应当使用selected_distillation_ids[i]对应的蒸馏结果
**验证需求: 2.1, 2.2, 4.3**

### 属性 5: 数据提取完整性
*对于任何*文章生成，系统应当从对应的蒸馏结果中提取关键词和话题列表
**验证需求: 2.3**

### 属性 6: 单文章数据隔离
*对于任何*单篇文章生成，应当仅使用一个蒸馏结果的数据（关键词和话题）
**验证需求: 2.4**

### 属性 7: 蒸馏结果使用唯一性
*对于任何*完成的任务，每个预选的蒸馏结果应当被使用恰好一次
**验证需求: 2.5**

### 属性 8: 事务完整性
*对于任何*文章保存操作，文章数据、使用记录和usage_count更新应当在同一事务中完成，任何失败都应当回滚整个事务
**验证需求: 3.1, 3.3, 6.2**

### 属性 9: 使用计数准确性
*对于任何*蒸馏结果，其usage_count应当准确反映实际被使用的次数（等于distillation_usage表中的记录数）
**验证需求: 3.4**

### 属性 10: ID验证有效性
*对于任何*保存的selected_distillation_ids，所有ID都应当是有效的蒸馏结果ID（在distillations表中存在）
**验证需求: 4.5**

### 属性 11: 可用性验证
*对于任何*请求生成N篇文章的任务创建，系统应当验证至少有N个有话题的蒸馏结果可用
**验证需求: 5.1**

### 属性 12: 过滤逻辑正确性
*对于任何*蒸馏结果查询，系统应当排除没有话题的蒸馏结果和已被删除的蒸馏结果
**验证需求: 5.3, 5.4**

### 属性 13: 部分失败处理
*对于任何*任务执行，当单篇文章生成失败时，系统应当继续处理下一篇文章，并保存已成功生成的文章
**验证需求: 6.1, 6.3**

### 属性 14: 任务状态更新正确性
*对于任何*部分完成的任务，系统应当更新任务状态为completed并记录实际生成的文章数量
**验证需求: 6.4**

### 属性 15: 并发更新正确性
*对于任何*并发的usage_count更新操作，最终的usage_count值应当准确反映所有更新的总和
**验证需求: 7.2**

### 属性 16: 任务详情显示完整性
*对于任何*任务详情查询，系统应当返回该任务使用的所有蒸馏结果的关键词列表，并按使用顺序排列
**验证需求: 8.1, 8.2**

### 属性 17: 任务列表显示正确性
*对于任何*任务列表查询，系统应当在"蒸馏结果"列显示第一个蒸馏结果的关键词，或显示"使用了N个蒸馏结果"的摘要
**验证需求: 8.4, 8.5**

### 属性 18: 向后兼容性
*对于任何*没有selected_distillation_ids的旧任务，系统应当使用distillation_id字段作为后备，并正确执行和显示
**验证需求: 9.1, 9.2, 9.3**

### 属性 19: 验证工具正确性
*对于任何*蒸馏结果，验证工具应当准确比对usage_count与实际使用记录数量，并报告所有不一致
**验证需求: 10.1, 10.2**

### 属性 20: 修复工具正确性
*对于任何*修复操作，系统应当重新计算所有蒸馏结果的usage_count，使其等于实际使用记录数量
**验证需求: 10.3, 10.4**

### 属性 21: API响应完整性
*对于任何*任务创建请求，API响应应当包含选择的蒸馏结果ID列表
**验证需求: 13.1**

### 属性 22: API详情响应完整性
*对于任何*任务详情请求，API响应应当包含所有使用的蒸馏结果的详细信息
**验证需求: 13.2**

### 属性 23: API列表响应完整性
*对于任何*任务列表请求，API响应应当包含每个任务的蒸馏结果摘要
**验证需求: 13.3**

### 属性 24: API数据结构一致性
*对于任何*API响应，数据结构应当符合预定义的接口规范
**验证需求: 13.4**

### 属性 25: API错误响应正确性
*对于任何*API错误，响应应当包含清晰的错误信息和正确的HTTP状态码
**验证需求: 13.5**

## 错误处理

### 1. 可用蒸馏结果不足错误

**场景：** 请求的文章数量超过可用蒸馏结果数量
**处理：**
- 在任务创建时验证
- 返回400 Bad Request
- 提供清晰的错误消息："可用蒸馏结果不足，当前只有X个可用，但请求生成Y篇文章"
- 建议用户减少文章数量或创建更多蒸馏结果

### 2. 无效的蒸馏结果ID错误

**场景：** selected_distillation_ids中包含不存在的ID
**处理：**
- 在任务创建时验证所有ID
- 返回400 Bad Request
- 提供清晰的错误消息："蒸馏结果ID [X, Y] 不存在"
- 记录错误日志

### 3. 空的selected_distillation_ids错误

**场景：** 任务记录中的selected_distillation_ids为空或NULL（非向后兼容情况）
**处理：**
- 在任务执行时检查
- 如果distillation_id也为空，标记任务为失败
- 记录错误日志："任务配置无效，缺少蒸馏结果信息"

### 4. 蒸馏结果数据缺失错误

**场景：** 预选的蒸馏结果在执行时已被删除或没有话题
**处理：**
- 在任务执行时检查每个蒸馏结果
- 跳过无效的蒸馏结果，继续处理下一篇文章
- 记录警告日志
- 在任务完成时报告跳过的文章数量

### 5. 事务失败错误

**场景：** 保存文章或更新usage_count时发生数据库错误
**处理：**
- 回滚整个事务
- 记录详细的错误日志
- 继续处理下一篇文章
- 在任务完成时报告失败的文章数量

### 6. 并发冲突错误

**场景：** 多个任务同时更新同一蒸馏结果的usage_count
**处理：**
- 使用原子操作（SQL INCREMENT）避免冲突
- 如果仍然发生冲突，重试最多3次
- 如果重试失败，记录错误日志并标记任务为失败

### 7. 数据不一致错误

**场景：** usage_count与实际使用记录数量不一致
**处理：**
- 在验证工具中检测
- 记录详细的差异信息
- 提供修复工具自动修正
- 记录警告日志


## 测试策略

### 单元测试

**目标：** 验证各个服务方法的正确性

**测试范围：**

1. **selectDistillationsForTask方法**
   - 测试排序逻辑（usage_count升序，created_at升序）
   - 测试选择数量正确性
   - 测试可用数量不足时的错误处理
   - 测试过滤逻辑（排除没有话题的蒸馏结果）
   - 测试边缘情况（0个可用、恰好N个可用、大量可用）

2. **createTask方法**
   - 测试ID列表保存到数据库
   - 测试JSON序列化和反序列化
   - 测试ID验证逻辑
   - 测试错误处理

3. **executeTask方法**
   - 测试从数据库读取selected_distillation_ids
   - 测试蒸馏结果分配逻辑
   - 测试向后兼容性（旧任务）
   - 测试部分失败处理
   - 测试任务状态更新

4. **loadDistillationData方法**
   - 测试批量加载逻辑
   - 测试数据映射正确性
   - 测试缺失数据处理

5. **saveArticleWithUsageTracking方法**
   - 测试事务完整性
   - 测试usage_count更新
   - 测试回滚逻辑

### 属性测试

**目标：** 验证系统在各种输入下的正确性属性

**测试框架：** 使用fast-check（JavaScript的属性测试库）

**配置：** 每个属性测试运行至少100次迭代

**测试范围：**

1. **智能选择属性（属性1-3）**
   ```typescript
   // Feature: distillation-smart-selection, Property 1: 智能选择排序正确性
   // Validates: Requirements 1.1, 1.5
   fc.assert(
     fc.property(
       fc.array(distillationArbitrary, { minLength: 1, maxLength: 100 }),
       fc.integer({ min: 1, max: 10 }),
       async (distillations, requestedCount) => {
         // 设置测试数据
         await setupDistillations(distillations);
         
         // 执行选择
         const selected = await service.selectDistillationsForTask(requestedCount);
         
         // 验证排序
         for (let i = 0; i < selected.length - 1; i++) {
           const current = distillations.find(d => d.id === selected[i]);
           const next = distillations.find(d => d.id === selected[i + 1]);
           
           // usage_count升序
           if (current.usageCount === next.usageCount) {
             // created_at升序
             expect(current.createdAt <= next.createdAt).toBe(true);
           } else {
             expect(current.usageCount <= next.usageCount).toBe(true);
           }
         }
       }
     ),
     { numRuns: 100 }
   );
   ```

2. **蒸馏结果分配属性（属性4-7）**
   ```typescript
   // Feature: distillation-smart-selection, Property 7: 蒸馏结果使用唯一性
   // Validates: Requirements 2.5
   fc.assert(
     fc.property(
       fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 10 }),
       async (distillationIds) => {
         // 创建任务
         const taskId = await service.createTask({
           selectedDistillationIds: distillationIds,
           ...otherConfig
         });
         
         // 执行任务
         await service.executeTask(taskId);
         
         // 验证每个蒸馏结果被使用恰好一次
         const usageCounts = await getUsageCountsByTask(taskId);
         distillationIds.forEach(id => {
           expect(usageCounts[id]).toBe(1);
         });
       }
     ),
     { numRuns: 100 }
   );
   ```

3. **事务完整性属性（属性8-9）**
   ```typescript
   // Feature: distillation-smart-selection, Property 8: 事务完整性
   // Validates: Requirements 3.1, 3.3, 6.2
   fc.assert(
     fc.property(
       fc.record({
         distillationId: fc.integer({ min: 1, max: 100 }),
         shouldFail: fc.boolean()
       }),
       async ({ distillationId, shouldFail }) => {
         const initialCount = await getUsageCount(distillationId);
         
         try {
           if (shouldFail) {
             // 模拟保存失败
             await service.saveArticleWithUsageTracking(..., { simulateFailure: true });
           } else {
             await service.saveArticleWithUsageTracking(...);
           }
         } catch (error) {
           // 验证回滚：usage_count应该不变
           const finalCount = await getUsageCount(distillationId);
           expect(finalCount).toBe(initialCount);
           return;
         }
         
         // 验证成功：usage_count应该增加1
         const finalCount = await getUsageCount(distillationId);
         expect(finalCount).toBe(initialCount + 1);
       }
     ),
     { numRuns: 100 }
   );
   ```

4. **向后兼容性属性（属性18）**
   ```typescript
   // Feature: distillation-smart-selection, Property 18: 向后兼容性
   // Validates: Requirements 9.1, 9.2, 9.3
   fc.assert(
     fc.property(
       fc.integer({ min: 1, max: 100 }),
       async (distillationId) => {
         // 创建旧格式任务（没有selected_distillation_ids）
         const taskId = await createLegacyTask({ distillationId });
         
         // 执行任务
         await service.executeTask(taskId);
         
         // 验证任务成功完成
         const task = await service.getTaskDetail(taskId);
         expect(task.status).toBe('completed');
         
         // 验证使用了正确的蒸馏结果
         const articles = await getArticlesByTask(taskId);
         articles.forEach(article => {
           expect(article.distillationId).toBe(distillationId);
         });
       }
     ),
     { numRuns: 100 }
   );
   ```

5. **数据一致性属性（属性9, 19-20）**
   ```typescript
   // Feature: distillation-smart-selection, Property 9: 使用计数准确性
   // Validates: Requirements 3.4
   fc.assert(
     fc.property(
       fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 20 }),
       async (distillationIds) => {
         // 创建并执行多个任务
         for (const id of distillationIds) {
           await createAndExecuteTask(id);
         }
         
         // 验证每个蒸馏结果的usage_count准确
         for (const id of new Set(distillationIds)) {
           const usageCount = await getUsageCount(id);
           const actualCount = await getActualUsageCount(id);
           expect(usageCount).toBe(actualCount);
         }
       }
     ),
     { numRuns: 100 }
   );
   ```

### 集成测试

**目标：** 验证完整的任务创建-执行-完成流程

**测试场景：**

1. **完整流程测试**
   - 创建任务 → 验证ID列表保存 → 执行任务 → 验证文章生成 → 验证usage_count更新
   - 验证每个步骤的数据正确性

2. **并发场景测试**
   - 多个任务同时创建和执行
   - 验证蒸馏结果选择的正确性
   - 验证usage_count的准确性
   - 验证没有数据竞争

3. **错误恢复测试**
   - 模拟各种错误情况（数据库错误、AI调用失败等）
   - 验证错误处理逻辑
   - 验证数据一致性

4. **向后兼容性测试**
   - 创建旧格式任务
   - 验证任务能够正常执行
   - 验证数据迁移逻辑

5. **大规模测试**
   - 创建大量蒸馏结果（1000+）
   - 创建大量任务（100+）
   - 验证性能和正确性

### 测试配置

- **属性测试库**: fast-check
- **最小迭代次数**: 100次
- **属性测试标记格式**: `// Feature: distillation-smart-selection, Property {number}: {property_text}`
- **测试数据库**: 使用独立的测试数据库，每个测试前清空数据

## 性能考虑

### 1. 数据库查询优化

**索引设计：**
```sql
-- 支持智能选择查询
CREATE INDEX IF NOT EXISTS idx_distillations_usage_count 
ON distillations(usage_count ASC, created_at ASC);

-- 支持任务查询
CREATE INDEX IF NOT EXISTS idx_generation_tasks_selected_distillations 
ON generation_tasks(selected_distillation_ids);
```

**查询优化：**
- 使用复合索引支持排序查询
- 使用LIMIT限制返回结果数量
- 批量加载蒸馏结果数据，减少数据库往返

### 2. 批量操作

**批量加载蒸馏结果：**
```typescript
// 一次查询加载所有需要的蒸馏结果
const distillations = await pool.query(
  `SELECT d.id, d.keyword, array_agg(t.question) as topics
   FROM distillations d
   LEFT JOIN topics t ON d.id = t.distillation_id
   WHERE d.id = ANY($1)
   GROUP BY d.id, d.keyword`,
  [distillationIds]
);
```

**批量更新usage_count：**
- 使用原子操作（SQL INCREMENT）
- 避免读-修改-写的竞态条件

### 3. 事务管理

**策略：**
- 使用数据库连接池
- 尽量缩短事务持有时间
- 避免在事务中执行耗时操作（如AI生成）

**实现：**
```typescript
// 在事务外生成文章内容
const content = await generateArticle(...);

// 在事务内保存数据
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await saveArticle(...);
  await recordUsage(...);
  await incrementCount(...);
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

### 4. 并发控制

**策略：**
- 使用原子操作更新usage_count
- 使用数据库行级锁（SELECT FOR UPDATE）防止重复选择
- 实现重试机制处理并发冲突

**性能影响：**
- 行级锁只锁定被选择的蒸馏结果，不影响其他操作
- 原子操作避免了读-修改-写的竞态条件
- 重试机制确保最终一致性

### 5. 内存优化

**策略：**
- 使用Map存储蒸馏结果数据，O(1)查找
- 及时释放不再使用的数据
- 避免加载不必要的字段

## 安全考虑

### 1. SQL注入防护

**措施：**
- 使用参数化查询
- 避免字符串拼接SQL
- 验证和清理用户输入

### 2. 数据验证

**验证规则：**
- selected_distillation_ids必须是有效的JSON数组
- 所有ID必须是正整数
- 所有ID必须在distillations表中存在
- 请求的文章数量必须在合理范围内（1-100）

### 3. 权限控制

**考虑：**
- 验证用户对引用资源的访问权限
- 限制任务创建频率（防止滥用）
- 记录所有操作日志

### 4. 数据完整性

**保护措施：**
- 使用外键约束
- 使用事务确保原子性
- 使用检查约束（usage_count >= 0）
- 使用级联删除确保一致性

## 部署和迁移

### 1. 数据库迁移步骤

**步骤1：** 创建迁移脚本
```sql
-- 003_add_smart_selection.sql
ALTER TABLE generation_tasks ADD COLUMN selected_distillation_ids TEXT;

CREATE INDEX IF NOT EXISTS idx_generation_tasks_selected_distillations 
ON generation_tasks(selected_distillation_ids);
```

**步骤2：** 初始化现有数据
```sql
-- 为所有现有任务初始化selected_distillation_ids
-- 使用distillation_id作为单元素数组
UPDATE generation_tasks
SET selected_distillation_ids = json_array(distillation_id)
WHERE selected_distillation_ids IS NULL;
```

**步骤3：** 运行迁移
```bash
npm run migrate
```

**步骤4：** 验证迁移
```sql
-- 验证字段存在
SELECT sql FROM sqlite_master 
WHERE type='table' AND name='generation_tasks';

-- 验证索引存在
SELECT name FROM sqlite_master 
WHERE type='index' AND tbl_name='generation_tasks';

-- 验证数据完整性
SELECT COUNT(*) FROM generation_tasks 
WHERE selected_distillation_ids IS NULL;
-- 应该返回0

-- 验证JSON格式
SELECT id, selected_distillation_ids 
FROM generation_tasks 
WHERE json_valid(selected_distillation_ids) = 0;
-- 应该返回0行
```

### 2. 回滚计划

**如果迁移失败：**
```sql
-- 回滚迁移
DROP INDEX IF EXISTS idx_generation_tasks_selected_distillations;
ALTER TABLE generation_tasks DROP COLUMN selected_distillation_ids;
```

### 3. 部署检查清单

- [ ] 备份数据库
- [ ] 运行迁移脚本
- [ ] 验证表结构
- [ ] 验证索引创建
- [ ] 验证数据完整性
- [ ] 验证JSON格式
- [ ] 部署后端代码
- [ ] 部署前端代码
- [ ] 运行集成测试
- [ ] 监控错误日志
- [ ] 验证功能正常
- [ ] 验证向后兼容性

## 监控和维护

### 1. 监控指标

**数据一致性监控：**
- 定期检查usage_count与实际使用记录数量是否一致
- 监控selected_distillation_ids的有效性
- 监控事务失败率

**性能监控：**
- 监控智能选择查询的响应时间
- 监控批量加载的响应时间
- 监控并发冲突和重试次数

**业务监控：**
- 监控蒸馏结果的使用分布
- 监控任务成功率
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
- 运行验证工具检查数据
- 分析并发冲突情况
- 评估索引效果

### 3. 故障恢复

**数据不一致：**
1. 运行验证工具：检查usage_count与实际使用记录的一致性
2. 运行修复工具：重新计算所有usage_count
3. 检查修复结果
4. 如果修复失败，手动检查数据库

**并发冲突频繁：**
1. 检查数据库连接池配置
2. 检查事务隔离级别
3. 考虑增加重试次数或延迟
4. 考虑优化查询性能

**性能下降：**
1. 检查索引是否存在
2. 分析慢查询日志
3. 考虑增加数据库资源
4. 优化查询语句

## 未来扩展

### 1. 高级选择策略

- 支持按标签或类别选择蒸馏结果
- 支持自定义选择权重
- 支持排除特定蒸馏结果

### 2. 智能推荐

- 根据历史生成效果推荐蒸馏结果
- 根据用户偏好推荐蒸馏结果
- 根据时间和季节推荐蒸馏结果

### 3. 统计分析

- 蒸馏结果使用效果分析
- 文章质量与蒸馏结果的关联分析
- 使用趋势分析

### 4. 优化算法

- 实现更复杂的循环使用策略
- 支持动态调整选择权重
- 支持A/B测试不同的选择策略
