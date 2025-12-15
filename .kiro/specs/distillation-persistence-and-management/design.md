# Design Document

## Overview

本设计文档描述了关键词蒸馏页面的持久化显示和管理功能的实现方案。系统将通过浏览器本地存储实现蒸馏结果的持久化，并通过新增的后端API端点支持蒸馏记录的完整CRUD操作。前端将增强用户界面，提供直观的管理按钮和交互反馈。

核心改进包括：
1. 使用LocalStorage持久化当前蒸馏结果
2. 新增后端API支持删除和更新操作
3. 增强前端UI，添加管理按钮和确认对话框
4. 实现历史记录的详细查看功能

## Architecture

系统采用三层架构：

```
┌─────────────────────────────────────────┐
│         前端层 (React + Ant Design)      │
│  - DistillationPage组件                 │
│  - LocalStorage管理                     │
│  - 用户交互和状态管理                    │
└──────────────┬──────────────────────────┘
               │ HTTP/REST API
┌──────────────▼──────────────────────────┐
│         后端层 (Express.js)              │
│  - Distillation路由                     │
│  - 请求验证和错误处理                    │
└──────────────┬──────────────────────────┘
               │ SQL查询
┌──────────────▼──────────────────────────┐
│         数据层 (PostgreSQL)              │
│  - distillations表                      │
│  - topics表                             │
└─────────────────────────────────────────┘
```

## Components and Interfaces

### 1. 前端组件 (DistillationPage.tsx)

**状态管理：**
```typescript
interface DistillationState {
  keyword: string;              // 输入的关键词
  loading: boolean;             // 加载状态
  result: DistillationResult | null;  // 当前蒸馏结果
  history: DistillationRecord[];      // 历史记录列表
  selectedRecordId: number | null;    // 当前选中的历史记录ID
}

interface DistillationResult {
  distillationId: number;
  keyword: string;
  questions: string[];
  count: number;
}

interface DistillationRecord {
  id: number;
  keyword: string;
  provider: string;
  topic_count: number;
  created_at: string;
}
```

**新增功能方法：**
- `saveResultToLocalStorage(result: DistillationResult): void` - 保存结果到本地存储
- `loadResultFromLocalStorage(): DistillationResult | null` - 从本地存储加载结果
- `clearResultFromLocalStorage(): void` - 清除本地存储的结果
- `handleViewHistory(record: DistillationRecord): void` - 查看历史记录详情
- `handleDeleteRecord(id: number): void` - 删除单条记录
- `handleEditKeyword(id: number, currentKeyword: string): void` - 编辑关键词
- `handleDeleteAll(): void` - 删除所有记录
- `showDeleteConfirm(onConfirm: () => void): void` - 显示删除确认对话框

### 2. 后端API端点

**现有端点：**
- `POST /api/distillation` - 执行关键词蒸馏
- `GET /api/distillation/history` - 获取蒸馏历史

**新增端点：**

```typescript
// 获取单条蒸馏记录的详细信息（包含所有问题）
GET /api/distillation/:id
Response: {
  id: number;
  keyword: string;
  provider: string;
  created_at: string;
  questions: string[];
}

// 删除单条蒸馏记录
DELETE /api/distillation/:id
Response: {
  success: boolean;
  message: string;
}

// 更新蒸馏记录的关键词
PATCH /api/distillation/:id
Request: {
  keyword: string;
}
Response: {
  success: boolean;
  message: string;
}

// 删除所有蒸馏记录
DELETE /api/distillation/all
Response: {
  success: boolean;
  message: string;
  deletedCount: number;
}
```

### 3. LocalStorage管理

**存储键：**
- `distillation_current_result` - 存储当前蒸馏结果

**数据格式：**
```typescript
{
  distillationId: number;
  keyword: string;
  questions: string[];
  count: number;
  timestamp: number;  // 保存时间戳，用于过期检查
}
```

## Data Models

### Distillation Record (数据库)
```sql
distillations {
  id: SERIAL PRIMARY KEY
  keyword: VARCHAR(255) NOT NULL
  provider: VARCHAR(20) NOT NULL
  created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
}
```

