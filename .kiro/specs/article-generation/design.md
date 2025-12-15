# 设计文档

## 概述

文章生成模块是一个智能内容创作系统，它整合了关键词蒸馏、企业图库、企业知识库和文章设置等多个模块的数据，通过AI大模型自动批量生成高质量文章。该模块采用任务驱动的异步生成模式，支持任务管理、进度跟踪和结果展示。

核心功能包括：
- 多数据源选择和配置
- 异步任务执行和状态管理
- 一对一关键词-文章生成逻辑
- 文章持久化和分页展示
- 完整的错误处理和恢复机制

## 架构

### 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端层 (React)                            │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Sidebar     │  │ ArticleGeneration│  │  ArticleList     │  │
│  │  组件        │  │  Page组件        │  │  Page组件        │  │
│  │              │  │                  │  │                  │  │
│  │ +生成文章    │  │ - 任务配置弹窗   │  │ - 文章列表       │  │
│  │  菜单项      │  │ - 任务历史列表   │  │ - 分页展示       │  │
│  └──────────────┘  └──────────────────┘  └──────────────────┘  │
│           │                  │                      │            │
│           └──────────────────┼──────────────────────┘            │
│                              │ HTTP/REST API                     │
└──────────────────────────────┼───────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────┐
│                              │          后端层 (Express)         │
│                      ┌───────▼────────┐                          │
│                      │  Router层      │                          │
│                      │ - articleGen   │                          │
│                      │ - articles     │                          │
│                      └───────┬────────┘                          │
│                              │                                   │
│                      ┌───────▼────────┐                          │
│                      │  Service层     │                          │
│                      │ ArticleGen     │                          │
│                      │ Service        │                          │
│                      └───────┬────────┘                          │
│                              │                                   │
│              ┌───────────────┼───────────────┐                   │
│              │               │               │                   │
│      ┌───────▼────────┐ ┌───▼────────┐ ┌───▼────────┐          │
│      │  AIService     │ │  Database  │ │  Task      │          │
│      │  (DeepSeek/    │ │  Access    │ │  Queue     │          │
│      │   Gemini/      │ │  Layer     │ │  Manager   │          │
│      │   Ollama)      │ │            │ │            │          │
│      └────────────────┘ └────────────┘ └────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### 技术栈

- **前端**: React 18, TypeScript, Ant Design 5, React Router 6
- **后端**: Node.js, Express, TypeScript
- **数据库**: PostgreSQL
- **验证**: Zod
- **AI服务**: DeepSeek / Gemini / Ollama (已有AIService)
- **任务管理**: 内存队列 + 数据库持久化

## 组件和接口

### 前端组件

#### 1. ArticleGenerationPage 组件

主页面组件，负责任务管理和配置。

**Props**: 无

**State**:
```typescript
interface ArticleGenerationPageState {
  tasks: GenerationTask[];
  loading: boolean;
  modalVisible: boolean;
  currentPage: number;
  pageSize: number;
  total: number;
}
```

**主要方法**:
- `fetchTasks(page: number, pageSize: number)`: 获取任务列表
- `handleCreateTask()`: 打开任务配置弹窗
- `handleSubmitTask(config: TaskConfig)`: 提交任务配置
- `refreshTaskStatus()`: 定时刷新任务状态

#### 2. TaskConfigModal 组件

任务配置弹窗组件。

**Props**:
```typescript
interface TaskConfigModalProps {
  visible: boolean;
  onSubmit: (config: TaskConfig) => Promise<void>;
  onCancel: () => void;
}
```

**State**:
```typescript
interface TaskConfigModalState {
  distillations: DistillationHistory[];
  albums: Album[];
  knowledgeBases: KnowledgeBase[];
  articleSettings: ArticleSetting[];
  selectedDistillation: number | null;
  selectedAlbum: number | null;
  selectedKnowledgeBase: number | null;
  selectedArticleSetting: number | null;
  articleCount: number;
  loading: boolean;
}
```

**功能**:
- 加载所有数据源选项
- 表单验证
- 提交任务配置

#### 3. TaskHistoryList 组件

任务历史列表组件。

