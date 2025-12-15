# 设计文档

## 概述

本设计文档描述了文章内容质量改进功能的技术实现方案。该功能主要解决三个核心问题：
1. 清理AI生成内容中的思考过程
2. 移除Markdown格式符号，输出纯文本
3. 增强文章管理界面，支持图片显示和内容编辑

系统将在文章生成服务层添加内容清理逻辑，在AI服务层优化提示词，在前端增加编辑功能和图片显示。

## 架构

### 系统层次

```
┌─────────────────────────────────────────┐
│         前端 (React + Ant Design)        │
│  - ArticleListPage (增强)                │
│  - 图片显示组件                           │
│  - 文章编辑表单                           │
└─────────────────────────────────────────┘
                    ↓ HTTP
┌─────────────────────────────────────────┐
│         后端路由层 (Express)              │
│  - article.ts (新增编辑接口)              │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         服务层                            │
│  - ArticleGenerationService              │
│    └─ 内容清理模块 (新增)                 │
│  - AIService                             │
│    └─ 提示词优化 (修改)                   │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         数据层 (PostgreSQL)               │
│  - articles 表                           │
└─────────────────────────────────────────┘
```

### 数据流

1. **文章生成流程**：
   - AI生成原始内容 → 清理思考过程 → 移除Markdown符号 → 保存到数据库

2. **文章查看流程**：
   - 加载文章数据（包含image_url）→ 前端显示内容和图片

3. **文章编辑流程**：
   - 用户编辑 → 验证输入 → 更新数据库 → 刷新显示

## 组件和接口

### 1. 内容清理模块 (ContentCleaner)

新增一个独立的内容清理类，负责处理AI生成的原始内容。

```typescript
class ContentCleaner {
  /**
   * 清理AI思考过程
   */
  static removeThinkingProcess(content: string): string;
  
  /**
   * 移除Markdown符号
   */
  static removeMarkdownSymbols(content: string): string;
  
  /**
   * 完整清理流程
   */
  static cleanArticleContent(content: string): string;
  
  /**
   * 验证清理后的内容
   */
  static validateCleanedContent(content: string): boolean;
}
```

### 2. ArticleGenerationService 修改

在 `parseArticleResponse` 方法后添加内容清理步骤：

```typescript
parseArticleResponse(response: string): { title: string; content: string } {
  // 现有的解析逻辑...
  
  // 新增：清理内容
  const cleanedContent = ContentCleaner.cleanArticleContent(content);
  
  return { title, content: cleanedContent };
}
```

### 3. AIService 提示词优化

修改 `generateArticle` 方法中的提示词构建逻辑：

```typescript
async generateArticle(...): Promise<string> {
  let prompt = `你是一个专业的内容创作专家。

【重要输出要求】
1. 直接输出文章内容，不要包含任何思考过程
2. 使用纯文本格式，不要使用Markdown符号（如#、*、-等）
3. 不要使用"让我思考"、"首先分析"等思考性语句
4. 按照"标题：[标题内容]"格式开始，然后是正文

核心关键词：${keyword}
...`;
}
```

### 4. 文章路由新增编辑接口

```typescript
// PUT /api/articles/:id
articleRouter.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;
  
  // 验证
  // 更新数据库
  // 返回更新后的文章
});
```

### 5. 前端组件增强

**ArticleListPage 修改**：

```typescript
// 新增状态
const [editMode, setEditMode] = useState(false);
const [editForm, setEditForm] = useState({ title: '', content: '' });

// 新增编辑处理函数
const handleEdit = () => { ... };
const handleSave = async () => { ... };
const handleCancel = () => { ... };

// Modal中新增图片显示
{viewModal?.imageUrl && (
  <img src={viewModal.imageUrl} alt="文章配图" />
)}

// Modal中新增编辑表单
{editMode ? (
  <Form>
    <Form.Item label="标题">
      <Input value={editForm.title} onChange={...} />
    </Form.Item>
    <Form.Item label="内容">
      <TextArea value={editForm.content} onChange={...} />
    </Form.Item>
  </Form>
) : (
  <div>{viewModal.content}</div>
)}
```

