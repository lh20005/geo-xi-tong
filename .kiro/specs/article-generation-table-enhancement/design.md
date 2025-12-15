# Design Document

## Overview

本设计文档描述了文章生成任务列表页面的UI改进方案。主要目标是通过增加关键业务信息列（转化目标、关键词、蒸馏结果）并移除冗余列（更新时间、错误信息），优化用户体验和页面布局。

改进将涉及：
- 前端：修改ArticleGenerationPage组件的表格列定义
- 后端：增强API响应以包含关联数据（转化目标名称、蒸馏关键词和提供商）
- 数据获取：优化数据库查询以使用JOIN获取关联信息

## Architecture

### 系统层次

```
┌─────────────────────────────────────────┐
│   ArticleGenerationPage (React)         │
│   - 表格列定义                           │
│   - 数据展示逻辑                         │
└──────────────┬──────────────────────────┘
               │
               │ HTTP GET /api/article-generation/tasks
               │
┌──────────────▼──────────────────────────┐
│   articleGenerationRouter (Express)     │
│   - GET /tasks 路由处理                  │
└──────────────┬──────────────────────────┘
               │
               │
┌──────────────▼──────────────────────────┐
│   ArticleGenerationService              │
│   - getTasks() 方法                      │
│   - 数据库查询与转换                     │
└──────────────┬──────────────────────────┘
               │
               │ SQL JOIN Query
               │
┌──────────────▼──────────────────────────┐
│   PostgreSQL Database                   │
│   - generation_tasks                    │
│   - conversion_targets                  │
│   - distillations                       │
└─────────────────────────────────────────┘
```

### 数据流

1. 用户访问文章生成页面
2. 前端调用 `fetchTasks()` API
3. 后端执行JOIN查询获取任务及关联数据
4. 返回增强的任务数据（包含转化目标名称、关键词、提供商）
5. 前端渲染新的列布局

## Components and Interfaces

### 前端组件

#### ArticleGenerationPage

**职责：** 展示文章生成任务列表，处理用户交互

**修改点：**
- 更新 `columns` 数组定义
- 移除 `updatedAt` 和 `errorMessage` 列
- 添加 `conversionTargetName`、`keyword`、`provider` 列
- 调整列宽配置

**新增列定义：**

```typescript
{
  title: '转化目标',
  dataIndex: 'conversionTargetName',
  key: 'conversionTargetName',
  width: 150,
  ellipsis: { showTitle: false },
  render: (text: string | null) => (
    <Tooltip title={text || '未设置'}>
      <span>{text || '-'}</span>
    </Tooltip>
  )
}

{
  title: '关键词',
  dataIndex: 'keyword',
  key: 'keyword',
  width: 120,
  render: (text: string) => <Tag color="blue">{text}</Tag>
}

{
  title: '蒸馏结果',
  dataIndex: 'provider',
  key: 'provider',
  width: 100,
  render: (text: string) => (
    <Tag color={text === 'deepseek' ? 'purple' : 'green'}>
      {text === 'deepseek' ? 'DeepSeek' : 'Gemini'}
    </Tag>
  )
}
```

### 后端接口

#### GET /api/article-generation/tasks

**当前响应结构：**
```typescript
{
  tasks: GenerationTask[];
  total: number;
  page: number;
  pageSize: number;
}
```

**增强后的 GenerationTask 类型：**
```typescript
interface GenerationTask {
  id: number;
  distillationId: number;
  albumId: number;
  knowledgeBaseId: number;
  articleSettingId: number;
  conversionTargetId?: number | null;
  requestedCount: number;
  generatedCount: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  // 新增字段
  conversionTargetName?: string | null;
  keyword: string;
  provider: string;
}
```

### 后端服务

#### ArticleGenerationService.getTasks()

**修改点：**
- 更新SQL查询以JOIN关联表
- 添加转化目标名称、关键词、提供商字段
- 保持向后兼容性

**新的SQL查询：**
```sql
SELECT 
  gt.id, 
  gt.distillation_id, 
  gt.album_id, 
  gt.knowledge_base_id, 
  gt.article_setting_id, 
  gt.conversion_target_id,
  gt.requested_count, 
  gt.generated_count, 
  gt.status, 
  gt.progress, 
  gt.error_message,
  gt.created_at, 
  gt.updated_at,
  ct.company_name as conversion_target_name,
  d.keyword,
  d.provider
FROM generation_tasks gt
LEFT JOIN conversion_targets ct ON gt.conversion_target_id = ct.id
INNER JOIN distillations d ON gt.distillation_id = d.id
ORDER BY gt.created_at DESC
LIMIT $1 OFFSET $2
```

