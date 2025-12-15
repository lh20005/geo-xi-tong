# 设计文档

## 概述

文章设置模块是一个用于管理文章生成提示词模板的功能。该模块提供完整的CRUD操作，允许用户创建、查看、编辑和删除提示词模板。这些模板将在文章创作时被AI大模型使用，以生成符合特定要求的内容。

该模块采用前后端分离架构，前端使用React + TypeScript + Ant Design构建用户界面，后端使用Express + PostgreSQL提供RESTful API服务。

## 架构

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        前端层 (React)                        │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  Sidebar组件     │  │ ArticleSettings  │                │
│  │  (导航菜单)      │  │  Page组件        │                │
│  └──────────────────┘  └──────────────────┘                │
│           │                      │                           │
│           └──────────┬───────────┘                           │
│                      │                                       │
└──────────────────────┼───────────────────────────────────────┘
                       │ HTTP/REST API
┌──────────────────────┼───────────────────────────────────────┐
│                      │          后端层 (Express)             │
│              ┌───────▼────────┐                              │
│              │  Router层      │                              │
│              │ articleSettings│                              │
│              │   Router       │                              │
│              └───────┬────────┘                              │
│                      │                                       │
│              ┌───────▼────────┐                              │
│              │  验证层 (Zod)  │                              │
│              └───────┬────────┘                              │
│                      │                                       │
│              ┌───────▼────────┐                              │
│              │  数据访问层    │                              │
│              │  (PostgreSQL)  │                              │
│              └────────────────┘                              │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈

- **前端**: React 18, TypeScript, Ant Design 5, React Router 6
- **后端**: Node.js, Express, TypeScript
- **数据库**: PostgreSQL
- **验证**: Zod
- **HTTP客户端**: Fetch API

## 组件和接口

### 前端组件

#### 1. ArticleSettingsPage 组件

主页面组件，负责整体布局和状态管理。

**Props**: 无

**State**:
```typescript
interface ArticleSettingsPageState {
  settings: ArticleSetting[];
  loading: boolean;
  currentPage: number;
  pageSize: number;
  total: number;
  modalVisible: boolean;
  modalMode: 'create' | 'edit' | 'view';
  selectedSetting: ArticleSetting | null;
}
```

**主要方法**:
- `fetchSettings(page: number, pageSize: number)`: 获取文章设置列表
- `handleCreate()`: 打开创建对话框
- `handleEdit(setting: ArticleSetting)`: 打开编辑对话框
- `handleView(setting: ArticleSetting)`: 打开查看对话框
- `handleDelete(id: number)`: 删除文章设置
- `handleSubmit(data: ArticleSettingFormData)`: 提交表单数据

#### 2. ArticleSettingModal 组件

对话框组件，用于创建、编辑和查看文章设置。

**Props**:
```typescript
interface ArticleSettingModalProps {
  visible: boolean;
  mode: 'create' | 'edit' | 'view';
  setting: ArticleSetting | null;
  onSubmit: (data: ArticleSettingFormData) => Promise<void>;
  onCancel: () => void;
}
```

**功能**:
- 根据mode显示不同的表单状态（只读/可编辑）
- 表单验证
- 提交数据处理

#### 3. ArticleSettingList 组件

列表组件，展示文章设置记录。

**Props**:
```typescript
interface ArticleSettingListProps {
  settings: ArticleSetting[];
  loading: boolean;
  onEdit: (setting: ArticleSetting) => void;
  onView: (setting: ArticleSetting) => void;
  onDelete: (id: number) => void;
}
```

**功能**:
- 以表格形式展示记录
- 提供操作按钮（查看、编辑、删除）
- 显示提示词预览（截断长文本）

#### 4. Sidebar 组件更新

在现有侧边栏中添加"文章设置"菜单项。

**新增菜单项**:
```typescript
{
  key: '/article-settings',
  icon: <EditOutlined />,
  label: '文章设置',
}
```

### 后端接口

#### API路由: `/api/article-settings`

##### 1. 获取文章设置列表

```
GET /api/article-settings?page=1&pageSize=10
```

**查询参数**:
- `page` (可选): 页码，默认1
- `pageSize` (可选): 每页数量，默认10

**响应**:
```json
{
  "settings": [
    {
      "id": 1,
      "name": "技术博客模板",
      "prompt": "请以专业的技术写作风格...",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 25,
  "page": 1,
  "pageSize": 10
}
```

##### 2. 创建文章设置

```
POST /api/article-settings
```

**请求体**:
```json
{
  "name": "技术博客模板",
  "prompt": "请以专业的技术写作风格..."
}
```

