# Design Document

## Overview

本设计文档描述了在文章生成任务配置对话框（TaskConfigModal）中添加转化目标选择功能的实现方案。该功能将允许用户在创建文章生成任务时选择一个转化目标（企业客户信息），以便生成的文章能够针对特定的目标客户进行定制化内容生成。

该功能的核心是在现有的任务配置流程中无缝集成转化目标选择，保持与其他字段一致的用户体验，并确保数据能够正确传递到后端服务。

## Architecture

该功能涉及以下几个层次的修改：

1. **前端展示层（TaskConfigModal组件）**：添加转化目标选择字段，处理用户交互
2. **前端API层（articleGenerationApi.ts）**：添加获取转化目标列表的API函数
3. **前端类型层（articleGeneration.ts）**：扩展TaskConfig类型以包含conversionTargetId
4. **后端路由层（articleGeneration.ts）**：修改任务创建接口以接收和验证conversionTargetId
5. **后端服务层（ArticleGenerationService）**：修改任务创建逻辑以保存conversionTargetId
6. **数据库层（schema.sql）**：修改generation_tasks表以添加conversion_target_id字段

### 数据流

```
用户选择转化目标
    ↓
TaskConfigModal收集表单数据（包含conversionTargetId）
    ↓
调用createTask API（传递完整的TaskConfig）
    ↓
后端验证conversionTargetId是否存在
    ↓
ArticleGenerationService创建任务（保存conversionTargetId）
    ↓
返回任务创建结果
```

## Components and Interfaces

### 1. 前端组件修改

#### TaskConfigModal组件

**位置**: `client/src/components/TaskConfigModal.tsx`

**修改内容**:
- 添加`conversionTargets`状态变量存储转化目标列表
- 在`loadAllData`函数中添加`fetchConversionTargets()`调用
- 在表单中添加"选择转化目标"字段（位于"选择蒸馏历史"之后）
- 在`handleSubmit`中包含`conversionTargetId`字段

**新增状态**:
```typescript
const [conversionTargets, setConversionTargets] = useState<ConversionTarget[]>([]);
```

**表单字段配置**:
```typescript
<Form.Item
  name="conversionTargetId"
  label="选择转化目标"
  rules={[{ required: true, message: '请选择转化目标' }]}
>
  <Select
    placeholder="请选择转化目标"
    showSearch
    optionFilterProp="children"
  >
    {conversionTargets.map(item => (
      <Select.Option key={item.id} value={item.id}>
        {item.company_name} ({item.industry})
      </Select.Option>
    ))}
  </Select>
</Form.Item>
```

### 2. 前端API层修改

#### articleGenerationApi.ts

**位置**: `client/src/api/articleGenerationApi.ts`

**新增函数**:
```typescript
/**
 * 获取转化目标列表
 */
export async function fetchConversionTargets(): Promise<ConversionTarget[]> {
  const response = await axios.get(`${API_BASE_URL}/conversion-targets`);
  return response.data.data.targets || [];
}
```

### 3. 前端类型定义修改

#### articleGeneration.ts

**位置**: `client/src/types/articleGeneration.ts`

**修改TaskConfig接口**:
```typescript
export interface TaskConfig {
  distillationId: number;
  albumId: number;
  knowledgeBaseId: number;
  articleSettingId: number;
  conversionTargetId: number;  // 新增字段
  articleCount: number;
}
```

**新增ConversionTarget接口**:
```typescript
export interface ConversionTarget {
  id: number;
  company_name: string;
  industry: string;
  company_size: string;
  features: string | null;
  contact_info: string;
  website: string | null;
  target_audience: string | null;
  core_products: string | null;
  created_at: string;
  updated_at: string;
}
```

### 4. 后端路由层修改

#### articleGeneration.ts

**位置**: `server/src/routes/articleGeneration.ts`

