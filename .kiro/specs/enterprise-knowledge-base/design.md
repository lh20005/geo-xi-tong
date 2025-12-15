# 企业知识库 - 设计文档

## 概述

企业知识库模块是一个文档管理和AI增强系统，允许企业用户上传、组织和管理文本知识资料。该模块的核心价值在于将企业的专业知识与AI文章生成功能深度集成，使生成的内容更加准确、专业，符合企业的知识体系和品牌调性。

### 设计目标

1. **简单易用**: 提供直观的界面，让用户能够快速创建知识库和上传文档
2. **高效存储**: 采用数据库存储文本内容，确保快速检索和高可用性
3. **AI集成**: 无缝集成到现有的文章生成流程，增强AI输出质量
4. **可扩展性**: 支持多种文件格式，为未来功能扩展预留空间
5. **性能优化**: 处理大量文档时保持良好的响应速度

## 架构设计

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        前端层 (React)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 知识库列表页  │  │ 知识库详情页  │  │ 文章生成页    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/REST API
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      后端层 (Express)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 知识库路由    │  │ 文档解析服务  │  │ AI服务增强    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    数据层 (PostgreSQL)                        │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │ knowledge_bases│ │ knowledge_docs│                        │
│  └──────────────┘  └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈选择

**前端**:
- React 18 + TypeScript: 类型安全的UI开发
- Ant Design 5: 企业级UI组件库
- Axios: HTTP客户端

**后端**:
- Node.js + Express: 轻量级Web框架
- Multer: 文件上传中间件
- pdf-parse: PDF文本提取
- mammoth: Word文档解析
- Zod: 数据验证

**数据库**:
- PostgreSQL: 关系型数据库，支持全文搜索

## 组件与接口

### 前端组件

#### 1. KnowledgeBasePage (知识库列表页)

**职责**: 展示所有知识库，提供创建、编辑、删除功能

**状态管理**:
```typescript
interface KnowledgeBase {
  id: number;
  name: string;
  description: string;
  document_count: number;
  created_at: string;
  updated_at: string;
}

const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
const [loading, setLoading] = useState(false);
const [createModalVisible, setCreateModalVisible] = useState(false);
```

**主要功能**:
- 加载知识库列表
- 创建新知识库
- 编辑知识库名称和描述
- 删除知识库（带确认）
- 导航到知识库详情页

#### 2. KnowledgeBaseDetailPage (知识库详情页)

**职责**: 展示单个知识库的所有文档，提供上传、查看、删除功能

**状态管理**:
```typescript
interface KnowledgeDocument {
  id: number;
  knowledge_base_id: number;
  filename: string;
  file_type: string;
  file_size: number;
  content: string;
  content_preview: string;
  created_at: string;
}

const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
const [selectedDoc, setSelectedDoc] = useState<KnowledgeDocument | null>(null);
const [viewModalVisible, setViewModalVisible] = useState(false);
```

**主要功能**:
- 上传文档（支持多文件）
- 查看文档列表
- 预览文档内容
- 删除文档
- 搜索文档

#### 3. ArticlePage 增强 (文章生成页)

**新增功能**: 添加知识库选择器

**状态管理**:
```typescript
const [selectedKnowledgeBases, setSelectedKnowledgeBases] = useState<number[]>([]);
const [availableKnowledgeBases, setAvailableKnowledgeBases] = useState<KnowledgeBase[]>([]);
```

**UI变更**:
- 在文章要求输入框上方添加"选择知识库"多选框
- 显示已选知识库的文档数量
- 提示用户知识库将如何影响文章生成

### 后端API接口

#### 知识库管理接口

**1. 获取所有知识库**
```
GET /api/knowledge-bases
Response: {
  knowledgeBases: KnowledgeBase[]
}
```

**2. 创建知识库**
```
POST /api/knowledge-bases
Body: {
  name: string,
  description?: string
}
Response: {
  id: number,
  name: string,
  description: string,
  created_at: string
}
```

**3. 获取知识库详情**
```
GET /api/knowledge-bases/:id
Response: {
  id: number,
  name: string,
  description: string,
  document_count: number,
  documents: KnowledgeDocument[]
}
```

**4. 更新知识库**
```
PATCH /api/knowledge-bases/:id
Body: {
  name?: string,
  description?: string
}
Response: {
  id: number,
  name: string,
  description: string,
  updated_at: string
}
```

**5. 删除知识库**
```
DELETE /api/knowledge-bases/:id
Response: {
  success: boolean,
  deletedDocuments: number
}
```

#### 文档管理接口

