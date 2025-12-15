# Design Document - Documentation and API Organization

## Overview

本设计文档描述了 GEO 优化系统文档整理和 API 接口文档组织的完整方案。项目将创建和更新以下文档：

1. **完整的 API 接口文档** - 详细记录所有 API 端点
2. **更新的项目文档** - 同步 docs 文件夹下的所有文档
3. **数据库文档** - 完整的表结构和关系说明
4. **部署指南** - 多种部署方案和最佳实践
5. **API 使用示例** - 实际的代码示例和最佳实践

## Architecture

### 文档组织结构

```
docs/                           # 用户文档（面向最终用户）
├── README.md                   # 文档索引
├── 项目总览.md                 # 项目概述和功能列表
├── 系统设计文档.md             # 技术架构和设计
├── 功能说明.md                 # 详细功能说明
├── 快速开始.md                 # 安装和配置指南
├── API文档.md                  # 完整的 API 接口文档（新增）
├── 数据库文档.md               # 数据库结构文档（新增）
├── 部署指南.md                 # 部署方案和步骤
├── UI设计说明.md               # UI 设计规范
├── Ollama集成指南.md           # Ollama 使用指南
├── 腾讯EdgeOne部署方案.md      # EdgeOne 部署方案
└── EdgeOne架构适配性评估.md    # 架构评估

dev-docs/                       # 开发文档（面向开发团队）
├── README.md                   # 开发文档索引
├── 功能实现总结/               # 各功能的实现记录
├── 快速启动指南/               # 快速上手指南
├── 问题修复/                   # Bug 修复记录
└── 测试文档/                   # 测试脚本和清单
```

### API 文档组织

API 文档按功能模块组织，每个模块包含：
- 模块概述
- 相关 API 端点列表
- 每个端点的详细说明
- 请求/响应示例
- 错误处理
- 使用场景

## Components and Interfaces

### 1. API 文档模块

#### 1.1 配置管理 API
- `GET /api/config/active` - 获取当前配置
- `POST /api/config` - 保存配置
- `POST /api/config/test` - 测试连接
- `GET /api/config/ollama/models` - 获取 Ollama 模型列表
- `POST /api/config/ollama/test` - 测试 Ollama 连接

#### 1.2 关键词蒸馏 API
- `POST /api/distillation` - 执行蒸馏
- `GET /api/distillation/history` - 获取历史
- `GET /api/distillation/keywords` - 获取关键词列表
- `GET /api/distillation/results` - 获取结果列表（带筛选）
- `GET /api/distillation/stats` - 获取使用统计
- `GET /api/distillation/recommended` - 获取推荐结果
- `GET /api/distillation/:id` - 获取详情
- `DELETE /api/distillation/:id` - 删除记录
- `PATCH /api/distillation/:id` - 更新关键词
- `DELETE /api/distillation/topics` - 批量删除话题
- `GET /api/distillation/:id/usage-history` - 获取使用历史
- `POST /api/distillation/:id/reset-usage` - 重置使用统计
- `POST /api/distillation/reset-all-usage` - 重置所有统计
- `POST /api/distillation/repair-usage-stats` - 修复使用统计

#### 1.3 话题管理 API
- `GET /api/topics/:distillationId` - 获取话题列表
- `PUT /api/topics/:id` - 编辑话题
- `DELETE /api/topics/:id` - 删除话题

#### 1.4 文章管理 API
- `POST /api/articles/generate` - 生成文章
- `GET /api/articles` - 获取文章列表
- `GET /api/articles/:id` - 获取文章详情
- `PUT /api/articles/:id` - 更新文章
- `DELETE /api/articles/:id` - 删除文章

#### 1.5 文章生成任务 API
- `POST /api/article-generation/tasks` - 创建任务
- `GET /api/article-generation/tasks` - 获取任务列表
- `GET /api/article-generation/tasks/:id` - 获取任务详情
- `GET /api/article-generation/tasks/:id/diagnose` - 诊断任务
- `POST /api/article-generation/tasks/:id/retry` - 重试任务
- `DELETE /api/article-generation/tasks/:id` - 删除任务
- `POST /api/article-generation/tasks/batch-delete` - 批量删除任务
- `DELETE /api/article-generation/tasks` - 删除所有任务

#### 1.6 文章设置 API
- `GET /api/article-settings` - 获取设置列表
- `POST /api/article-settings` - 创建设置
- `GET /api/article-settings/:id` - 获取设置详情
- `PUT /api/article-settings/:id` - 更新设置
- `DELETE /api/article-settings/:id` - 删除设置

