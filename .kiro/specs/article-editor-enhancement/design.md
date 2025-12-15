# 设计文档

## 概述

本设计文档描述文章编辑器增强功能的技术实现方案。该功能将现有的简单文本编辑器升级为功能完善的富文本编辑器，并集成AI智能排版能力和发布状态管理。设计遵循现有系统架构，使用React + TypeScript前端和Node.js + Express后端，确保与现有文章管理系统的无缝集成。

## 架构

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      前端层 (React)                          │
├─────────────────────────────────────────────────────────────┤
│  ArticleListPage                                            │
│    ├─ 文章列表表格 (Ant Design Table)                       │
│    │   ├─ 发布状态列                                        │
│    │   └─ 操作列 (查看/编辑/删除)                           │
│    └─ ArticleEditorModal (新组件)                          │
│        ├─ React-Quill 富文本编辑器                         │
│        ├─ 智能排版按钮                                      │
│        └─ 预览标签页                                        │
├─────────────────────────────────────────────────────────────┤
│                      API层 (Express)                         │
├─────────────────────────────────────────────────────────────┤
│  /articles/:id (PUT) - 更新文章内容                         │
│  /articles/:id/publish (PUT) - 更新发布状态                 │
│  /articles/:id/smart-format (POST) - 智能排版               │
│  /articles (GET) - 获取文章列表（含发布状态）               │
│  /articles/:id (GET) - 获取单篇文章（含发布状态）           │
├─────────────────────────────────────────────────────────────┤
│                    服务层 (Services)                         │
├─────────────────────────────────────────────────────────────┤
│  ArticleService                                             │
│    ├─ updateArticle() - 更新文章                           │
│    ├─ publishArticle() - 发布文章                          │
│    └─ smartFormat() - 智能排版                             │
│  AIService (现有)                                           │
│    └─ formatArticle() - 调用LLM进行排版                    │
├─────────────────────────────────────────────────────────────┤
│                    数据层 (SQLite)                           │
├─────────────────────────────────────────────────────────────┤
│  articles 表                                                │
│    ├─ 现有字段                                              │
│    ├─ is_published (新增)                                  │
│    └─ published_at (新增)                                  │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈选择

**富文本编辑器**: React-Quill
- 理由：成熟稳定，基于Quill.js，提供完整的富文本编辑功能
- 优势：支持自定义工具栏、图片上传、格式化、易于集成
- 社区活跃，文档完善，与React生态系统集成良好

**替代方案考虑**:
- TinyMCE: 功能强大但体积较大，配置复杂
- Draft.js: Facebook出品但学习曲线陡峭
- Slate: 高度可定制但需要更多开发工作

## 组件和接口

### 前端组件

#### 1. ArticleEditorModal (新组件)