**6. 上传文档**
```
POST /api/knowledge-bases/:id/documents
Content-Type: multipart/form-data
Body: {
  files: File[]
}
Response: {
  uploadedCount: number,
  documents: KnowledgeDocument[]
}
```

**7. 获取文档详情**
```
GET /api/knowledge-bases/documents/:id
Response: KnowledgeDocument
```

**8. 删除文档**
```
DELETE /api/knowledge-bases/documents/:id
Response: {
  success: boolean
}
```

**9. 搜索文档**
```
GET /api/knowledge-bases/:id/documents/search?q=keyword
Response: {
  documents: KnowledgeDocument[]
}
```

#### AI集成接口

**10. 增强的文章生成接口**
```
POST /api/articles/generate
Body: {
  keyword: string,
  distillationId: number,
  requirements: string,
  topicIds?: number[],
  knowledgeBaseIds?: number[]  // 新增
}
Response: {
  success: boolean,
  articleId: number,
  content: string
}
```

### 后端服务

#### 1. DocumentParserService (文档解析服务)

**职责**: 从不同格式的文件中提取文本内容

```typescript
class DocumentParserService {
  async parseFile(file: Express.Multer.File): Promise<string> {
    const extension = path.extname(file.originalname).toLowerCase();
    
    switch (extension) {
      case '.txt':
        return this.parseTxt(file);
      case '.md':
        return this.parseMarkdown(file);
      case '.pdf':
        return this.parsePdf(file);
      case '.doc':
      case '.docx':
        return this.parseWord(file);
      default:
        throw new Error(`不支持的文件格式: ${extension}`);
    }
  }
  
  private async parseTxt(file: Express.Multer.File): Promise<string>;
  private async parseMarkdown(file: Express.Multer.File): Promise<string>;
  private async parsePdf(file: Express.Multer.File): Promise<string>;
  private async parseWord(file: Express.Multer.File): Promise<string>;
}
```

#### 2. KnowledgeBaseService (知识库服务)

**职责**: 为AI提供知识库上下文

```typescript
class KnowledgeBaseService {
  async getKnowledgeContext(knowledgeBaseIds: number[]): Promise<string> {
    // 从数据库获取所有相关文档
    const documents = await this.getDocumentsByKnowledgeBaseIds(knowledgeBaseIds);
    
    // 组织成AI可理解的格式
    return this.formatForAI(documents);
  }
  
  private formatForAI(documents: KnowledgeDocument[]): string {
    // 格式化为: "企业知识库参考资料:\n\n[文档1]\n内容...\n\n[文档2]\n内容..."
  }
}
```

#### 3. AIService 增强

**修改**: 在生成文章时注入知识库上下文

```typescript
class AIService {
  async generateArticle(
    keyword: string,
    topics: string[],
    requirements: string,
    knowledgeContext?: string  // 新增参数
  ): Promise<string> {
    const topicsList = topics.map((t, i) => `${i + 1}. ${t}`).join('\n');
    
    let prompt = `你是一个专业的内容创作专家，擅长撰写高质量的SEO优化文章。

核心关键词：${keyword}

相关话题：
${topicsList}`;

    // 如果有知识库上下文，添加到prompt中
    if (knowledgeContext) {
      prompt += `\n\n企业知识库参考资料：
${knowledgeContext}

请基于以上企业知识库的内容，确保文章的专业性和准确性。`;
    }

    prompt += `\n\n文章要求：
${requirements}

请撰写一篇专业、高质量的文章...`;

    return await this.callAI(prompt);
  }
}
```

## 数据模型

### 数据库表设计

#### knowledge_bases (知识库表)

```sql
CREATE TABLE knowledge_bases (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_knowledge_bases_created_at ON knowledge_bases(created_at DESC);
```

**字段说明**:
- `id`: 主键
- `name`: 知识库名称
- `description`: 知识库描述
- `created_at`: 创建时间
- `updated_at`: 更新时间

#### knowledge_documents (知识文档表)

```sql
CREATE TABLE knowledge_documents (
  id SERIAL PRIMARY KEY,
  knowledge_base_id INTEGER NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  file_size INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_knowledge_documents_kb_id ON knowledge_documents(knowledge_base_id);
CREATE INDEX idx_knowledge_documents_created_at ON knowledge_documents(created_at DESC);
CREATE INDEX idx_knowledge_documents_content ON knowledge_documents USING gin(to_tsvector('english', content));
```

**字段说明**:
- `id`: 主键
- `knowledge_base_id`: 所属知识库ID（外键）
- `filename`: 原始文件名
- `file_type`: 文件类型（.txt, .md, .pdf, .docx等）
- `file_size`: 文件大小（字节）
- `content`: 提取的文本内容
- `created_at`: 上传时间