**修改createTaskSchema**:
```typescript
const createTaskSchema = z.object({
  distillationId: z.number().int().positive('蒸馏历史ID必须是正整数'),
  albumId: z.number().int().positive('图库ID必须是正整数'),
  knowledgeBaseId: z.number().int().positive('知识库ID必须是正整数'),
  articleSettingId: z.number().int().positive('文章设置ID必须是正整数'),
  conversionTargetId: z.number().int().positive('转化目标ID必须是正整数'),  // 新增
  articleCount: z.number().int().positive('文章数量必须是正整数').max(100, '文章数量不能超过100')
});
```

**在POST /tasks路由中添加验证**:
```typescript
// 验证转化目标是否存在
const conversionTargetCheck = await pool.query(
  'SELECT id FROM conversion_targets WHERE id = $1', 
  [validatedData.conversionTargetId]
);
if (conversionTargetCheck.rows.length === 0) {
  return res.status(404).json({ error: '转化目标不存在' });
}
```

**修改service.createTask调用**:
```typescript
const taskId = await service.createTask({
  distillationId: validatedData.distillationId,
  albumId: validatedData.albumId,
  knowledgeBaseId: validatedData.knowledgeBaseId,
  articleSettingId: validatedData.articleSettingId,
  conversionTargetId: validatedData.conversionTargetId,  // 新增
  articleCount: validatedData.articleCount
});
```

### 5. 后端服务层修改

#### ArticleGenerationService

**位置**: `server/src/services/articleGenerationService.ts`

**修改TaskConfig接口**:
```typescript
interface TaskConfig {
  distillationId: number;
  albumId: number;
  knowledgeBaseId: number;
  articleSettingId: number;
  conversionTargetId: number;  // 新增
  articleCount: number;
}
```

**修改createTask方法的INSERT语句**:
```typescript
const result = await pool.query(
  `INSERT INTO generation_tasks 
   (distillation_id, album_id, knowledge_base_id, article_setting_id, conversion_target_id, requested_count, status, progress) 
   VALUES ($1, $2, $3, $4, $5, $6, 'pending', 0) 
   RETURNING id`,
  [config.distillationId, config.albumId, config.knowledgeBaseId, config.articleSettingId, config.conversionTargetId, config.articleCount]
);
```

### 6. 数据库层修改

#### schema.sql

**位置**: `server/src/db/schema.sql`

**修改generation_tasks表**:
```sql
ALTER TABLE generation_tasks 
ADD COLUMN conversion_target_id INTEGER REFERENCES conversion_targets(id) ON DELETE CASCADE;
```

**添加索引**:
```sql
CREATE INDEX IF NOT EXISTS idx_generation_tasks_conversion_target 
ON generation_tasks(conversion_target_id);
```

## Data Models

### ConversionTarget（转化目标）

```typescript
interface ConversionTarget {
  id: number;                      // 主键
  company_name: string;            // 公司名称
  industry: string;                // 行业
  company_size: string;            // 公司规模
  features: string | null;         // 特点
  contact_info: string;            // 联系方式
  website: string | null;          // 网站
  target_audience: string | null;  // 目标受众
  core_products: string | null;    // 核心产品
  created_at: string;              // 创建时间
  updated_at: string;              // 更新时间
}
```

### TaskConfig（任务配置）- 扩展后

```typescript
interface TaskConfig {
  distillationId: number;      // 蒸馏历史ID
  albumId: number;             // 图库ID
  knowledgeBaseId: number;     // 知识库ID
  articleSettingId: number;    // 文章设置ID
  conversionTargetId: number;  // 转化目标ID（新增）
  articleCount: number;        // 文章数量
}
```

### GenerationTask（生成任务）- 扩展后

数据库表`generation_tasks`将包含以下字段：