```typescript
interface ArticleEditorModalProps {
  visible: boolean;
  article: Article | null;
  onClose: () => void;
  onSave: (article: Article) => Promise<void>;
}

interface Article {
  id: number;
  title: string;
  content: string;
  keyword: string;
  imageUrl?: string;
  isPublished: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

**功能**:
- 富文本编辑器集成（React-Quill）
- 工具栏配置：字体、字号、粗体、斜体、下划线、颜色、对齐、列表、图片
- 智能排版按钮
- 编辑/预览标签页切换
- 保存和取消操作

#### 2. ArticleListPage (修改现有组件)

**修改内容**:
- 在操作列添加独立的"编辑"按钮
- 添加"发布状态"列
- "查看"按钮仅用于只读查看
- 移除查看模态框中的编辑功能

### 后端API接口

#### 1. PUT /articles/:id
更新文章内容（现有接口扩展）

**请求体**:
```typescript
{
  title?: string;
  content: string;  // HTML格式的富文本内容
  imageUrl?: string;
}
```

**响应**:
```typescript
{
  id: number;
  title: string;
  content: string;
  keyword: string;
  imageUrl?: string;
  isPublished: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

#### 2. PUT /articles/:id/publish (新接口)
更新文章发布状态

**请求体**:
```typescript
{
  isPublished: boolean;
}
```

**响应**:
```typescript
{
  id: number;
  isPublished: boolean;
  publishedAt?: string;
  updatedAt: string;
}
```

#### 3. POST /articles/:id/smart-format (新接口)
智能排版文章

**请求体**:
```typescript
{
  content: string;  // 原始HTML内容
  imageUrl?: string;
}
```

**响应**:
```typescript
{
  content: string;  // 排版后的HTML内容
}
```

**处理逻辑**:
1. 提取HTML中的纯文本和图片
2. 调用AIService生成排版prompt
3. 将排版后的内容转换回HTML格式
4. 确保图片插入在第一段之后

### 服务层接口

#### ArticleService

```typescript
class ArticleService {
  /**
   * 更新文章内容
   */
  async updateArticle(
    id: number, 
    updates: { title?: string; content: string; imageUrl?: string }
  ): Promise<Article>;

  /**
   * 更新发布状态
   */
  async publishArticle(
    id: number, 
    isPublished: boolean
  ): Promise<{ id: number; isPublished: boolean; publishedAt?: string }>;

  /**
   * 智能排版
   */
  async smartFormat(
    id: number,
    content: string,
    imageUrl?: string
  ): Promise<string>;
}
```

#### AIService (扩展现有服务)

```typescript
class AIService {
  /**
   * 智能排版文章
   * @param content - 文章纯文本内容
   * @param hasImage - 是否包含图片
   * @returns 排版后的文章内容
   */
  async formatArticle(content: string, hasImage: boolean): Promise<string>;
}
```

## 数据模型

### 数据库Schema变更

```sql
-- 为articles表添加发布状态字段
ALTER TABLE articles ADD COLUMN is_published BOOLEAN DEFAULT false;
ALTER TABLE articles ADD COLUMN published_at TIMESTAMP;

-- 创建索引以优化查询
CREATE INDEX idx_articles_is_published ON articles(is_published);
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
```

### Article数据模型

```typescript
interface Article {
  id: number;
  title: string;
  keyword: string;
  distillationId?: number;
  taskId?: number;
  requirements?: string;
  content: string;          // HTML格式的富文本内容
  imageUrl?: string;
  provider: string;
  isPublished: boolean;     // 新增：发布状态
  publishedAt?: string;     // 新增：发布时间
  createdAt: string;
  updatedAt: string;
}
```



## 正确性属性

*属性是系统在所有有效执行中应该保持为真的特征或行为——本质上是关于系统应该做什么的形式化陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### 属性前期分析

#### 需求 1 - 编辑按钮位置调整

1.1 WHEN 用户查看文章列表 THEN 文章管理系统 SHALL 在操作列中显示独立的"编辑"按钮
- 思考：这是UI布局要求，测试应验证操作列包含编辑按钮
- 可测试性：是 - 示例

1.2 WHEN 用户点击操作列中的"编辑"按钮 THEN 文章管理系统 SHALL 打开该文章的编辑模态框
- 思考：这是UI交互行为，可以测试点击后模态框是否打开
- 可测试性：是 - 示例

1.3 WHEN 用户点击"查看"按钮 THEN 文章管理系统 SHALL 仅显示文章内容而不包含编辑功能
- 思考：这是验证查看模式不包含编辑功能
- 可测试性：是 - 示例

1.4 WHEN 编辑模态框打开 THEN 文章管理系统 SHALL 加载文章的完整内容到编辑器中
- 思考：这是数据加载的正确性，对所有文章都应该成立
- 可测试性：是 - 属性

#### 需求 2 - 富文本编辑器

2.1 WHEN 用户在编辑模式下 THEN 文章管理系统 SHALL 提供富文本编辑器工具栏
- 思考：这是UI组件存在性检查
- 可测试性：是 - 示例

2.2 WHEN 用户选择文本并应用格式 THEN 文章管理系统 SHALL 立即在编辑器中显示格式化效果
- 思考：这是编辑器的基本功能，由React-Quill库保证
- 可测试性：否

2.3 WHEN 用户点击图片插入按钮 THEN 文章管理系统 SHALL 提供图片上传或URL输入功能
- 思考：这是UI功能存在性检查
- 可测试性：是 - 示例

2.4 WHEN 用户插入图片 THEN 文章管理系统 SHALL 在编辑器中显示图片预览
- 思考：这是编辑器的基本功能，由React-Quill库保证
- 可测试性：否

2.5 WHEN 用户保存文章 THEN 文章管理系统 SHALL 保留所有格式化内容和图片引用
- 思考：这是往返属性 - 保存后读取应该得到相同内容
- 可测试性：是 - 属性

2.6 WHEN 编辑器加载现有文章 THEN 文章管理系统 SHALL 正确渲染所有已保存的格式和图片
- 思考：这与2.5是同一个往返属性的另一面
- 可测试性：是 - 属性（与2.5合并）

#### 需求 3 - 智能排版

3.1 WHEN 用户在编辑模式下 THEN 文章管理系统 SHALL 在编辑器工具栏中显示"智能排版"按钮
- 思考：这是UI组件存在性检查
- 可测试性：是 - 示例

3.2 WHEN 用户点击"智能排版"按钮 THEN 文章管理系统 SHALL 调用已连接的大模型服务处理文章内容
- 思考：这是API调用行为，对所有文章都应该成立
- 可测试性：是 - 属性

3.3 WHEN 大模型处理文章 THEN 文章管理系统 SHALL 按照通用新闻稿格式重新组织内容结构
- 思考：这是AI输出质量要求，无法自动化测试
- 可测试性：否

3.4 WHEN 文章包含图片 THEN 文章管理系统 SHALL 将图片放置在第一段文字之后
- 思考：这是格式化规则，可以验证输出HTML结构
- 可测试性：是 - 属性

3.5 WHEN 智能排版完成 THEN 文章管理系统 SHALL 在编辑器中显示排版后的内容
- 思考：这是UI更新行为
- 可测试性：是 - 示例

3.6 WHEN 智能排版处理中 THEN 文章管理系统 SHALL 显示加载状态并禁用编辑器操作
- 思考：这是UI状态管理
- 可测试性：是 - 示例

3.7 IF 智能排版失败 THEN 文章管理系统 SHALL 显示错误信息并保持原始内容不变
- 思考：这是错误处理，验证失败时内容不变
- 可测试性：是 - 属性

#### 需求 4 - 发布状态UI

4.1 WHEN 用户查看文章列表 THEN 文章管理系统 SHALL 在表格中显示"发布状态"列
- 思考：这是UI布局要求
- 可测试性：是 - 示例

4.2 WHEN 文章未发布 THEN 文章管理系统 SHALL 在发布状态列显示"草稿"标签
- 思考：这是对所有未发布文章的显示规则
- 可测试性：是 - 属性

4.3 WHEN 文章已发布 THEN 文章管理系统 SHALL 在发布状态列显示"已发布"标签和发布时间
- 思考：这是对所有已发布文章的显示规则
- 可测试性：是 - 属性

4.4 WHEN 文章创建时 THEN 文章管理系统 SHALL 将发布状态默认设置为未发布
- 思考：这是数据库默认值，对所有新文章成立
- 可测试性：是 - 属性

4.5 WHEN 文章状态更新 THEN 文章管理系统 SHALL 记录状态变更时间
- 思考：这是数据完整性要求，对所有状态更新成立
- 可测试性：是 - 属性

#### 需求 5 - 发布状态API

5.1 WHEN 外部模块调用发布API THEN 文章管理系统 SHALL 提供 PUT /articles/:id/publish 端点更新发布状态
- 思考：这是API端点存在性
- 可测试性：是 - 示例

5.2 WHEN 发布API被调用 THEN 文章管理系统 SHALL 验证文章ID的有效性
- 思考：这是输入验证，对所有无效ID应该拒绝
- 可测试性：是 - 属性

5.3 WHEN 文章发布成功 THEN 文章管理系统 SHALL 返回更新后的文章对象，包含发布状态和发布时间
- 思考：这是API响应完整性，对所有成功请求成立
- 可测试性：是 - 属性

5.4 WHEN 外部模块查询文章 THEN 文章管理系统 SHALL 在响应中包含发布状态字段
- 思考：这是API响应完整性，对所有查询成立
- 可测试性：是 - 属性

5.5 WHEN 文章发布状态更新 THEN 文章管理系统 SHALL 使用数据库事务确保数据一致性
- 思考：这是事务性保证，难以直接测试
- 可测试性：否

5.6 IF 发布API调用失败 THEN 文章管理系统 SHALL 返回适当的HTTP错误代码和错误信息
- 思考：这是错误处理，对所有错误情况成立
- 可测试性：是 - 属性

#### 需求 6 - 实时预览

6.1 WHEN 用户在编辑模式下修改内容 THEN 文章管理系统 SHALL 在预览区域实时显示渲染后的效果
- 思考：这是UI实时更新，由React状态管理保证
- 可测试性：否

6.2 WHEN 预览区域渲染内容 THEN 文章管理系统 SHALL 使用与查看模式相同的渲染逻辑
- 思考：这是渲染一致性，对所有内容成立
- 可测试性：是 - 属性

6.3 WHEN 用户切换到预览标签 THEN 文章管理系统 SHALL 显示完整的文章预览
- 思考：这是UI交互
- 可测试性：是 - 示例

### 属性反思

审查所有可测试属性，消除冗余：

**潜在冗余**:
- 属性2.5和2.6都是关于内容保存和加载的往返属性，可以合并为一个
- 属性4.2和4.3都是关于发布状态显示，但它们测试不同的状态，应该保留
- 属性5.3和5.4都是关于API响应包含发布状态，但5.3是发布端点，5.4是查询端点，应该保留

**合并决策**:
- 合并2.5和2.6为单一的"内容往返一致性"属性

### 正确性属性列表

**属性 1: 编辑器内容加载完整性**
*对于任何*文章，当打开编辑模态框时，编辑器中加载的内容应该与数据库中存储的内容完全一致
**验证需求: 1.4**

**属性 2: 内容往返一致性**
*对于任何*富文本内容，保存后重新加载应该得到等价的HTML内容（格式和图片引用保持不变）
**验证需求: 2.5, 2.6**

**属性 3: 智能排版API调用**
*对于任何*文章内容，点击智能排版按钮应该触发对AI服务的调用
**验证需求: 3.2**

**属性 4: 图片位置规则**
*对于任何*包含图片的文章，智能排版后图片应该位于第一段文字之后
**验证需求: 3.4**

**属性 5: 排版失败内容不变**
*对于任何*文章，如果智能排版失败，编辑器中的内容应该保持与排版前完全相同
**验证需求: 3.7**

**属性 6: 未发布文章显示规则**
*对于任何*is_published为false的文章，列表中应该显示"草稿"标签
**验证需求: 4.2**

**属性 7: 已发布文章显示规则**
*对于任何*is_published为true的文章，列表中应该显示"已发布"标签和published_at时间
**验证需求: 4.3**

**属性 8: 新文章默认状态**
*对于任何*新创建的文章，is_published字段应该默认为false
**验证需求: 4.4**

**属性 9: 状态更新时间记录**
*对于任何*发布状态更新操作，如果is_published变为true，published_at字段应该被设置为当前时间
**验证需求: 4.5**

**属性 10: 无效ID拒绝**
*对于任何*不存在的文章ID，发布API应该返回404错误
**验证需求: 5.2**

**属性 11: 发布响应完整性**
*对于任何*成功的发布请求，响应应该包含isPublished和publishedAt字段
**验证需求: 5.3**

**属性 12: 查询响应包含发布状态**
*对于任何*文章查询请求（GET /articles或GET /articles/:id），响应应该包含isPublished字段
**验证需求: 5.4**

**属性 13: API错误处理**
*对于任何*导致错误的API请求，响应应该包含适当的HTTP状态码（4xx或5xx）和错误消息
**验证需求: 5.6**

**属性 14: 预览渲染一致性**
*对于任何*文章内容，预览模式的渲染结果应该与查看模式的渲染结果一致
**验证需求: 6.2**

## 错误处理

### 前端错误处理

1. **网络错误**
   - 场景：API请求失败
   - 处理：显示用户友好的错误消息，保留用户编辑的内容
   - 用户操作：允许重试

2. **智能排版超时**
   - 场景：AI服务响应时间过长
   - 处理：设置30秒超时，超时后显示错误消息
   - 用户操作：保持原始内容，允许手动编辑

3. **图片上传失败**
   - 场景：图片文件过大或格式不支持
   - 处理：显示具体错误原因（文件大小限制、支持的格式）
   - 用户操作：允许重新选择图片

4. **内容验证失败**
   - 场景：标题或内容为空
   - 处理：在保存前验证，显示验证错误
   - 用户操作：修正后重新保存

### 后端错误处理

1. **数据库错误**
   - 场景：数据库连接失败或查询错误
   - 处理：记录详细错误日志，返回500错误
   - 响应：`{ error: "数据库操作失败", code: "DB_ERROR" }`

2. **AI服务错误**
   - 场景：AI服务不可用或返回错误
   - 处理：记录错误，返回503错误
   - 响应：`{ error: "智能排版服务暂时不可用", code: "AI_SERVICE_ERROR" }`
   - 降级策略：返回原始内容

3. **资源不存在**
   - 场景：请求的文章ID不存在
   - 处理：返回404错误
   - 响应：`{ error: "文章不存在", code: "NOT_FOUND" }`

4. **并发冲突**
   - 场景：多个用户同时编辑同一文章
   - 处理：使用updated_at字段进行乐观锁检查
   - 响应：`{ error: "文章已被其他用户修改", code: "CONFLICT" }`

## 测试策略

### 单元测试

**前端组件测试**:
- ArticleEditorModal组件渲染测试
- 富文本编辑器工具栏功能测试
- 智能排版按钮点击事件测试
- 发布状态标签显示测试
- 表单验证逻辑测试

**后端服务测试**:
- ArticleService.updateArticle() 方法测试
- ArticleService.publishArticle() 方法测试
- ArticleService.smartFormat() 方法测试
- AIService.formatArticle() 方法测试（使用mock）
- 数据库操作测试（使用测试数据库）

**API端点测试**:
- PUT /articles/:id 端点测试
- PUT /articles/:id/publish 端点测试
- POST /articles/:id/smart-format 端点测试
- 错误情况测试（无效ID、缺失字段等）

### 属性测试

使用fast-check库进行属性测试，每个测试运行至少100次迭代。

**属性测试配置**:
```typescript
import fc from 'fast-check';

// 配置
const testConfig = { numRuns: 100 };
```

**测试标记格式**:
每个属性测试必须包含注释：
```typescript
// Feature: article-editor-enhancement, Property 2: 内容往返一致性
```

**关键属性测试**:

1. **属性2: 内容往返一致性**
   - 生成器：随机HTML内容（包含格式和图片）
   - 测试：保存→读取→比较
   - 验证：内容等价性

2. **属性4: 图片位置规则**
   - 生成器：包含图片的文章内容
   - 测试：调用智能排版
   - 验证：图片在第一段后

3. **属性6-7: 发布状态显示**
   - 生成器：不同发布状态的文章
   - 测试：渲染列表
   - 验证：正确的标签显示

4. **属性9: 状态更新时间记录**
   - 生成器：随机文章
   - 测试：更新发布状态
   - 验证：published_at被正确设置

5. **属性12: 查询响应包含发布状态**
   - 生成器：随机文章ID
   - 测试：调用GET API
   - 验证：响应包含isPublished字段

### 集成测试

1. **端到端编辑流程**
   - 打开编辑器 → 修改内容 → 保存 → 验证更新

2. **智能排版流程**
   - 加载文章 → 点击智能排版 → 等待处理 → 验证结果

3. **发布流程**
   - 创建文章 → 发布 → 验证状态 → 查询验证

4. **并发编辑测试**
   - 模拟多用户同时编辑
   - 验证冲突检测和处理

### 测试覆盖率目标

- 单元测试：代码覆盖率 > 80%
- 属性测试：覆盖所有14个正确性属性
- 集成测试：覆盖所有主要用户流程
- API测试：覆盖所有端点和错误情况

## 实现注意事项

### 富文本编辑器配置

```typescript
const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    [{ 'font': [] }],
    [{ 'size': ['small', false, 'large', 'huge'] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'align': [] }],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    ['link', 'image'],
    ['clean']
  ]
};
```

### 智能排版Prompt设计

```typescript
const formatPrompt = `你是一个专业的新闻编辑。请将以下文章内容按照通用新闻稿格式重新排版。

要求：
1. 保持原文的核心信息和观点
2. 优化段落结构，使其更符合新闻稿标准
3. 第一段应该是导语，概括全文要点
4. ${hasImage ? '在第一段之后插入标记 [IMAGE_PLACEHOLDER]' : ''}
5. 段落之间要有清晰的逻辑关系
6. 保持专业、客观的语言风格

原文内容：
${content}

请直接输出排版后的文章内容：`;
```

### 数据库迁移脚本

```typescript
// server/src/db/migrations/add_publication_status.sql
ALTER TABLE articles ADD COLUMN is_published BOOLEAN DEFAULT false;
ALTER TABLE articles ADD COLUMN published_at TIMESTAMP;

CREATE INDEX idx_articles_is_published ON articles(is_published);
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
```

### 性能优化

1. **编辑器性能**
   - 使用React.memo优化组件渲染
   - 防抖处理自动保存功能

2. **API性能**
   - 智能排版使用异步处理
   - 添加请求缓存（相同内容不重复处理）

3. **数据库性能**
   - 为发布状态字段添加索引
   - 使用连接池管理数据库连接

### 安全考虑

1. **XSS防护**
   - 使用DOMPurify清理HTML内容
   - 限制允许的HTML标签和属性

2. **文件上传安全**
   - 验证图片文件类型和大小
   - 使用安全的文件名生成策略

3. **API安全**
   - 验证用户权限（如果有认证系统）
   - 防止SQL注入（使用参数化查询）
   - 限制请求频率（防止滥用AI服务）