#### 1.7 转化目标 API
- `GET /api/conversion-targets` - 获取目标列表
- `POST /api/conversion-targets` - 创建目标
- `GET /api/conversion-targets/:id` - 获取目标详情
- `PUT /api/conversion-targets/:id` - 更新目标
- `DELETE /api/conversion-targets/:id` - 删除目标

#### 1.8 企业图库 API
- `GET /api/gallery/albums` - 获取相册列表
- `POST /api/gallery/albums` - 创建相册
- `GET /api/gallery/albums/:id` - 获取相册详情
- `PATCH /api/gallery/albums/:id` - 更新相册
- `DELETE /api/gallery/albums/:id` - 删除相册
- `POST /api/gallery/albums/:albumId/images` - 上传图片
- `GET /api/gallery/images/:id` - 获取图片
- `DELETE /api/gallery/images/:id` - 删除图片

#### 1.9 企业知识库 API
- `GET /api/knowledge-bases` - 获取知识库列表
- `POST /api/knowledge-bases` - 创建知识库
- `GET /api/knowledge-bases/:id` - 获取知识库详情
- `PATCH /api/knowledge-bases/:id` - 更新知识库
- `DELETE /api/knowledge-bases/:id` - 删除知识库
- `POST /api/knowledge-bases/:id/documents` - 上传文档
- `GET /api/knowledge-bases/documents/:id` - 获取文档详情
- `DELETE /api/knowledge-bases/documents/:id` - 删除文档
- `GET /api/knowledge-bases/:id/documents/search` - 搜索文档

### 2. 文档内容模块

#### 2.1 API 端点文档结构
每个 API 端点的文档包含：
```markdown
### [HTTP方法] [路径]

**描述**: 简短描述

**请求参数**:
- 路径参数
- 查询参数
- 请求体

**响应格式**:
- 成功响应（200/201）
- 错误响应（400/404/500）

**示例**:
- curl 命令
- JavaScript/TypeScript 代码
- 请求/响应示例

**注意事项**:
- 使用限制
- 性能考虑
- 最佳实践
```

#### 2.2 数据库文档结构
```markdown
## 表名

**用途**: 表的用途说明

**字段**:
| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| ...    | ...  | ...  | ...  |

**索引**:
- 索引列表

**关系**:
- 外键关系

**示例查询**:
- 常用 SQL 示例
```

## Data Models

### API 文档数据结构

```typescript
interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  module: string;
  parameters?: {
    path?: Parameter[];
    query?: Parameter[];
    body?: BodySchema;
  };
  responses: {
    [statusCode: number]: ResponseSchema;
  };
  examples: {
    curl: string;
    javascript?: string;
    typescript?: string;
  };
  notes?: string[];
}

interface Parameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  example?: any;
}

interface BodySchema {
  type: 'object' | 'array';
  properties?: { [key: string]: PropertySchema };
  example?: any;
}

interface ResponseSchema {
  description: string;
  schema: any;
  example: any;
}
```

### 数据库表结构

系统包含以下主要数据表：

1. **api_configs** - API 配置
2. **distillations** - 蒸馏记录
3. **topics** - 话题
4. **articles** - 文章
5. **generation_tasks** - 生成任务
6. **article_settings** - 文章设置
7. **conversion_targets** - 转化目标
8. **albums** - 相册
9. **images** - 图片
10. **knowledge_bases** - 知识库
11. **knowledge_documents** - 知识文档
12. **distillation_usage** - 蒸馏使用记录

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

由于本项目主要是文档整理工作，所有的验收标准都是关于文档内容和质量的要求，不涉及可自动化测试的系统行为。因此，没有可以转换为 property-based tests 的正式属性。

文档质量将通过以下方式保证：
1. **人工审查** - 检查文档的完整性和准确性
2. **文档模板** - 使用统一的文档格式
3. **交叉引用检查** - 确保文档之间的引用正确
4. **版本控制** - 跟踪文档的变更历史
5. **定期更新** - 随着系统更新同步文档

## Error Handling

### 文档错误处理

1. **缺失信息** - 标记为 TODO 或 TBD
2. **过时信息** - 添加废弃标记和更新日期
3. **冲突信息** - 以最新的实现为准
4. **链接失效** - 定期检查和修复

### API 文档错误说明