**响应**:
```json
{
  "id": 1,
  "name": "技术博客模板",
  "prompt": "请以专业的技术写作风格...",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

##### 3. 获取单个文章设置

```
GET /api/article-settings/:id
```

**响应**:
```json
{
  "id": 1,
  "name": "技术博客模板",
  "prompt": "请以专业的技术写作风格...",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

##### 4. 更新文章设置

```
PATCH /api/article-settings/:id
```

**请求体**:
```json
{
  "name": "更新后的模板名称",
  "prompt": "更新后的提示词..."
}
```

**响应**:
```json
{
  "id": 1,
  "name": "更新后的模板名称",
  "prompt": "更新后的提示词...",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-02T00:00:00Z"
}
```

##### 5. 删除文章设置

```
DELETE /api/article-settings/:id
```

**响应**:
```json
{
  "success": true
}
```

## 数据模型

### 数据库表: article_settings

```sql
CREATE TABLE IF NOT EXISTS article_settings (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  prompt TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_article_settings_created_at 
  ON article_settings(created_at DESC);
```

**字段说明**:
- `id`: 主键，自增
- `name`: 设置名称，最大255字符，不能为空
- `prompt`: 提示词内容，文本类型，不能为空
- `created_at`: 创建时间，自动设置
- `updated_at`: 更新时间，自动更新

### TypeScript类型定义

```typescript
// 文章设置实体
interface ArticleSetting {
  id: number;
  name: string;
  prompt: string;
  created_at: string;
  updated_at: string;
}

// 创建/更新表单数据
interface ArticleSettingFormData {
  name: string;
  prompt: string;
}

// API响应类型
interface ArticleSettingsListResponse {
  settings: ArticleSetting[];
  total: number;
  page: number;
  pageSize: number;
}

interface ArticleSettingResponse {
  id: number;
  name: string;
  prompt: string;
  created_at: string;
  updated_at: string;
}

interface DeleteResponse {
  success: boolean;
}
```

### Zod验证Schema

```typescript
const createArticleSettingSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(255, '名称不能超过255字符').trim(),
  prompt: z.string().min(1, '提示词不能为空').trim()
});

const updateArticleSettingSchema = z.object({
  name: z.string().min(1).max(255).trim().optional(),
  prompt: z.string().min(1).trim().optional()
});
```


## 正确性属性

*属性是指在系统的所有有效执行中都应该成立的特征或行为——本质上是关于系统应该做什么的正式声明。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### 属性 1: 有效数据创建持久化

*对于任意*有效的文章设置数据（非空名称和提示词），当通过API创建后，数据库中应该存在一条包含相同名称和提示词的记录
**验证: 需求 1.3, 6.1, 8.1**

### 属性 2: 无效输入验证拒绝

*对于任意*包含空字符串或纯空格的名称或提示词，系统应该拒绝创建请求并返回验证错误
**验证: 需求 1.4**

### 属性 3: 分页大小一致性

*对于任意*页码，当记录总数大于等于该页的起始位置时，返回的记录数应该等于pageSize（默认10），除非是最后一页
**验证: 需求 2.2**

### 属性 4: 记录渲染完整性

*对于任意*文章设置记录，渲染后的HTML应该包含该记录的名称、提示词预览、创建时间和操作按钮
**验证: 需求 2.4**

### 属性 5: 更新操作持久化

*对于任意*存在的文章设置记录和有效的更新数据，更新操作后数据库中的记录应该反映新的值，且updated_at时间戳应该更新
**验证: 需求 3.2, 3.3, 6.3**

### 属性 6: 删除操作完整性

*对于任意*存在的文章设置记录，删除操作成功后，数据库中不应该存在该ID的记录
**验证: 需求 4.2, 6.4**

### 属性 7: 详情显示完整性

*对于任意*文章设置记录，详情视图应该显示完整的提示词内容（不截断）和所有元数据字段
**验证: 需求 5.2**

### 属性 8: API错误响应一致性

*对于任意*无效的请求（不存在的ID、验证失败等），API应该返回适当的4xx或5xx状态码和包含错误信息的JSON响应
**验证: 需求 6.5**

### 属性 9: 时间戳自动设置

*对于任意*新创建的文章设置记录，created_at和updated_at字段应该被自动设置为当前时间戳
**验证: 需求 8.2**

### 属性 10: 查询结果排序一致性

*对于任意*查询请求，返回的记录列表应该按created_at字段降序排列（最新的在前）
**验证: 需求 8.3**

### 属性 11: 数据持久化验证

*对于任意*创建的文章设置记录，在系统重启后，该记录应该仍然可以通过API查询到
**验证: 需求 8.5**

## 错误处理

### 客户端错误处理

1. **网络错误**: 使用try-catch捕获fetch请求失败，显示用户友好的错误消息
2. **验证错误**: 在表单提交前进行客户端验证，提供即时反馈
3. **API错误**: 解析API返回的错误消息，使用Ant Design的message组件显示
4. **加载状态**: 使用loading状态防止重复提交，提供视觉反馈

### 服务端错误处理

1. **输入验证**: 使用Zod schema验证所有输入，返回400状态码和详细错误信息
2. **资源不存在**: 查询不存在的记录时返回404状态码
3. **数据库错误**: 捕获数据库异常，记录日志，返回500状态码和通用错误消息
4. **事务回滚**: 在数据库操作失败时自动回滚事务，保证数据一致性

### 错误响应格式

```typescript
interface ErrorResponse {
  error: string;           // 错误消息
  details?: any;          // 详细信息（开发环境）
  code?: string;          // 错误代码（可选）
}
```

### 常见错误场景

| 场景 | HTTP状态码 | 错误消息 |
|------|-----------|---------|
| 名称为空 | 400 | "名称不能为空" |
| 提示词为空 | 400 | "提示词不能为空" |
| 名称过长 | 400 | "名称不能超过255字符" |
| 记录不存在 | 404 | "文章设置不存在" |
| 无效的ID | 400 | "无效的文章设置ID" |
| 数据库连接失败 | 500 | "服务器内部错误" |
| 无效的分页参数 | 400 | "无效的分页参数" |

## 测试策略

### 单元测试

使用Jest和React Testing Library进行单元测试：

1. **组件测试**:
   - ArticleSettingsPage: 测试列表渲染、分页、加载状态
   - ArticleSettingModal: 测试表单验证、提交、取消
   - ArticleSettingList: 测试记录显示、操作按钮

2. **API路由测试**:
   - 测试所有CRUD端点的正常流程
   - 测试输入验证
   - 测试错误处理

3. **验证Schema测试**:
   - 测试Zod schema的各种输入场景
   - 测试边界条件

### 属性测试

使用fast-check进行属性测试：

1. **数据持久化属性**: 生成随机的有效文章设置数据，验证创建后可以查询到
2. **输入验证属性**: 生成随机的无效输入，验证都被正确拒绝
3. **分页属性**: 生成随机数量的记录和分页参数，验证分页逻辑正确
4. **更新属性**: 生成随机的原始记录和更新数据，验证更新后数据正确
5. **删除属性**: 生成随机记录，验证删除后不存在
6. **排序属性**: 生成随机顺序的记录，验证查询结果按时间降序

### 集成测试

1. **端到端流程**: 测试完整的创建-查看-编辑-删除流程
2. **数据库集成**: 使用测试数据库验证数据持久化
3. **API集成**: 测试前后端接口对接

### 测试配置

- **属性测试库**: fast-check
- **最小迭代次数**: 100次
- **属性测试标记格式**: `// Feature: article-settings, Property {number}: {property_text}`

### 测试覆盖率目标

- 语句覆盖率: > 80%
- 分支覆盖率: > 75%
- 函数覆盖率: > 80%
- 行覆盖率: > 80%

## 安全考虑

1. **SQL注入防护**: 使用参数化查询，避免SQL注入
2. **XSS防护**: React自动转义输出，防止XSS攻击
3. **输入验证**: 严格验证所有用户输入
4. **长度限制**: 限制名称和提示词的最大长度，防止DoS攻击
5. **错误信息**: 生产环境不暴露敏感的错误详情

## 性能考虑

1. **数据库索引**: 在created_at字段上创建索引，优化排序查询
2. **分页查询**: 使用LIMIT和OFFSET进行分页，避免一次加载所有数据
3. **连接池**: 使用数据库连接池，提高并发性能
4. **前端优化**: 
   - 使用React.memo避免不必要的重渲染
   - 防抖搜索输入
   - 虚拟滚动（如果记录数量很大）

## 部署注意事项

1. **数据库迁移**: 创建迁移脚本添加article_settings表
2. **环境变量**: 确保数据库连接配置正确
3. **依赖安装**: 确保所有npm依赖已安装
4. **构建**: 前后端代码需要编译
5. **数据库初始化**: 首次部署需要运行schema.sql

## 未来扩展

1. **模板分类**: 添加分类字段，支持按类别筛选
2. **模板共享**: 支持导入导出模板
3. **版本控制**: 记录模板的修改历史
4. **模板预览**: 在创建文章时预览模板效果
5. **权限控制**: 支持多用户，添加权限管理
6. **搜索功能**: 支持按名称或提示词内容搜索
7. **标签系统**: 为模板添加标签，方便分类和搜索