## Data Models

### 数据库表关系

```
generation_tasks
├── distillation_id → distillations.id (INNER JOIN)
│   ├── keyword
│   └── provider
└── conversion_target_id → conversion_targets.id (LEFT JOIN)
    └── company_name
```

### 类型定义更新

**client/src/types/articleGeneration.ts:**

```typescript
export interface GenerationTask {
  id: number;
  distillationId: number;
  albumId: number;
  knowledgeBaseId: number;
  articleSettingId: number;
  conversionTargetId?: number | null;
  requestedCount: number;
  generatedCount: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  // 新增字段
  conversionTargetName?: string | null;
  keyword: string;
  provider: string;
}
```

## Error Handling

### 数据缺失处理

1. **转化目标缺失：** 当 `conversion_target_id` 为 NULL 或关联记录不存在时，显示 "-"
2. **蒸馏结果缺失：** 由于 `distillation_id` 是必需字段且使用 INNER JOIN，不应出现缺失情况。如果出现，记录错误日志并返回 500 错误
3. **未知提供商：** 如果 `provider` 不是 "deepseek" 或 "gemini"，使用默认颜色的 Tag 显示原始值

### 查询错误处理

1. **数据库连接失败：** 返回 500 错误，前端显示 "加载任务列表失败" 消息
2. **JOIN 查询失败：** 记录详细错误日志，返回 500 错误
3. **数据转换错误：** 捕获异常，记录日志，返回部分可用数据或错误响应

### 前端错误处理

1. **API 调用失败：** 显示 Ant Design message 错误提示
2. **数据格式异常：** 使用默认值或占位符，避免页面崩溃
3. **渲染错误：** 使用 React Error Boundary 捕获并显示友好错误信息

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Conversion target name consistency

*For any* GenerationTask with a non-null conversion_target_id, the displayed conversionTargetName should match the company_name field from the associated ConversionTarget record in the database.

**Validates: Requirements 1.2, 6.2**

### Property 2: Keyword data consistency

*For any* GenerationTask, the displayed keyword should match the keyword field from the associated Distillation record in the database.

**Validates: Requirements 2.2, 6.3**

### Property 3: Provider data consistency

*For any* GenerationTask, the displayed provider should match the provider field from the associated Distillation record in the database.

**Validates: Requirements 3.2, 6.3**

### Property 4: API response completeness

*For any* task list API response, each GenerationTask object should include the fields: conversion_target_id, distillation_id, conversionTargetName, keyword, and provider.

**Validates: Requirements 6.1**

## Testing Strategy

### 单元测试

本项目将使用 Jest 作为测试框架，配合 React Testing Library 进行前端组件测试。

#### 后端测试

**测试文件：** `server/src/services/__tests__/articleGenerationService.test.ts`

测试用例：
1. `getTasks()` 返回包含关联数据的任务列表
2. `getTasks()` 正确处理转化目标为 NULL 的情况
3. `getTasks()` 正确执行 JOIN 查询
4. `getTasks()` 在蒸馏结果不存在时抛出错误

**测试文件：** `server/src/routes/__tests__/articleGeneration.test.ts`

测试用例：
1. `GET /api/article-generation/tasks` 返回增强的任务数据
2. `GET /api/article-generation/tasks` 响应包含 `conversionTargetName`、`keyword`、`provider` 字段
3. `GET /api/article-generation/tasks` 处理数据库错误

#### 前端测试

**测试文件：** `client/src/pages/__tests__/ArticleGenerationPage.test.tsx`

测试用例：
1. 表格渲染包含新增的三列
2. 表格不渲染"更新时间"和"错误信息"列
3. 转化目标为空时显示 "-"
4. 关键词渲染为蓝色 Tag
5. DeepSeek 提供商渲染为紫色 Tag
6. Gemini 提供商渲染为绿色 Tag
7. 列宽分配合理，无水平滚动（在标准屏幕尺寸下）

### 集成测试

**测试场景：**
1. 端到端测试：从前端请求到后端响应的完整流程
2. 数据一致性测试：验证显示的数据与数据库中的数据一致
3. 性能测试：验证 JOIN 查询不会显著影响响应时间

### 测试配置

- 最小测试运行次数：单次执行（非属性测试）
- 测试覆盖率目标：新增代码 > 80%
- 测试框架：Jest + React Testing Library
- Mock 策略：使用 Jest mock 模拟数据库查询和 API 调用