## 数据模型

### Articles 表（无需修改）

现有的 `articles` 表已包含所需字段：
- `id`: 主键
- `title`: 文章标题
- `content`: 文章内容
- `image_url`: 图片URL
- `updated_at`: 更新时间

## 正确性属性

*属性是一个特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的正式声明。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### 属性 1：思考过程关键词完全移除

*对于任何*包含思考过程关键词（"让我思考"、"首先"、"分析"等）的文本，清理后的内容不应包含这些关键词
**验证需求：1.1, 1.2**

### 属性 2：XML思考标签完全移除

*对于任何*包含XML思考标签（如`<thinking>`、`<analysis>`）的文本，清理后的内容不应包含这些标签及其内容
**验证需求：1.1, 1.3**

### 属性 3：清理后内容非空

*对于任何*包含有效文本内容的输入，清理后的内容长度应大于0
**验证需求：1.4**

### 属性 4：标题标记符号移除

*对于任何*包含#标题标记的文本，清理后的内容不应包含#符号
**验证需求：2.1**

### 属性 5：加粗斜体标记移除但保留文本

*对于任何*包含加粗或斜体标记（*、**、_、__）的文本，清理后应移除标记但保留被标记的文本内容
**验证需求：2.2**

### 属性 6：列表标记转换为纯文本

*对于任何*包含列表标记（-、*、数字加点）的文本，清理后应转换为纯文本格式
**验证需求：2.3**

### 属性 7：代码块标记移除但保留代码

*对于任何*包含代码块标记（```）的文本，清理后应移除标记但保留代码内容
**验证需求：2.4**

### 属性 8：Markdown链接转换为纯文本

*对于任何*包含Markdown链接格式[text](url)的文本，清理后应转换为"text (url)"格式
**验证需求：2.5**

### 属性 9：段落结构保持不变

*对于任何*有段落结构的文本，清理后应保持原有的段落分隔和换行
**验证需求：2.6**

### 属性 10：有效编辑更新时间戳

*对于任何*有效的文章编辑操作（标题和内容非空），保存后updated_at时间戳应该被更新
**验证需求：4.4, 4.5**

### 属性 11：空输入阻止保存

*对于任何*标题为空或内容为空的编辑操作，系统应阻止保存
**验证需求：4.7**

### 属性 12：提示词包含清理指令

*对于任何*生成的AI提示词，应包含"不要包含思考过程"和"使用纯文本格式"的明确指令
**验证需求：5.1, 5.2, 5.3, 5.4**

## 错误处理

### 1. 内容清理错误

- **场景**：清理后内容为空或过短
- **处理**：记录警告日志，保留原始内容，标记需要人工审核

### 2. 图片加载失败

- **场景**：image_url无效或图片不存在
- **处理**：前端显示占位图，不阻塞文章显示

### 3. 编辑验证失败

- **场景**：标题或内容为空
- **处理**：前端显示验证错误，阻止提交

### 4. 数据库更新失败

- **场景**：网络错误或数据库异常
- **处理**：返回500错误，前端显示错误提示，保留用户编辑内容

## 测试策略

### 单元测试

1. **ContentCleaner 测试**
   - 测试各种思考过程模式的识别和移除
   - 测试各种Markdown符号的移除
   - 测试边界情况（空字符串、纯符号等）

2. **API路由测试**
   - 测试编辑接口的验证逻辑
   - 测试成功和失败场景

### 属性测试

使用 `fast-check` 库进行属性测试：

1. **属性 1-3 测试**：生成随机文本，验证清理函数的正确性
2. **属性 4 测试**：生成随机文章数据，验证image_url的保存
3. **属性 5 测试**：生成随机编辑数据，验证更新逻辑

每个属性测试应运行至少100次迭代。

### 集成测试

1. 端到端文章生成流程测试
2. 文章编辑和保存流程测试
3. 图片显示测试

### 手动测试

1. 使用不同AI提供商生成文章，验证内容质量
2. 测试各种图片URL场景
3. 测试编辑功能的用户体验