### Topic (数据库)
```sql
topics {
  id: SERIAL PRIMARY KEY
  distillation_id: INTEGER REFERENCES distillations(id) ON DELETE CASCADE
  question: TEXT NOT NULL
  created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
}
```

### LocalStorage Data Model
```typescript
interface StoredDistillationResult {
  distillationId: number;
  keyword: string;
  questions: string[];
  count: number;
  timestamp: number;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Acceptence Criteria Testing Prework:

1.1 WHEN 用户完成一次关键词蒸馏 THEN 蒸馏系统 SHALL 将蒸馏结果存储到本地存储中
Thoughts: 这是一个通用规则，适用于所有蒸馏操作。我们可以生成随机的蒸馏结果，执行保存操作，然后验证本地存储中是否包含相同的数据。
Testable: yes - property

1.2 WHEN 用户离开蒸馏页面后再返回 THEN 蒸馏系统 SHALL 从本地存储中恢复并显示最近的蒸馏结果
Thoughts: 这是测试持久化的往返特性。对于任何保存的结果，我们应该能够恢复相同的数据。
Testable: yes - property

1.3 WHEN 页面组件初始化时 THEN 蒸馏系统 SHALL 检查本地存储并自动加载已保存的蒸馏结果
Thoughts: 这是关于组件生命周期的特定行为，是一个具体的例子而不是通用属性。
Testable: yes - example

1.4 WHEN 蒸馏结果被成功恢复 THEN 用户界面 SHALL 显示与原始蒸馏完成时相同的结果内容和格式
Thoughts: 这是UI渲染的一致性测试，属于视觉层面，不适合自动化测试。
Testable: no

1.5 WHEN 用户执行新的蒸馏操作 THEN 蒸馏系统 SHALL 用新结果替换本地存储中的旧结果
Thoughts: 这是测试更新操作的不变性。对于任何新的蒸馏结果，保存后本地存储应该只包含新结果。
Testable: yes - property

2.1 WHEN 用户点击蒸馏历史记录中的某一条 THEN 蒸馏系统 SHALL 在蒸馏结果区域显示该记录的完整问题列表
Thoughts: 这是关于从数据库加载数据的通用规则。对于任何有效的记录ID，系统应该返回完整的问题列表。
Testable: yes - property

2.2 WHEN 历史记录被选中并显示 THEN 用户界面 SHALL 高亮显示当前选中的历史记录行
Thoughts: 这是UI视觉反馈，不适合自动化测试。
Testable: no

2.3 WHEN 蒸馏历史为空 THEN 用户界面 SHALL 显示友好的空状态提示信息
Thoughts: 这是一个特定的边缘情况。
Testable: yes - edge case

3.1 WHEN 用户在蒸馏结果区域点击删除按钮 THEN 蒸馏系统 SHALL 删除当前显示的蒸馏记录
Thoughts: 这是删除操作的通用规则。对于任何有效的记录ID，删除后该记录不应存在于数据库中。
Testable: yes - property

3.2 WHEN 用户在蒸馏历史表格中点击删除按钮 THEN 蒸馏系统 SHALL 删除对应的历史记录
Thoughts: 这与3.1是相同的后端操作，只是触发点不同。可以合并到一个属性中。
Testable: yes - property (与3.1合并)

3.3 WHEN 删除操作执行前 THEN 用户界面 SHALL 显示确认对话框要求用户确认删除操作
Thoughts: 这是UI交互流程，不是可测试的数据属性。
Testable: no

3.4 WHEN 删除操作成功完成 THEN 蒸馏系统 SHALL 从数据库中移除该记录
Thoughts: 这与3.1重复，是删除操作的核心行为。
Testable: yes - property (与3.1合并)

3.5 WHEN 删除操作成功完成 THEN 用户界面 SHALL 刷新蒸馏历史列表并显示成功提示
Thoughts: 这是UI更新行为，不是数据层面的可测试属性。
Testable: no

3.6 WHEN 当前显示的蒸馏结果被删除 THEN 蒸馏系统 SHALL 清空蒸馏结果显示区域
Thoughts: 这是UI状态管理，不是数据属性。
Testable: no

3.7 WHEN 删除操作失败 THEN 用户界面 SHALL 显示错误提示信息
Thoughts: 这是错误处理的UI行为。
Testable: no

4.1 WHEN 用户在蒸馏结果区域点击编辑按钮 THEN 用户界面 SHALL 显示包含当前关键词的编辑对话框
Thoughts: 这是UI交互，不是数据属性。
Testable: no

4.2 WHEN 用户在蒸馏历史表格中点击编辑按钮 THEN 用户界面 SHALL 显示包含该记录关键词的编辑对话框
Thoughts: 这是UI交互，不是数据属性。
Testable: no

4.3 WHEN 用户在编辑对话框中修改关键词并确认 THEN 蒸馏系统 SHALL 更新数据库中的关键词字段
Thoughts: 这是更新操作的通用规则。对于任何有效的记录ID和新关键词，更新后数据库应该包含新关键词。
Testable: yes - property

4.4 WHEN 编辑操作成功完成 THEN 用户界面 SHALL 刷新显示并显示成功提示
Thoughts: 这是UI更新行为。
Testable: no

4.5 WHEN 用户提交空白关键词 THEN 蒸馏系统 SHALL 拒绝更新并显示验证错误提示
Thoughts: 这是输入验证的边缘情况。我们应该测试所有空白字符串（空字符串、纯空格等）都被拒绝。
Testable: yes - property

4.6 WHEN 编辑操作失败 THEN 用户界面 SHALL 显示错误提示信息
Thoughts: 这是错误处理的UI行为。
Testable: no

5.1 WHEN 用户点击全部删除按钮 THEN 用户界面 SHALL 显示确认对话框警告此操作不可恢复
Thoughts: 这是UI交互。
Testable: no

5.2 WHEN 用户确认全部删除操作 THEN 蒸馏系统 SHALL 删除数据库中所有蒸馏记录
Thoughts: 这是批量删除操作。对于任何初始数据库状态，执行全部删除后应该没有记录。
Testable: yes - property

5.3 WHEN 全部删除操作成功完成 THEN 蒸馏系统 SHALL 清空蒸馏历史列表
Thoughts: 这是UI状态更新。
Testable: no

5.4 WHEN 全部删除操作成功完成 THEN 蒸馏系统 SHALL 清空蒸馏结果显示区域
Thoughts: 这是UI状态更新。
Testable: no

5.5 WHEN 全部删除操作成功完成 THEN 蒸馏系统 SHALL 清除本地存储中的蒸馏结果数据
Thoughts: 这是本地存储清理的通用规则。执行全部删除后，本地存储不应包含蒸馏结果数据。
Testable: yes - property

5.6 WHEN 全部删除操作成功完成 THEN 用户界面 SHALL 显示成功提示信息
Thoughts: 这是UI反馈。
Testable: no

5.7 WHEN 全部删除操作失败 THEN 用户界面 SHALL 显示错误提示信息
Thoughts: 这是错误处理的UI行为。
Testable: no

7.1 WHEN 接收到删除单条记录的请求 THEN 蒸馏系统 SHALL 验证记录ID的有效性
Thoughts: 这是输入验证。对于任何无效的ID（负数、不存在的ID等），系统应该返回错误。
Testable: yes - property

7.2 WHEN 删除单条记录请求有效 THEN 蒸馏系统 SHALL 从数据库中删除该记录及其关联的话题数据
Thoughts: 这是级联删除的通用规则。删除蒸馏记录后，其关联的话题也应该被删除。
Testable: yes - property

7.3 WHEN 接收到更新关键词的请求 THEN 蒸馏系统 SHALL 验证记录ID和新关键词的有效性
Thoughts: 这是输入验证。对于任何无效输入，系统应该返回错误。
Testable: yes - property

7.4 WHEN 更新关键词请求有效 THEN 蒸馏系统 SHALL 在数据库中更新对应记录的关键词字段
Thoughts: 这与4.3重复。
Testable: yes - property (与4.3合并)

7.5 WHEN 接收到删除所有记录的请求 THEN 蒸馏系统 SHALL 删除数据库中所有蒸馏记录及其关联数据
Thoughts: 这与5.2重复，但强调了级联删除。
Testable: yes - property (与5.2合并)

7.6 WHEN API操作成功 THEN 蒸馏系统 SHALL 返回成功状态码和确认消息
Thoughts: 这是API响应格式的通用规则。所有成功操作应该返回2xx状态码。
Testable: yes - property

7.7 WHEN API操作失败 THEN 蒸馏系统 SHALL 返回适当的错误状态码和错误描述
Thoughts: 这是错误响应格式的通用规则。所有失败操作应该返回4xx或5xx状态码和错误信息。
Testable: yes - property

### Property Reflection:

经过分析，我发现以下冗余：
- 3.1, 3.2, 3.4 都在测试删除单条记录的核心功能，可以合并为一个属性
- 4.3 和 7.4 都在测试更新关键词的功能，可以合并
- 5.2 和 7.5 都在测试删除所有记录的功能，可以合并
- 7.6 和 7.7 可以合并为一个关于API响应格式的综合属性

### Correctness Properties:

Property 1: LocalStorage持久化往返一致性
*For any* 蒸馏结果，保存到本地存储后再读取应该得到相同的数据（关键词、问题列表、ID）
**Validates: Requirements 1.1, 1.2**

Property 2: LocalStorage更新替换旧数据
*For any* 两个不同的蒸馏结果，先保存第一个再保存第二个后，本地存储应该只包含第二个结果
**Validates: Requirements 1.5**

Property 3: 获取历史记录详情完整性
*For any* 有效的蒸馏记录ID，通过API获取的详情应该包含该记录的所有关联问题
**Validates: Requirements 2.1**

Property 4: 删除记录的级联效果
*For any* 有效的蒸馏记录ID，删除该记录后，数据库中不应存在该记录及其关联的任何话题
**Validates: Requirements 3.1, 3.2, 3.4, 7.2**

Property 5: 更新关键词的持久性
*For any* 有效的蒸馏记录ID和非空关键词，更新操作后数据库中该记录的关键词应该等于新关键词
**Validates: Requirements 4.3, 7.4**

Property 6: 空白关键词验证拒绝
*For any* 由纯空白字符组成的字符串（包括空字符串、空格、制表符等），更新关键词操作应该被拒绝并返回验证错误
**Validates: Requirements 4.5**

Property 7: 全部删除的完整性
*For any* 数据库初始状态，执行全部删除操作后，数据库中不应存在任何蒸馏记录和话题记录
**Validates: Requirements 5.2, 7.5**

Property 8: 全部删除清除本地存储
*For any* 本地存储状态，执行全部删除操作后，本地存储中不应包含蒸馏结果数据
**Validates: Requirements 5.5**

Property 9: 无效ID验证拒绝
*For any* 无效的记录ID（负数、零、不存在的ID），删除或更新操作应该返回错误响应
**Validates: Requirements 7.1, 7.3**

Property 10: API响应格式一致性
*For any* API操作，成功时应该返回2xx状态码和成功消息，失败时应该返回4xx/5xx状态码和错误描述
**Validates: Requirements 7.6, 7.7**

## Error Handling

### 前端错误处理

1. **网络错误**
   - 捕获所有API调用的网络异常
   - 显示用户友好的错误提示
   - 提供重试选项

2. **数据验证错误**
   - 在提交前验证用户输入
   - 显示具体的验证错误信息
   - 阻止无效数据提交

3. **LocalStorage错误**
   - 处理存储空间不足的情况
   - 处理JSON解析错误
   - 提供降级方案（不使用持久化）

### 后端错误处理

1. **数据库错误**
   - 捕获SQL查询异常
   - 记录详细错误日志
   - 返回通用错误信息给客户端

2. **参数验证错误**
   - 验证请求参数的存在性和格式
   - 返回400状态码和具体错误信息

3. **资源不存在错误**
   - 验证记录ID的有效性
   - 返回404状态码

4. **级联删除错误**
   - 使用数据库事务确保一致性
   - 失败时回滚所有操作

## Testing Strategy

### 单元测试

**前端单元测试 (Jest + React Testing Library):**

1. LocalStorage工具函数测试
   - 测试保存、读取、清除功能
   - 测试JSON序列化/反序列化
   - 测试错误处理

2. 组件交互测试
   - 测试按钮点击事件
   - 测试对话框显示和关闭
   - 测试表单提交

3. 状态管理测试
   - 测试状态更新逻辑
   - 测试副作用处理

**后端单元测试 (Jest):**

1. API端点测试
   - 测试每个端点的成功场景
   - 测试参数验证
   - 测试错误响应

2. 数据库操作测试
   - 测试CRUD操作
   - 测试级联删除
   - 测试事务处理

### 属性测试

使用 **fast-check** 库进行属性测试，每个测试运行至少100次迭代。

**测试配置：**
```typescript
import fc from 'fast-check';