```sql
id SERIAL PRIMARY KEY
distillation_id INTEGER NOT NULL REFERENCES distillations(id)
album_id INTEGER NOT NULL REFERENCES albums(id)
knowledge_base_id INTEGER NOT NULL REFERENCES knowledge_bases(id)
article_setting_id INTEGER NOT NULL REFERENCES article_settings(id)
conversion_target_id INTEGER REFERENCES conversion_targets(id)  -- 新增
requested_count INTEGER NOT NULL
generated_count INTEGER DEFAULT 0
status VARCHAR(20) NOT NULL DEFAULT 'pending'
progress INTEGER DEFAULT 0
error_message TEXT
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Acceptance Criteria Testing Prework

1.1 WHEN TaskConfigModal打开时，THEN TaskConfigModal SHALL在"选择蒸馏历史"字段之后显示"选择转化目标"字段
  Thoughts: 这是测试UI渲染的特定行为。我们可以测试当对话框打开时，表单中是否包含转化目标字段，并且该字段在正确的位置。
  Testable: yes - example

1.2 WHEN TaskConfigModal加载时，THEN TaskConfigModal SHALL从API获取所有可用的ConversionTarget列表
  Thoughts: 这是测试数据加载行为。我们可以模拟API调用，验证组件是否正确调用了fetchConversionTargets函数。
  Testable: yes - example

1.3 WHEN用户点击"选择转化目标"下拉框时，THEN TaskConfigModal SHALL显示所有可用的ConversionTarget选项
  Thoughts: 这是测试UI交互。我们可以验证下拉框中的选项数量和内容是否与加载的数据匹配。
  Testable: yes - example

1.4 WHEN ConversionTarget列表为空时，THEN TaskConfigModal SHALL在下拉框中显示"暂无转化目标"提示
  Thoughts: 这是测试边界情况。我们可以模拟空列表场景，验证UI是否正确显示提示信息。
  Testable: yes - example

1.5 WHEN用户选择一个ConversionTarget时，THEN TaskConfigModal SHALL将选中的ConversionTarget ID保存到表单状态中
  Thoughts: 这是测试表单状态管理。我们可以模拟用户选择操作，验证表单值是否正确更新。
  Testable: yes - example

2.1 WHEN用户与"选择转化目标"字段交互时，THEN TaskConfigModal SHALL提供与其他Select字段相同的交互行为
  Thoughts: 这是测试UI一致性。这是一个设计目标，不是可测试的功能属性。
  Testable: no

2.2 WHEN用户未选择ConversionTarget就提交表单时，THEN TaskConfigModal SHALL显示"请选择转化目标"的验证错误信息
  Thoughts: 这是测试表单验证。我们可以模拟提交空表单，验证是否显示正确的错误信息。
  Testable: yes - example

2.3 WHEN ConversionTarget选项显示时，THEN TaskConfigModal SHALL显示公司名称和行业信息
  Thoughts: 这是测试选项格式。我们可以验证每个选项的文本是否包含公司名称和行业。
  Testable: yes - example

2.4 WHEN用户在下拉框中搜索时，THEN TaskConfigModal SHALL支持按公司名称进行模糊搜索
  Thoughts: 这是测试搜索功能。由于使用Ant Design的Select组件，搜索功能是内置的，我们可以验证showSearch和optionFilterProp属性是否正确设置。
  Testable: yes - example

2.5 WHEN用户取消对话框时，THEN TaskConfigModal SHALL清除所有表单字段包括ConversionTarget选择
  Thoughts: 这是测试表单重置。我们可以模拟取消操作，验证表单是否被重置。
  Testable: yes - example

3.1 WHEN用户提交任务配置时，THEN TaskConfigModal SHALL将选中的ConversionTarget ID包含在TaskConfig对象中
  Thoughts: 这是测试数据提交。我们可以模拟表单提交，验证传递给onSubmit的对象是否包含conversionTargetId。
  Testable: yes - example

3.2 WHEN TaskConfig提交到父组件时，THEN TaskConfigModal SHALL确保conversionTargetId字段存在且为有效的数字类型
  Thoughts: 这是测试数据类型验证。我们可以验证提交的数据结构和类型。
  Testable: yes - example

3.3 WHEN API调用失败时，THEN TaskConfigModal SHALL显示错误信息并保持对话框打开状态
  Thoughts: 这是测试错误处理。我们可以模拟API失败，验证错误信息是否显示且对话框未关闭。
  Testable: yes - example

3.4 WHEN任务创建成功后，THEN TaskConfigModal SHALL重置表单并关闭对话框
  Thoughts: 这是测试成功流程。我们可以模拟成功响应，验证表单是否重置且对话框关闭。
  Testable: yes - example

4.1 WHEN TaskConfigModal需要获取ConversionTarget列表时，THEN TaskConfigModal SHALL调用fetchConversionTargets API函数
  Thoughts: 这是测试API调用。我们可以使用spy验证函数是否被调用。
  Testable: yes - example

4.2 WHEN API返回ConversionTarget数据时，THEN fetchConversionTargets SHALL返回包含id、company_name和industry字段的对象数组
  Thoughts: 这是测试API响应格式。我们可以验证返回的数据结构。
  Testable: yes - example

4.3 WHEN API调用失败时，THEN fetchConversionTargets SHALL抛出包含错误信息的异常
  Thoughts: 这是测试错误处理。我们可以模拟API失败，验证是否抛出异常。
  Testable: yes - example

4.4 WHEN多个数据源同时加载时，THEN TaskConfigModal SHALL使用Promise.all并行加载所有数据以提高性能
  Thoughts: 这是测试性能优化。我们可以验证是否使用Promise.all而不是顺序调用。
  Testable: yes - example

5.1 WHEN TaskConfigModal正在加载数据时，THEN TaskConfigModal SHALL显示加载指示器覆盖整个表单区域
  Thoughts: 这是测试加载状态UI。我们可以验证加载时Spin组件的spinning属性是否为true。
  Testable: yes - example

5.2 WHEN数据加载完成时，THEN TaskConfigModal SHALL隐藏加载指示器并显示可交互的表单
  Thoughts: 这是测试加载完成状态。我们可以验证加载完成后Spin组件的spinning属性是否为false。
  Testable: yes - example

5.3 WHEN数据加载失败时，THEN TaskConfigModal SHALL隐藏加载指示器并显示错误提示信息
  Thoughts: 这是测试错误状态。我们可以模拟加载失败，验证加载指示器是否隐藏且显示错误信息。
  Testable: yes - example

### Property Reflection

审查所有标记为可测试的属性后，发现大部分是针对特定UI交互和API调用的单元测试示例，而不是通用属性。这些测试主要验证：

1. **UI渲染和交互**：字段显示、选项格式、搜索功能
2. **表单验证**：必填字段验证、数据类型验证
3. **数据加载**：API调用、数据格式、错误处理
4. **状态管理**：表单状态、加载状态、错误状态

由于这些都是针对特定场景的测试，没有发现明显的冗余或可合并的属性。每个测试都验证了不同的功能点。

由于本功能主要是UI集成和数据流传递，大部分测试都是具体的示例测试而非通用属性测试。因此，我们不需要定义通用的correctness properties，而是依赖单元测试来验证各个功能点。

## Error Handling

### 前端错误处理

1. **API调用失败**
   - 在`loadAllData`中捕获异常
   - 使用`message.error()`显示用户友好的错误信息
   - 保持对话框打开，允许用户重试

2. **表单验证失败**
   - 使用Ant Design Form的内置验证
   - 显示字段级别的错误信息
   - 阻止表单提交直到所有字段有效

3. **任务创建失败**
   - 在`handleSubmit`中捕获异常
   - 显示详细的错误信息
   - 保持对话框打开和表单数据

### 后端错误处理

1. **数据验证失败**
   - 使用Zod schema验证请求数据
   - 返回400状态码和详细的验证错误

2. **资源不存在**
   - 验证conversionTargetId对应的记录是否存在
   - 返回404状态码和描述性错误信息

3. **数据库错误**
   - 捕获数据库异常
   - 记录详细错误日志
   - 返回500状态码和通用错误信息

## Testing Strategy

### 单元测试

由于本功能主要是UI集成和数据流传递，我们将编写以下单元测试：

#### 前端组件测试（TaskConfigModal.test.tsx）

1. **渲染测试**
   - 验证对话框打开时显示所有必需字段
   - 验证转化目标字段在正确位置（蒸馏历史之后）
   - 验证字段标签和占位符文本正确

2. **数据加载测试**
   - 模拟API调用，验证fetchConversionTargets被调用
   - 验证加载状态正确显示
   - 验证数据加载后选项正确渲染

3. **表单交互测试**
   - 验证用户选择转化目标后表单值更新
   - 验证搜索功能正常工作
   - 验证表单重置清除所有字段

4. **表单验证测试**
   - 验证未选择转化目标时显示错误
   - 验证所有必填字段的验证规则

5. **提交测试**
   - 验证提交时包含conversionTargetId
   - 验证成功后表单重置和对话框关闭
   - 验证失败时显示错误信息

#### 前端API测试（articleGenerationApi.test.ts）

1. **fetchConversionTargets测试**
   - 验证正确的API端点被调用
   - 验证返回数据格式正确
   - 验证错误处理

#### 后端路由测试（articleGeneration.test.ts）

1. **POST /tasks测试**
   - 验证包含conversionTargetId的请求成功创建任务
   - 验证缺少conversionTargetId返回400错误
   - 验证无效的conversionTargetId返回404错误
   - 验证数据验证规则

2. **GET /tasks/:id测试**
   - 验证返回的任务包含conversion_target_id字段

### 集成测试

1. **端到端流程测试**
   - 打开对话框 → 加载数据 → 选择转化目标 → 提交 → 验证任务创建
   - 验证整个数据流从前端到后端到数据库

2. **错误场景测试**
   - 转化目标列表为空时的用户体验
   - API失败时的错误处理
   - 无效数据提交时的验证

### 测试工具

- **前端**: Jest + React Testing Library
- **后端**: Jest + Supertest
- **数据库**: 使用测试数据库或内存数据库

### 测试覆盖率目标

- 组件代码覆盖率：>80%
- API函数覆盖率：100%
- 路由处理器覆盖率：>90%

## Implementation Notes

### 实现顺序

1. **数据库迁移**：首先添加conversion_target_id字段到generation_tasks表
2. **后端类型和验证**：更新Zod schema和接口定义
3. **后端路由**：修改任务创建路由以处理新字段
4. **后端服务**：更新ArticleGenerationService
5. **前端类型**：更新TypeScript接口
6. **前端API**：添加fetchConversionTargets函数
7. **前端组件**：修改TaskConfigModal组件
8. **测试**：编写和运行所有测试

### 向后兼容性

由于这是一个新增的必填字段，需要考虑：

1. **数据库迁移**：新字段应该允许NULL或提供默认值，以兼容现有数据
2. **API版本**：如果有现有的API客户端，考虑使字段可选或提供默认值
3. **建议**：将conversion_target_id设为可选字段（允许NULL），在前端强制要求，但后端允许为空以保持向后兼容

修改后的数据库字段定义：
```sql
ALTER TABLE generation_tasks 
ADD COLUMN conversion_target_id INTEGER REFERENCES conversion_targets(id) ON DELETE SET NULL;
```

修改后的Zod schema：
```typescript
const createTaskSchema = z.object({
  // ... 其他字段
  conversionTargetId: z.number().int().positive('转化目标ID必须是正整数').optional(),
  // ... 其他字段
});
```

这样可以确保现有的API调用不会因为缺少新字段而失败。

### UI/UX考虑

1. **字段位置**：放在"选择蒸馏历史"之后，保持逻辑流程的连贯性
2. **选项格式**：显示"公司名称 (行业)"，提供足够的信息帮助用户选择
3. **搜索功能**：启用搜索以便在列表较长时快速找到目标
4. **空状态处理**：当没有转化目标时，提供友好的提示和引导
5. **加载状态**：使用Spin组件覆盖整个表单，提供清晰的加载反馈

### 性能优化

1. **并行加载**：使用Promise.all同时加载所有数据源
2. **缓存考虑**：如果转化目标列表变化不频繁，可以考虑在应用级别缓存
3. **分页**：如果转化目标数量很大，考虑在API层面实现分页或虚拟滚动

### 安全考虑

1. **输入验证**：前后端都进行严格的数据验证
2. **SQL注入防护**：使用参数化查询
3. **权限检查**：确保用户有权访问选择的转化目标（如果有权限系统）