**Props**:
```typescript
interface TaskHistoryListProps {
  tasks: GenerationTask[];
  loading: boolean;
  onRefresh: () => void;
}
```

**功能**:
- 展示任务列表
- 显示任务状态（执行中/已完成/失败）
- 显示进度和结果统计

#### 4. ArticleListPage 组件更新

在现有文章列表页面中展示生成的文章。

**新增功能**:
- 支持按生成任务筛选
- 显示关联的图片
- 分页展示（每页10条）

### 后端接口

#### API路由: `/api/article-generation`

##### 1. 创建生成任务

```
POST /api/article-generation/tasks
```

**请求体**:
```json
{
  "distillationId": 1,
  "albumId": 2,
  "knowledgeBaseId": 3,
  "articleSettingId": 4,
  "articleCount": 5
}
```

**响应**:
```json
{
  "taskId": 1,
  "status": "pending",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

##### 2. 获取任务列表

```
GET /api/article-generation/tasks?page=1&pageSize=10
```

**响应**:
```json
{
  "tasks": [
    {
      "id": 1,
      "distillationId": 1,
      "albumId": 2,
      "knowledgeBaseId": 3,
      "articleSettingId": 4,
      "requestedCount": 5,
      "generatedCount": 3,
      "status": "running",
      "progress": 60,
      "errorMessage": null,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:05:00Z"
    }
  ],
  "total": 25,
  "page": 1,
  "pageSize": 10
}
```

##### 3. 获取任务详情

```
GET /api/article-generation/tasks/:id
```

**响应**:
```json
{
  "id": 1,
  "distillationId": 1,
  "albumId": 2,
  "knowledgeBaseId": 3,
  "articleSettingId": 4,
  "requestedCount": 5,
  "generatedCount": 5,
  "status": "completed",
  "progress": 100,
  "errorMessage": null,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:10:00Z",
  "generatedArticles": [
    {
      "id": 101,
      "title": "文章标题",
      "keyword": "关键词",
      "imageUrl": "/uploads/gallery/xxx.png"
    }
  ]
}
```

#### API路由: `/api/articles` (扩展现有接口)

##### 1. 获取文章列表（支持任务筛选）

```
GET /api/articles?page=1&pageSize=10&taskId=1
```

**响应**:
```json
{
  "articles": [
    {
      "id": 101,
      "title": "文章标题",
      "content": "文章内容...",
      "keyword": "关键词",
      "distillationId": 1,
      "taskId": 1,
      "imageUrl": "/uploads/gallery/xxx.png",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 50,
  "page": 1,
  "pageSize": 10
}
```

### 服务层

#### ArticleGenerationService

核心业务逻辑服务。

**主要方法**:

```typescript
class ArticleGenerationService {
  // 创建生成任务
  async createTask(config: TaskConfig): Promise<number>;
  
  // 执行生成任务（异步）
  async executeTask(taskId: number): Promise<void>;
  
  // 生成单篇文章
  private async generateSingleArticle(
    keyword: string,
    distillationResult: string,
    imageUrl: string,
    knowledgeContent: string,
    prompt: string
  ): Promise<{ title: string; content: string }>;
  
  // 从图库随机选择图片
  private async selectRandomImage(albumId: number): Promise<string>;
  
  // 获取知识库内容
  private async getKnowledgeBaseContent(kbId: number): Promise<string>;
  
  // 更新任务进度
  private async updateTaskProgress(
    taskId: number,
    generatedCount: number,
    status: TaskStatus
  ): Promise<void>;
  
  // 保存生成的文章
  private async saveArticle(
    taskId: number,
    distillationId: number,
    keyword: string,
    title: string,
    content: string,
    imageUrl: string
  ): Promise<number>;
}
```

## 数据模型

### 数据库表

#### 1. generation_tasks 表

```sql
CREATE TABLE IF NOT EXISTS generation_tasks (
  id SERIAL PRIMARY KEY,
  distillation_id INTEGER NOT NULL REFERENCES distillations(id) ON DELETE CASCADE,
  album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  knowledge_base_id INTEGER NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  article_setting_id INTEGER NOT NULL REFERENCES article_settings(id) ON DELETE CASCADE,
  requested_count INTEGER NOT NULL CHECK (requested_count > 0),
  generated_count INTEGER DEFAULT 0 CHECK (generated_count >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_generation_tasks_status ON generation_tasks(status);
CREATE INDEX IF NOT EXISTS idx_generation_tasks_created_at ON generation_tasks(created_at DESC);
```

#### 2. articles 表（扩展现有表）

```sql
-- 添加新字段到现有articles表
ALTER TABLE articles ADD COLUMN IF NOT EXISTS task_id INTEGER REFERENCES generation_tasks(id) ON DELETE SET NULL;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS title VARCHAR(500);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_articles_task_id ON articles(task_id);
CREATE INDEX IF NOT EXISTS idx_articles_title ON articles(title);
```

### TypeScript类型定义

```typescript
// 生成任务配置
interface TaskConfig {
  distillationId: number;
  albumId: number;
  knowledgeBaseId: number;
  articleSettingId: number;
  articleCount: number;
}

// 生成任务实体
interface GenerationTask {
  id: number;
  distillationId: number;
  albumId: number;
  knowledgeBaseId: number;
  articleSettingId: number;
  requestedCount: number;
  generatedCount: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

// 文章实体（扩展）
interface Article {
  id: number;
  title: string;
  content: string;
  keyword: string;
  distillationId: number;
  taskId: number | null;
  imageUrl: string | null;
  provider: string;
  createdAt: string;
  updatedAt: string;
}

// 蒸馏历史数据
interface DistillationHistory {
  id: number;
  keyword: string;
  questions: string[];
  provider: string;
  createdAt: string;
}

// 相册数据
interface Album {
  id: number;
  name: string;
  imageCount: number;
  coverImage: string | null;
}

// 知识库数据
interface KnowledgeBase {
  id: number;
  name: string;
  description: string;
  documentCount: number;
}

// 文章设置数据
interface ArticleSetting {
  id: number;
  name: string;
  prompt: string;
}
```

### Zod验证Schema

```typescript
const createTaskSchema = z.object({
  distillationId: z.number().int().positive(),
  albumId: z.number().int().positive(),
  knowledgeBaseId: z.number().int().positive(),
  articleSettingId: z.number().int().positive(),
  articleCount: z.number().int().positive().max(100)
});
```

## 正确性属性

*属性是指在系统的所有有效执行中都应该成立的特征或行为——本质上是关于系统应该做什么的正式声明。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### 属性 1: 数据源选择完整性

*对于任意*数据源类型（蒸馏历史、图库、知识库、文章设置），当下拉列表加载时，应该显示该类型的所有可用记录
**验证: 需求 3.2, 4.2, 5.2, 6.2**

### 属性 2: 选择状态持久化

*对于任意*数据源选择操作，选择后的状态应该被保存，且UI应该显示选中的记录信息
**验证: 需求 3.3, 4.3, 5.3, 6.3**

### 属性 3: 关键词-蒸馏结果一一对应

*对于任意*蒸馏历史数据，每个关键词应该有且仅有一个对应的蒸馏结果集合，且这种对应关系在整个生成过程中保持不变
**验证: 需求 3.4**

### 属性 4: 输入验证正整数

*对于任意*文章数量输入，系统应该拒绝非正整数（负数、零、小数、非数字），并接受正整数
**验证: 需求 7.2**

### 属性 5: 无效输入错误提示

*对于任意*无效的文章数量输入，系统应该显示错误提示并禁用提交按钮
**验证: 需求 7.3**

### 属性 6: 数量超限警告

*对于任意*文章数量输入，当输入值大于蒸馏历史中的关键词数量时，系统应该显示警告提示
**验证: 需求 7.4**

### 属性 7: 表单完整性验证

*对于任意*任务配置表单状态，当且仅当所有必需字段都已填写时，提交按钮应该被启用
**验证: 需求 8.1, 8.2**

### 属性 8: 任务创建持久化

*对于任意*有效的任务配置，提交后应该在数据库中创建一条任务记录，且状态为"pending"或"running"
**验证: 需求 8.3, 8.4**

### 属性 9: 任务列表完整性

*对于任意*任务查询请求，返回的任务列表应该包含所有任务的创建时间、配置信息、状态和生成结果数量
**验证: 需求 9.2**

### 属性 10: 关键词顺序提取

*对于任意*蒸馏历史数据，系统应该按照原始顺序提取关键词-蒸馏结果对
**验证: 需求 10.1**

### 属性 11: 图片随机选择有效性

*对于任意*图库，随机选择的图片应该属于该图库
**验证: 需求 10.2**

### 属性 12: 文章生成上下文完整性

*对于任意*单篇文章生成请求，传递给AI的prompt应该包含关键词、蒸馏结果、图片URL、知识库内容和文章设置提示词
**验证: 需求 10.3, 10.4**

### 属性 13: AI响应解析完整性

*对于任意*AI返回的文章内容，系统应该能够解析出标题和正文内容
**验证: 需求 10.5**

### 属性 14: 生成数量终止条件

*对于任意*生成任务，当生成的文章数量达到请求数量时，系统应该停止生成并标记任务为"completed"
**验证: 需求 10.6**

### 属性 15: 单文章数据隔离

*对于任意*单篇文章生成，应该仅使用一个关键词及其对应的蒸馏结果
**验证: 需求 11.1**

### 属性 16: 多文章数据唯一性

*对于任意*生成任务，每篇文章应该使用不同的关键词-蒸馏结果对
**验证: 需求 11.2**

### 属性 17: 关键词数量限制

*对于任意*生成任务，当关键词数量少于请求的文章数量时，实际生成的文章数量应该等于关键词数量
**验证: 需求 11.3**

### 属性 18: 文章保存完整性

*对于任意*生成的文章，保存到数据库时应该包含标题、内容、关键词、任务ID、图片URL和创建时间
**验证: 需求 12.1, 12.2**

### 属性 19: 任务完成状态更新

*对于任意*生成任务，当所有文章保存完成后，任务状态应该更新为"completed"，且generated_count应该等于实际生成数量
**验证: 需求 12.3**

### 属性 20: 文章列表分页一致性

*对于任意*文章列表查询，每页应该返回10条记录（最后一页除外），且总记录数应该与分页计算一致
**验证: 需求 13.2**

### 属性 21: 文章记录渲染完整性

*对于任意*文章记录，渲染的HTML应该包含标题、创建时间和内容预览
**验证: 需求 13.4**

## 错误处理

### 客户端错误处理

1. **网络错误**: 
   - 使用try-catch捕获API请求失败
   - 显示用户友好的错误消息
   - 提供重试选项

2. **表单验证错误**:
   - 实时验证用户输入
   - 显示字段级错误提示
   - 禁用无效状态下的提交按钮

3. **数据加载失败**:
   - 显示加载失败提示
   - 提供刷新按钮
   - 记录错误日志

4. **任务执行失败**:
   - 显示任务失败状态
   - 展示错误消息
   - 允许重新创建任务

### 服务端错误处理

1. **输入验证**:
   - 使用Zod验证所有输入
   - 返回400状态码和详细错误信息
   - 记录验证失败日志

2. **资源不存在**:
   - 检查所有引用的资源是否存在
   - 返回404状态码
   - 提供清晰的错误消息

3. **AI调用失败**:
   - 捕获AI服务异常
   - 记录错误信息到任务记录
   - 继续处理下一篇文章（部分失败策略）
   - 最终标记任务状态

4. **数据库错误**:
   - 使用事务确保数据一致性
   - 失败时回滚事务
   - 返回500状态码
   - 记录详细错误日志

5. **并发控制**:
   - 防止同一任务被重复执行
   - 使用数据库锁或状态检查
   - 处理竞态条件

### 错误恢复策略

1. **部分失败处理**:
   - AI调用失败时继续处理其他文章
   - 记录失败的关键词
   - 保存已成功生成的文章

2. **任务重试**:
   - 允许用户重新创建失败的任务
   - 提供失败原因说明
   - 建议修正措施

3. **数据完整性**:
   - 使用事务保证原子性
   - 失败时清理部分数据
   - 保持任务状态一致性

### 错误响应格式

```typescript
interface ErrorResponse {
  error: string;
  details?: any;
  code?: string;
  timestamp?: string;
}
```

## 测试策略

### 单元测试

1. **组件测试**:
   - TaskConfigModal: 表单验证、数据加载、提交逻辑
   - TaskHistoryList: 任务状态显示、进度展示
   - ArticleListPage: 分页、筛选、详情显示

2. **服务测试**:
   - ArticleGenerationService: 任务创建、文章生成、状态更新
   - 图片随机选择逻辑
   - 知识库内容获取
   - AI prompt构建

3. **API路由测试**:
   - 任务CRUD操作
   - 文章查询和筛选
   - 错误处理

### 属性测试

使用fast-check进行属性测试，最小迭代次数100次：

1. **数据源加载属性**: 生成随机数据源，验证下拉列表显示完整性
2. **输入验证属性**: 生成随机输入值，验证验证逻辑正确性
3. **关键词对应属性**: 生成随机蒸馏数据，验证一一对应关系
4. **任务创建属性**: 生成随机配置，验证任务创建和持久化
5. **文章生成属性**: 生成随机数据，验证文章生成逻辑
6. **分页属性**: 生成随机数量文章，验证分页逻辑
7. **数据隔离属性**: 验证每篇文章只使用一对关键词-结果
8. **数量限制属性**: 验证关键词数量限制逻辑

### 集成测试

1. **端到端流程**: 测试完整的任务创建-执行-完成流程
2. **数据库集成**: 验证数据持久化和查询
3. **AI服务集成**: 测试AI调用和响应处理
4. **多模块集成**: 验证与蒸馏、图库、知识库、文章设置模块的集成

### 测试配置

- **属性测试库**: fast-check
- **最小迭代次数**: 100次
- **属性测试标记格式**: `// Feature: article-generation, Property {number}: {property_text}`

## 安全考虑

1. **SQL注入防护**: 使用参数化查询
2. **XSS防护**: React自动转义，额外验证用户输入
3. **输入验证**: 严格验证所有配置参数
4. **资源限制**: 限制单次生成文章数量（最大100篇）
5. **权限控制**: 验证用户对引用资源的访问权限
6. **错误信息**: 生产环境不暴露敏感信息

## 性能考虑

1. **异步任务执行**: 
   - 任务创建立即返回
   - 后台异步执行生成逻辑
   - 避免阻塞用户操作

2. **批量操作优化**:
   - 批量插入文章记录
   - 减少数据库往返次数

3. **数据库索引**:
   - 在status、created_at、task_id字段上创建索引
   - 优化查询性能

4. **缓存策略**:
   - 缓存知识库内容
   - 缓存文章设置提示词
   - 减少重复查询

5. **并发控制**:
   - 限制同时执行的任务数量
   - 使用队列管理任务执行
   - 防止资源耗尽

6. **前端优化**:
   - 使用React.memo减少重渲染
   - 虚拟滚动处理大列表
   - 防抖刷新操作

## 部署注意事项

1. **数据库迁移**:
   - 创建generation_tasks表
   - 扩展articles表添加新字段
   - 创建必要的索引

2. **环境变量**:
   - 配置AI服务密钥
   - 配置数据库连接
   - 配置文件上传路径

3. **依赖安装**:
   - 确保所有npm依赖已安装
   - 验证AI服务可用性

4. **任务队列**:
   - 配置任务执行器
   - 设置并发限制
   - 配置错误重试策略

5. **监控和日志**:
   - 记录任务执行日志
   - 监控AI调用成功率
   - 跟踪任务完成时间

## 未来扩展

1. **高级调度**:
   - 支持定时任务
   - 支持任务优先级
   - 支持任务暂停和恢复

2. **模板系统**:
   - 支持文章模板
   - 支持变量替换
   - 支持条件逻辑

3. **质量控制**:
   - AI生成内容审核
   - 关键词密度检查
   - 原创度检测

4. **批量管理**:
   - 批量编辑文章
   - 批量发布
   - 批量删除

5. **统计分析**:
   - 生成效率统计
   - 成功率分析
   - 成本统计

6. **多语言支持**:
   - 支持多语言文章生成
   - 支持翻译功能

7. **协作功能**:
   - 支持多用户协作
   - 支持审批流程
   - 支持评论和反馈