// 配置每个属性测试运行100次
const testConfig = { numRuns: 100 };
```

**生成器定义：**

```typescript
// 生成有效的蒸馏结果
const distillationResultArb = fc.record({
  distillationId: fc.integer({ min: 1 }),
  keyword: fc.string({ minLength: 1, maxLength: 255 }),
  questions: fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 20 }),
  count: fc.integer({ min: 1, max: 20 })
});

// 生成空白字符串（空字符串、空格、制表符等）
const whitespaceStringArb = fc.oneof(
  fc.constant(''),
  fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r')),
  fc.string().filter(s => s.trim() === '')
);

// 生成无效的ID
const invalidIdArb = fc.oneof(
  fc.integer({ max: 0 }),  // 负数和零
  fc.integer({ min: 999999 })  // 不存在的大数
);
```

**属性测试任务：**

1. **Property 1: LocalStorage持久化往返一致性**
   - 生成随机蒸馏结果
   - 保存到LocalStorage
   - 读取并验证数据一致性

2. **Property 2: LocalStorage更新替换旧数据**
   - 生成两个不同的蒸馏结果
   - 依次保存
   - 验证只有最新的结果存在

3. **Property 3: 获取历史记录详情完整性**
   - 创建随机蒸馏记录和话题
   - 通过API获取详情
   - 验证返回的问题列表完整

4. **Property 4: 删除记录的级联效果**
   - 创建随机蒸馏记录和话题
   - 执行删除操作
   - 验证记录和话题都被删除

5. **Property 5: 更新关键词的持久性**
   - 创建随机蒸馏记录
   - 生成新的随机关键词
   - 更新并验证

6. **Property 6: 空白关键词验证拒绝**
   - 生成各种空白字符串
   - 尝试更新关键词
   - 验证都被拒绝

7. **Property 7: 全部删除的完整性**
   - 创建随机数量的蒸馏记录
   - 执行全部删除
   - 验证数据库为空

8. **Property 8: 全部删除清除本地存储**
   - 保存随机蒸馏结果到LocalStorage
   - 执行全部删除
   - 验证LocalStorage被清除

9. **Property 9: 无效ID验证拒绝**
   - 生成各种无效ID
   - 尝试删除或更新
   - 验证都返回错误

10. **Property 10: API响应格式一致性**
    - 执行各种API操作
    - 验证响应格式符合规范

### 集成测试

1. **端到端流程测试**
   - 测试完整的蒸馏-保存-查看-编辑-删除流程
   - 测试页面刷新后的数据恢复
   - 测试多个操作的组合场景

2. **并发操作测试**
   - 测试同时进行多个删除操作
   - 测试快速切换历史记录

## Implementation Notes

### 前端实现要点

1. **useEffect钩子**
   - 组件挂载时从LocalStorage加载结果
   - 组件挂载时加载历史记录列表

2. **状态同步**
   - 蒸馏成功后同时更新result状态和LocalStorage
   - 删除操作后同步更新UI和LocalStorage

3. **用户体验优化**
   - 使用Ant Design的Modal.confirm进行删除确认
   - 使用message组件显示操作反馈
   - 添加loading状态防止重复提交

### 后端实现要点

1. **数据库事务**
   - 删除操作使用事务确保一致性
   - 级联删除依赖数据库外键约束

2. **参数验证**
   - 使用中间件或工具函数统一验证
   - 提供清晰的错误信息

3. **性能优化**
   - 获取详情时使用JOIN查询减少数据库访问
   - 添加适当的索引

### 安全考虑

1. **SQL注入防护**
   - 使用参数化查询
   - 验证和清理用户输入

2. **XSS防护**
   - React自动转义输出
   - 避免使用dangerouslySetInnerHTML

3. **CSRF防护**
   - 使用CORS配置限制来源
   - 考虑添加CSRF令牌（如果需要）