**索引说明**:
- `idx_knowledge_documents_kb_id`: 加速按知识库查询
- `idx_knowledge_documents_created_at`: 加速按时间排序
- `idx_knowledge_documents_content`: 全文搜索索引

### 数据关系

```
knowledge_bases (1) ──< (N) knowledge_documents
```

- 一个知识库可以包含多个文档
- 删除知识库时级联删除所有文档

## 正确性属性

*属性是一个特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的正式声明。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### 属性 1: 知识库创建后可检索

*对于任何*有效的知识库名称，当用户创建知识库后，该知识库应该出现在知识库列表中，且名称与创建时输入的名称一致。

**验证**: 需求 1.2, 1.3

### 属性 2: 文档上传后内容可访问

*对于任何*支持格式的文本文件，当文件上传成功后，系统应该能够从数据库中检索到该文档的文本内容，且内容与原文件一致。

**验证**: 需求 2.2, 2.4

### 属性 3: 文件格式验证的一致性

*对于任何*上传的文件，如果文件格式不在支持列表中（.txt, .md, .pdf, .doc, .docx），系统应该拒绝上传并返回错误消息。

**验证**: 需求 2.1, 5.5

### 属性 4: 文件大小限制的强制执行

*对于任何*上传的文件，如果文件大小超过10MB，系统应该拒绝上传并提示用户文件过大。

**验证**: 需求 2.3

### 属性 5: 知识库删除的级联完整性

*对于任何*知识库，当用户删除该知识库时，所有属于该知识库的文档记录也应该从数据库中删除。

**验证**: 需求 1.5, 6.4

### 属性 6: 文档搜索的准确性

*对于任何*搜索关键词，系统返回的文档列表中的每个文档，其文件名或内容都应该包含该关键词。

**验证**: 需求 3.5

### 属性 7: AI上下文注入的正确性

*对于任何*选定的知识库集合，当生成文章时，AI服务接收的prompt应该包含这些知识库中所有文档的内容。

**验证**: 需求 4.2, 4.3

### 属性 8: 事务一致性

*对于任何*文档上传操作，如果文本提取失败或数据库插入失败，系统应该回滚整个操作，不留下部分状态。

**验证**: 需求 6.2, 6.3

### 属性 9: 内容预览的截断正确性

*对于任何*文档内容，如果内容长度超过200个字符，列表视图中显示的预览应该是前200个字符加上省略号。

**验证**: 需求 8.5

### 属性 10: 支持格式的完整性

*对于任何*支持的文件格式（.txt, .md, .pdf, .doc, .docx），系统应该能够成功提取文本内容而不抛出错误。

**验证**: 需求 5.1, 5.2, 5.3, 5.4

## 错误处理

### 前端错误处理

1. **网络错误**: 显示友好的错误消息，提示用户检查网络连接
2. **文件格式错误**: 在上传前验证，显示支持的格式列表
3. **文件大小错误**: 在上传前验证，提示最大文件大小
4. **API错误**: 解析后端返回的错误消息，显示给用户

### 后端错误处理

1. **文件解析错误**: 捕获解析异常，返回具体的错误信息
2. **数据库错误**: 使用事务确保数据一致性，回滚失败的操作
3. **验证错误**: 使用Zod验证输入，返回详细的验证错误
4. **AI服务错误**: 捕获AI调用失败，提供降级方案

### 错误响应格式

```typescript
interface ErrorResponse {
  error: string;           // 错误消息
  details?: string;        // 详细信息
  code?: string;           // 错误代码
}
```

## 测试策略

### 单元测试

**DocumentParserService测试**:
- 测试.txt文件解析
- 测试.md文件解析
- 测试.pdf文件解析
- 测试.docx文件解析
- 测试不支持格式的错误处理

**KnowledgeBaseService测试**:
- 测试知识上下文格式化
- 测试多知识库合并
- 测试空知识库处理

**API路由测试**:
- 测试CRUD操作
- 测试输入验证
- 测试错误响应

### 属性测试

使用`fast-check`库进行属性测试，每个测试运行至少100次迭代。

**测试配置**:
```typescript
import fc from 'fast-check';

// 配置
const testConfig = {
  numRuns: 100,  // 最少100次迭代
  verbose: true
};
```

**属性测试用例**:

1. **属性 1测试**: 知识库创建后可检索
```typescript
// Feature: enterprise-knowledge-base, Property 1: 知识库创建后可检索
fc.assert(
  fc.property(
    fc.string({ minLength: 1, maxLength: 255 }),
    async (name) => {
      const created = await createKnowledgeBase(name);
      const retrieved = await getKnowledgeBase(created.id);
      return retrieved.name === name;
    }
  ),
  testConfig
);
```