每个 API 端点文档应包含：
- 常见错误码（400, 401, 403, 404, 500）
- 错误响应格式
- 错误原因说明
- 解决方案建议

## Testing Strategy

### 文档测试方法

由于这是文档项目，测试主要通过以下方式进行：

#### 1. 文档审查清单
- [ ] 所有 API 端点都有文档
- [ ] 每个端点包含完整的请求/响应说明
- [ ] 提供了实际的代码示例
- [ ] 错误处理说明完整
- [ ] 文档之间的引用正确
- [ ] 版本信息和更新日期准确

#### 2. API 示例验证
- 手动测试所有 curl 示例
- 验证请求/响应格式的准确性
- 确保代码示例可以运行

#### 3. 文档一致性检查
- 对比不同文档中的相同信息
- 检查技术栈描述的一致性
- 验证功能列表的完整性

#### 4. 链接检查
- 检查所有内部链接
- 验证外部链接的有效性
- 确保文件路径正确

### 文档维护流程

1. **创建阶段** - 使用文档模板
2. **审查阶段** - 技术审查和内容审查
3. **发布阶段** - 更新版本号和日期
4. **维护阶段** - 定期检查和更新

## Implementation Notes

### 文档编写优先级

1. **高优先级**
   - API 文档（最重要，开发者最需要）
   - 项目总览（反映最新功能）
   - 快速开始（确保新用户能顺利使用）

2. **中优先级**
   - 数据库文档（帮助理解数据结构）
   - 功能说明（详细的使用指南）
   - 系统设计文档（技术架构）

3. **低优先级**
   - 部署指南（已有基础版本）
   - UI 设计说明（相对稳定）

### 文档格式规范

1. **Markdown 格式** - 所有文档使用 Markdown
2. **统一标题层级** - 遵循 H1-H6 的层级结构
3. **代码块标注** - 指定语言类型
4. **表格对齐** - 使用标准 Markdown 表格
5. **链接格式** - 使用相对路径

### API 文档示例格式

```markdown
### POST /api/articles/generate

**描述**: 基于关键词和话题生成文章

**请求体**:
\`\`\`json
{
  "keyword": "英国留学",
  "distillationId": 1,
  "requirements": "2000字，专业权威",
  "topicIds": [1, 2, 3],
  "knowledgeBaseIds": [1]
}
\`\`\`

**响应**:
\`\`\`json
{
  "success": true,
  "articleId": 123,
  "content": "文章内容..."
}
\`\`\`

**curl 示例**:
\`\`\`bash
curl -X POST http://localhost:3000/api/articles/generate \\
  -H "Content-Type: application/json" \\
  -d '{"keyword":"英国留学","distillationId":1}'
\`\`\`
```

## Documentation Structure

### docs/ 文件夹（用户文档）

```
docs/
├── README.md                       # 文档导航和索引
├── 项目总览.md                     # 更新：添加新功能
├── 系统设计文档.md                 # 更新：数据库结构
├── 功能说明.md                     # 更新：新功能说明
├── 快速开始.md                     # 更新：最新安装步骤
├── API文档.md                      # 新建：完整 API 文档
├── 数据库文档.md                   # 新建：数据库结构
├── 部署指南.md                     # 保持：已有内容
├── UI设计说明.md                   # 保持：已有内容
├── Ollama集成指南.md               # 保持：已有内容
├── 腾讯EdgeOne部署方案.md          # 保持：已有内容
└── EdgeOne架构适配性评估.md        # 保持：已有内容
```

### dev-docs/ 文件夹（开发文档）

保持现有结构，不做大的调整。这些文档主要用于开发过程记录。

## Version Control

### 文档版本管理

每个主要文档应包含：
```markdown
---
版本: 2.0
最后更新: 2025-01-XX
更新人: [姓名]
---
```

### 更新日志

在 docs/README.md 中维护更新日志：
```markdown
## 更新日志

### 2025-01-XX
- 新增：完整的 API 文档
- 新增：数据库文档
- 更新：项目总览，添加新功能
- 更新：系统设计文档，更新数据库结构
```

## Next Steps

完成文档整理后的后续工作：

1. **文档网站** - 考虑使用 VitePress 或 Docusaurus 构建文档网站
2. **API 测试工具** - 集成 Swagger/OpenAPI 规范
3. **自动化检查** - 添加文档链接检查和格式检查工具
4. **多语言支持** - 考虑提供英文版本文档
5. **交互式示例** - 提供在线 API 测试工具