2. **属性 3测试**: 文件格式验证的一致性
```typescript
// Feature: enterprise-knowledge-base, Property 3: 文件格式验证的一致性
fc.assert(
  fc.property(
    fc.constantFrom('.exe', '.zip', '.jpg', '.mp3', '.avi'),
    async (extension) => {
      const file = createMockFile('test' + extension);
      const result = await uploadDocument(file);
      return result.error !== undefined;
    }
  ),
  testConfig
);
```

3. **属性 4测试**: 文件大小限制的强制执行
```typescript
// Feature: enterprise-knowledge-base, Property 4: 文件大小限制的强制执行
fc.assert(
  fc.property(
    fc.integer({ min: 10 * 1024 * 1024 + 1, max: 50 * 1024 * 1024 }),
    async (fileSize) => {
      const file = createMockFile('test.txt', fileSize);
      const result = await uploadDocument(file);
      return result.error !== undefined && result.error.includes('大小');
    }
  ),
  testConfig
);
```

4. **属性 5测试**: 知识库删除的级联完整性
```typescript
// Feature: enterprise-knowledge-base, Property 5: 知识库删除的级联完整性
fc.assert(
  fc.property(
    fc.array(fc.string(), { minLength: 1, maxLength: 10 }),
    async (docNames) => {
      const kb = await createKnowledgeBase('test');
      for (const name of docNames) {
        await uploadDocument(kb.id, createMockFile(name + '.txt'));
      }
      await deleteKnowledgeBase(kb.id);
      const docs = await getDocuments(kb.id);
      return docs.length === 0;
    }
  ),
  testConfig
);
```

5. **属性 6测试**: 文档搜索的准确性
```typescript
// Feature: enterprise-knowledge-base, Property 6: 文档搜索的准确性
fc.assert(
  fc.property(
    fc.string({ minLength: 3 }),
    async (keyword) => {
      const results = await searchDocuments(keyword);
      return results.every(doc => 
        doc.filename.includes(keyword) || doc.content.includes(keyword)
      );
    }
  ),
  testConfig
);
```

### 集成测试

- 测试完整的文档上传流程
- 测试知识库与AI生成的集成
- 测试并发上传场景
- 测试大量文档的性能

### 端到端测试

- 测试用户创建知识库并上传文档的完整流程
- 测试使用知识库生成文章的完整流程
- 测试知识库管理的各种操作

## 性能优化

### 数据库优化

1. **索引策略**:
   - 在`knowledge_base_id`上创建索引，加速文档查询
   - 在`content`字段上创建全文搜索索引
   - 在`created_at`上创建索引，加速时间排序

2. **查询优化**:
   - 使用`LEFT(content, 200)`在列表视图中只返回内容预览
   - 使用分页限制单次查询的数据量
   - 使用连接查询减少数据库往返次数

### 文件处理优化

1. **异步处理**: 文件解析在后台异步执行，不阻塞响应
2. **流式处理**: 对于大文件，使用流式读取而非一次性加载到内存
3. **缓存策略**: 缓存已解析的文档内容，避免重复解析

### 前端优化

1. **虚拟滚动**: 文档列表使用虚拟滚动，只渲染可见项
2. **懒加载**: 文档内容在需要时才加载
3. **防抖搜索**: 搜索输入使用防抖，减少API调用

## 安全考虑

1. **文件验证**: 严格验证文件类型和大小，防止恶意文件上传
2. **SQL注入防护**: 使用参数化查询，防止SQL注入
3. **XSS防护**: 对用户输入进行转义，防止跨站脚本攻击
4. **访问控制**: 未来可添加用户认证，确保只有授权用户可以访问知识库
5. **内容安全**: 对上传的文档内容进行扫描，防止敏感信息泄露

## 部署考虑

1. **数据库迁移**: 提供迁移脚本，自动创建新表和索引
2. **向后兼容**: 新功能不影响现有的文章生成流程
3. **环境变量**: 文件大小限制等配置通过环境变量管理
4. **监控**: 添加日志记录，监控文件上传和解析的成功率

## 未来扩展

1. **版本控制**: 支持文档的版本管理
2. **协作功能**: 支持多用户协作编辑知识库
3. **智能推荐**: 根据关键词自动推荐相关知识库
4. **知识图谱**: 构建知识之间的关联关系
5. **更多格式**: 支持Excel、PPT等更多文件格式
6. **OCR支持**: 支持从图片中提取文字
7. **向量搜索**: 使用向量数据库实现语义搜索
