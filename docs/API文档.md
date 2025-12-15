# GEO优化系统 - API 接口文档

---
版本: 2.0  
最后更新: 2025-01-15  
维护者: GEO Team
---

## 📋 文档概述

本文档详细记录了 GEO 优化系统的所有 API 接口，包括请求参数、响应格式、使用示例和最佳实践。

### API 基础信息

- **Base URL**: `http://localhost:3000/api`
- **Content-Type**: `application/json`
- **字符编码**: UTF-8

### 通用响应格式

**成功响应**:
```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

**错误响应**:
```json
{
  "error": "错误信息",
  "details": "详细错误说明"
}
```

### 通用错误码

| 状态码 | 说明 | 处理建议 |
|--------|------|----------|
| 200 | 请求成功 | - |
| 201 | 创建成功 | - |
| 400 | 请求参数错误 | 检查请求参数格式和必填项 |
| 404 | 资源不存在 | 确认资源 ID 是否正确 |
| 500 | 服务器错误 | 查看服务器日志，联系技术支持 |

---

## 📑 目录

1. [配置管理 API](#1-配置管理-api)
2. [关键词蒸馏 API](#2-关键词蒸馏-api)
3. [话题管理 API](#3-话题管理-api)
4. [文章管理 API](#4-文章管理-api)
5. [文章生成任务 API](#5-文章生成任务-api)
6. [文章设置 API](#6-文章设置-api)
7. [转化目标 API](#7-转化目标-api)
8. [企业图库 API](#8-企业图库-api)
9. [企业知识库 API](#9-企业知识库-api)

---

## 1. 配置管理 API

配置管理 API 用于管理 AI 模型的配置，支持 DeepSeek、Gemini 和 Ollama 三种 AI 服务。

### 1.1 获取当前配置

**接口**: `GET /api/config/active`

**描述**: 获取当前激活的 AI 配置

**请求参数**: 无

**响应示例**:
```json
{
  "provider": "deepseek",
  "ollamaBaseUrl": null,
  "ollamaModel": null,
  "configured": true
}
```

**curl 示例**:
```bash
curl http://localhost:3000/api/config/active
```

**字段说明**:
- `provider`: AI 提供商，可选值: `deepseek` | `gemini` | `ollama` | `null`
- `configured`: 是否已配置
- `ollamaBaseUrl`: Ollama 服务地址（仅 Ollama 时有值）
- `ollamaModel`: Ollama 模型名称（仅 Ollama 时有值）

---

### 1.2 保存配置

**接口**: `POST /api/config`

**描述**: 保存新的 AI 配置，会自动停用其他配置

**请求体**:
```json
{
  "provider": "deepseek",
  "apiKey": "sk-xxx"
}
```

**Ollama 配置示例**:
```json
{
  "provider": "ollama",
  "ollamaBaseUrl": "http://localhost:11434",
  "ollamaModel": "deepseek-r1:latest"
}
```

**响应示例**:
```json
{
  "success": true,
  "config": {
    "id": 1,
    "provider": "deepseek"
  },
  "message": "API配置保存成功"
}
```

**curl 示例**:
```bash
# DeepSeek 配置
curl -X POST http://localhost:3000/api/config \
  -H "Content-Type: application/json" \
  -d '{"provider":"deepseek","apiKey":"sk-xxx"}'

# Ollama 配置
curl -X POST http://localhost:3000/api/config \
  -H "Content-Type: application/json" \
  -d '{"provider":"ollama","ollamaBaseUrl":"http://localhost:11434","ollamaModel":"deepseek-r1:latest"}'
```

**错误响应**:
- `400`: 缺少必要参数或配置验证失败
- `503`: Ollama 服务不可用

---

### 1.3 测试 API 连接

**接口**: `POST /api/config/test`

**描述**: 测试 API 连接是否正常

**请求体**:
```json
{
  "provider": "deepseek",
  "apiKey": "sk-xxx"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "API连接测试成功"
}
```

---

### 1.4 获取 Ollama 模型列表

**接口**: `GET /api/config/ollama/models`

**描述**: 获取本地 Ollama 中已安装的 DeepSeek 模型列表

**查询参数**:
- `baseUrl` (可选): Ollama 服务地址，默认 `http://localhost:11434`

**响应示例**:
```json
{
  "models": [
    {
      "name": "deepseek-r1:latest",
      "size": "8.5 GB",
      "modifiedAt": "2025-01-10T10:00:00Z"
    }
  ],
  "count": 1
}
```

**curl 示例**:
```bash
curl "http://localhost:3000/api/config/ollama/models?baseUrl=http://localhost:11434"
```

**错误响应**:
- `503`: 无法连接到 Ollama 服务

---

### 1.5 测试 Ollama 连接

**接口**: `POST /api/config/ollama/test`

**描述**: 测试 Ollama 服务和模型是否可用

**请求体**:
```json
{
  "baseUrl": "http://localhost:11434",
  "model": "deepseek-r1:latest"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "连接成功！模型可用。"
}
```

**错误响应**:
- `400`: 缺少参数
- `404`: 模型未安装
- `503`: 无法连接到 Ollama 服务

---

## 2. 关键词蒸馏 API

关键词蒸馏 API 用于分析关键词并生成相关的用户搜索问题。

### 2.1 执行关键词蒸馏

**接口**: `POST /api/distillation`

**描述**: 对关键词进行 AI 蒸馏分析，生成 10-15 个真实用户可能提出的问题

**请求体**:
```json
{
  "keyword": "英国留学"
}
```

**响应示例**:
```json
{
  "success": true,
  "distillationId": 1,
  "keyword": "英国留学",
  "questions": [
    "英国留学哪家中介靠谱？",
    "英国留学一年费用大概多少？",
    "..."
  ],
  "count": 12
}
```

**curl 示例**:
```bash
curl -X POST http://localhost:3000/api/distillation \
  -H "Content-Type: application/json" \
  -d '{"keyword":"英国留学"}'
```

**注意事项**:
- 需要先配置 AI API
- 蒸馏过程通常需要 10-30 秒
- 生成的问题会自动保存到数据库

---

### 2.2 获取蒸馏历史

**接口**: `GET /api/distillation/history`

**描述**: 获取最近的蒸馏历史记录（最多 50 条）

**响应示例**:
```json
[
  {
    "id": 1,
    "keyword": "英国留学",
    "provider": "deepseek",
    "created_at": "2025-01-15T10:00:00Z",
    "topic_count": 12
  }
]
```

**curl 示例**:
```bash
curl http://localhost:3000/api/distillation/history
```

---

### 2.3 获取关键词列表

**接口**: `GET /api/distillation/keywords`

**描述**: 获取所有唯一的关键词列表

**响应示例**:
```json
{
  "keywords": ["英国留学", "Python培训", "品牌营销"]
}
```

---

### 2.4 获取蒸馏结果列表（带筛选）

**接口**: `GET /api/distillation/results`

**描述**: 获取蒸馏结果列表，支持筛选、搜索和分页

**查询参数**:
- `keyword` (可选): 按关键词筛选
- `provider` (可选): 按 AI 模型筛选 (`deepseek` | `gemini` | `ollama`)
- `search` (可选): 搜索关键词（优先级最高）
- `page` (可选): 页码，默认 1
- `pageSize` (可选): 每页数量，默认 10，最大 100

**响应示例**:
```json
{
  "results": [
    {
      "id": 1,
      "keyword": "英国留学",
      "provider": "deepseek",
      "topic_count": 12,
      "usage_count": 5,
      "created_at": "2025-01-15T10:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 10
}
```

**curl 示例**:
```bash
# 按关键词筛选
curl "http://localhost:3000/api/distillation/results?keyword=英国留学"

# 按 AI 模型筛选
curl "http://localhost:3000/api/distillation/results?provider=deepseek"

# 搜索
curl "http://localhost:3000/api/distillation/results?search=留学"

# 分页
curl "http://localhost:3000/api/distillation/results?page=2&pageSize=20"
```

---

### 2.5 获取使用统计

**接口**: `GET /api/distillation/stats`

**描述**: 获取蒸馏结果列表，包含使用统计信息

**查询参数**:
- `page` (可选): 页码，默认 1
- `pageSize` (可选): 每页数量，默认 10

**响应示例**:
```json
{
  "distillations": [
    {
      "id": 1,
      "keyword": "英国留学",
      "provider": "deepseek",
      "topic_count": 12,
      "usage_count": 5,
      "last_used_at": "2025-01-15T12:00:00Z",
      "created_at": "2025-01-15T10:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 10
}
```

---

### 2.6 获取推荐的蒸馏结果

**接口**: `GET /api/distillation/recommended`

**描述**: 获取推荐的蒸馏结果（基于使用频率）

**查询参数**:
- `limit` (可选): 推荐数量，默认 3，范围 1-10

**响应示例**:
```json
{
  "recommendations": [
    {
      "id": 1,
      "keyword": "英国留学",
      "usage_count": 10,
      "topic_count": 12
    }
  ]
}
```

---

### 2.7 获取蒸馏详情

**接口**: `GET /api/distillation/:id`

**描述**: 获取单条蒸馏记录的详细信息，包含所有话题

**路径参数**:
- `id`: 蒸馏记录 ID

**响应示例**:
```json
{
  "id": 1,
  "keyword": "英国留学",
  "provider": "deepseek",
  "created_at": "2025-01-15T10:00:00Z",
  "questions": [
    "英国留学哪家中介靠谱？",
    "英国留学一年费用大概多少？"
  ]
}
```

**curl 示例**:
```bash
curl http://localhost:3000/api/distillation/1
```

---

### 2.8 删除蒸馏记录

**接口**: `DELETE /api/distillation/:id`

**描述**: 删除单条蒸馏记录（会级联删除关联的话题）

**路径参数**:
- `id`: 蒸馏记录 ID

**响应示例**:
```json
{
  "success": true,
  "message": "记录删除成功"
}
```

**curl 示例**:
```bash
curl -X DELETE http://localhost:3000/api/distillation/1
```

---

### 2.9 更新关键词

**接口**: `PATCH /api/distillation/:id`

**描述**: 更新蒸馏记录的关键词

**路径参数**:
- `id`: 蒸馏记录 ID

**请求体**:
```json
{
  "keyword": "新关键词"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "关键词更新成功"
}
```

---

### 2.10 批量删除话题

**接口**: `DELETE /api/distillation/topics`

**描述**: 批量删除话题

**请求体**:
```json
{
  "topicIds": [1, 2, 3]
}
```

**响应示例**:
```json
{
  "success": true,
  "deletedCount": 3
}
```

---

### 2.11 获取使用历史

**接口**: `GET /api/distillation/:id/usage-history`

**描述**: 获取单条蒸馏结果的使用历史

**路径参数**:
- `id`: 蒸馏记录 ID

**查询参数**:
- `page` (可选): 页码，默认 1
- `pageSize` (可选): 每页数量，默认 10

**响应示例**:
```json
{
  "history": [
    {
      "article_id": 1,
      "used_at": "2025-01-15T12:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 10
}
```

---

### 2.12 重置使用统计

**接口**: `POST /api/distillation/:id/reset-usage`

**描述**: 重置单条蒸馏结果的使用统计

**路径参数**:
- `id`: 蒸馏记录 ID

**响应示例**:
```json
{
  "success": true,
  "message": "使用统计重置成功"
}
```

---

### 2.13 修复使用统计

**接口**: `POST /api/distillation/repair-usage-stats`

**描述**: 修复所有蒸馏结果的使用统计（重新计算 usage_count）

**响应示例**:
```json
{
  "success": true,
  "message": "修复完成，共修复5条记录",
  "fixed": 5,
  "total": 10
}
```

---

## 3. 话题管理 API

话题管理 API 用于管理蒸馏后生成的话题。

### 3.1 获取话题列表

**接口**: `GET /api/topics/:distillationId`

**描述**: 获取指定蒸馏记录的所有话题

**路径参数**:
- `distillationId`: 蒸馏记录 ID

**响应示例**:
```json
[
  {
    "id": 1,
    "distillation_id": 1,
    "question": "英国留学哪家中介靠谱？",
    "keyword": "英国留学",
    "created_at": "2025-01-15T10:00:00Z"
  }
]
```

**curl 示例**:
```bash
curl http://localhost:3000/api/topics/1
```

---

### 3.2 编辑话题

**接口**: `PUT /api/topics/:id`

**描述**: 编辑话题内容

**路径参数**:
- `id`: 话题 ID

**请求体**:
```json
{
  "question": "更新后的话题内容"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "话题更新成功"
}
```

**curl 示例**:
```bash
curl -X PUT http://localhost:3000/api/topics/1 \
  -H "Content-Type: application/json" \
  -d '{"question":"更新后的话题内容"}'
```

---

### 3.3 删除话题

**接口**: `DELETE /api/topics/:id`

**描述**: 删除单个话题

**路径参数**:
- `id`: 话题 ID

**响应示例**:
```json
{
  "success": true,
  "message": "话题删除成功"
}
```

**curl 示例**:
```bash
curl -X DELETE http://localhost:3000/api/topics/1
```

---

## 4. 文章管理 API

文章管理 API 用于生成和管理文章。

### 4.1 生成文章

**接口**: `POST /api/articles/generate`

**描述**: 基于关键词和话题生成文章，支持引用知识库

**请求体**:
```json
{
  "keyword": "英国留学",
  "distillationId": 1,
  "requirements": "2000字，专业权威，包含实际案例",
  "topicIds": [1, 2, 3],
  "knowledgeBaseIds": [1]
}
```

**字段说明**:
- `keyword`: 关键词（必填）
- `distillationId`: 蒸馏记录 ID（必填）
- `requirements`: 文章要求（可选）
- `topicIds`: 要使用的话题 ID 数组（可选，不传则使用所有话题）
- `knowledgeBaseIds`: 要引用的知识库 ID 数组（可选）

**响应示例**:
```json
{
  "success": true,
  "articleId": 1,
  "content": "文章内容..."
}
```

**curl 示例**:
```bash
curl -X POST http://localhost:3000/api/articles/generate \
  -H "Content-Type: application/json" \
  -d '{
    "keyword":"英国留学",
    "distillationId":1,
    "requirements":"2000字，专业权威",
    "topicIds":[1,2,3],
    "knowledgeBaseIds":[1]
  }'
```

**注意事项**:
- 生成过程通常需要 30-60 秒
- 引用知识库可以提高文章的专业性和准确性
- 文章会自动保存到数据库

---

### 4.2 获取文章列表

**接口**: `GET /api/articles`

**描述**: 获取文章列表，支持分页和任务筛选

**查询参数**:
- `page` (可选): 页码，默认 1
- `pageSize` (可选): 每页数量，默认 10，最大 100
- `taskId` (可选): 按任务 ID 筛选

**响应示例**:
```json
{
  "articles": [
    {
      "id": 1,
      "title": "文章标题",
      "keyword": "英国留学",
      "distillationId": 1,
      "taskId": null,
      "provider": "deepseek",
      "imageUrl": null,
      "preview": "文章预览内容...",
      "createdAt": "2025-01-15T12:00:00Z",
      "updatedAt": "2025-01-15T12:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 10
}
```

**curl 示例**:
```bash
# 获取所有文章
curl "http://localhost:3000/api/articles?page=1&pageSize=10"

# 按任务筛选
curl "http://localhost:3000/api/articles?taskId=1"
```

---

### 4.3 获取文章详情

**接口**: `GET /api/articles/:id`

**描述**: 获取文章的完整内容

**路径参数**:
- `id`: 文章 ID

**响应示例**:
```json
{
  "id": 1,
  "title": "文章标题",
  "keyword": "英国留学",
  "distillationId": 1,
  "taskId": null,
  "requirements": "2000字，专业权威",
  "content": "完整的文章内容...",
  "imageUrl": null,
  "provider": "deepseek",
  "createdAt": "2025-01-15T12:00:00Z",
  "updatedAt": "2025-01-15T12:00:00Z"
}
```

**curl 示例**:
```bash
curl http://localhost:3000/api/articles/1
```

---

### 4.4 更新文章

**接口**: `PUT /api/articles/:id`

**描述**: 更新文章的标题和内容

**路径参数**:
- `id`: 文章 ID

**请求体**:
```json
{
  "title": "新标题",
  "content": "更新后的内容"
}
```

**响应示例**:
```json
{
  "id": 1,
  "title": "新标题",
  "content": "更新后的内容",
  "updatedAt": "2025-01-15T13:00:00Z"
}
```

**curl 示例**:
```bash
curl -X PUT http://localhost:3000/api/articles/1 \
  -H "Content-Type: application/json" \
  -d '{"title":"新标题","content":"更新后的内容"}'
```

---

### 4.5 删除文章

**接口**: `DELETE /api/articles/:id`

**描述**: 删除文章（会自动更新相关的使用统计）

**路径参数**:
- `id`: 文章 ID

**响应示例**:
```json
{
  "success": true,
  "message": "文章删除成功"
}
```

**curl 示例**:
```bash
curl -X DELETE http://localhost:3000/api/articles/1
```

---

## 5. 文章生成任务 API

文章生成任务 API 用于批量生成文章，支持任务管理和监控。

### 5.1 创建生成任务

**接口**: `POST /api/article-generation/tasks`

**描述**: 创建文章批量生成任务

**请求体**:
```json
{
  "distillationId": 1,
  "albumId": 1,
  "knowledgeBaseId": 1,
  "articleSettingId": 1,
  "conversionTargetId": 1,
  "articleCount": 10
}
```

**字段说明**:
- `distillationId`: 蒸馏历史 ID（必填）
- `albumId`: 图库 ID（必填）
- `knowledgeBaseId`: 知识库 ID（必填）
- `articleSettingId`: 文章设置 ID（必填）
- `conversionTargetId`: 转化目标 ID（可选）
- `articleCount`: 要生成的文章数量（必填，1-100）

**响应示例**:
```json
{
  "taskId": 1,
  "status": "pending",
  "selectedDistillationIds": [1, 2, 3],
  "createdAt": "2025-01-15T14:00:00Z"
}
```

**curl 示例**:
```bash
curl -X POST http://localhost:3000/api/article-generation/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "distillationId":1,
    "albumId":1,
    "knowledgeBaseId":1,
    "articleSettingId":1,
    "articleCount":10
  }'
```

**错误响应**:
- `400`: 数据验证失败
- `404`: 引用的资源不存在

---

### 5.2 获取任务列表

**接口**: `GET /api/article-generation/tasks`

**描述**: 获取任务列表，支持分页

**查询参数**:
- `page` (可选): 页码，默认 1
- `pageSize` (可选): 每页数量，默认 10，最大 100

**响应示例**:
```json
{
  "tasks": [
    {
      "id": 1,
      "status": "completed",
      "articleCount": 10,
      "generatedCount": 10,
      "createdAt": "2025-01-15T14:00:00Z",
      "completedAt": "2025-01-15T14:30:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 10
}
```

**任务状态说明**:
- `pending`: 等待执行
- `running`: 正在执行
- `completed`: 已完成
- `failed`: 执行失败

**curl 示例**:
```bash
curl "http://localhost:3000/api/article-generation/tasks?page=1&pageSize=10"
```

---

### 5.3 获取任务详情

**接口**: `GET /api/article-generation/tasks/:id`

**描述**: 获取任务的详细信息，包含生成的文章列表

**路径参数**:
- `id`: 任务 ID

**响应示例**:
```json
{
  "id": 1,
  "status": "completed",
  "distillationId": 1,
  "albumId": 1,
  "knowledgeBaseId": 1,
  "articleSettingId": 1,
  "conversionTargetId": 1,
  "articleCount": 10,
  "generatedCount": 10,
  "selectedDistillations": [
    {
      "id": 1,
      "keyword": "英国留学"
    }
  ],
  "generatedArticles": [
    {
      "id": 1,
      "title": "文章标题",
      "keyword": "英国留学",
      "imageUrl": "...",
      "createdAt": "2025-01-15T14:10:00Z"
    }
  ],
  "createdAt": "2025-01-15T14:00:00Z",
  "completedAt": "2025-01-15T14:30:00Z"
}
```

**curl 示例**:
```bash
curl http://localhost:3000/api/article-generation/tasks/1
```

---

### 5.4 诊断任务

**接口**: `GET /api/article-generation/tasks/:id/diagnose`

**描述**: 诊断任务状态，检查可能的问题

**路径参数**:
- `id`: 任务 ID

**响应示例**:
```json
{
  "taskId": 1,
  "status": "failed",
  "issues": [
    {
      "type": "error",
      "message": "AI 服务调用失败",
      "suggestion": "检查 AI API 配置"
    }
  ],
  "diagnosticTime": "2025-01-15T15:00:00Z"
}
```

**curl 示例**:
```bash
curl http://localhost:3000/api/article-generation/tasks/1/diagnose
```

---

### 5.5 重试任务

**接口**: `POST /api/article-generation/tasks/:id/retry`

**描述**: 重新执行失败或已完成的任务

**路径参数**:
- `id`: 任务 ID

**响应示例**:
```json
{
  "success": true,
  "message": "任务已重新启动",
  "taskId": 1
}
```

**curl 示例**:
```bash
curl -X POST http://localhost:3000/api/article-generation/tasks/1/retry
```

**注意事项**:
- 只能重试失败或已完成的任务
- 正在运行的任务无法重试

---

### 5.6 删除任务

**接口**: `DELETE /api/article-generation/tasks/:id`

**描述**: 删除单个任务（会级联删除关联的文章）

**路径参数**:
- `id`: 任务 ID

**响应示例**:
```json
{
  "success": true,
  "message": "任务已删除",
  "taskId": 1
}
```

**curl 示例**:
```bash
curl -X DELETE http://localhost:3000/api/article-generation/tasks/1
```

**注意事项**:
- 无法删除正在运行的任务
- 删除任务会同时删除该任务生成的所有文章

---

### 5.7 批量删除任务

**接口**: `POST /api/article-generation/tasks/batch-delete`

**描述**: 批量删除多个任务

**请求体**:
```json
{
  "taskIds": [1, 2, 3]
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "成功删除 3 个任务",
  "deletedCount": 3,
  "deletedIds": [1, 2, 3],
  "requestedCount": 3
}
```

**curl 示例**:
```bash
curl -X POST http://localhost:3000/api/article-generation/tasks/batch-delete \
  -H "Content-Type: application/json" \
  -d '{"taskIds":[1,2,3]}'
```

**错误响应**:
- `400`: 包含正在运行的任务，无法删除

---

### 5.8 删除所有任务

**接口**: `DELETE /api/article-generation/tasks`

**描述**: 删除所有非运行中的任务

**响应示例**:
```json
{
  "success": true,
  "message": "成功删除 10 个任务",
  "deletedCount": 10
}
```

**curl 示例**:
```bash
curl -X DELETE http://localhost:3000/api/article-generation/tasks
```

**注意事项**:
- 只删除非运行中的任务
- 如果存在运行中的任务，操作会失败

---

## 6. 文章设置 API

文章设置 API 用于管理文章生成的模板设置。

### 6.1 获取设置列表

**接口**: `GET /api/article-settings`

**描述**: 获取所有文章设置模板

**响应示例**:
```json
{
  "settings": [
    {
      "id": 1,
      "name": "专业权威型",
      "wordCount": 2000,
      "style": "专业、权威",
      "requirements": "包含实际案例和数据支持",
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ]
}
```

**curl 示例**:
```bash
curl http://localhost:3000/api/article-settings
```

---

### 6.2 创建设置

**接口**: `POST /api/article-settings`

**描述**: 创建新的文章设置模板

**请求体**:
```json
{
  "name": "专业权威型",
  "wordCount": 2000,
  "style": "专业、权威",
  "requirements": "包含实际案例和数据支持"
}
```

**响应示例**:
```json
{
  "id": 1,
  "name": "专业权威型",
  "wordCount": 2000,
  "style": "专业、权威",
  "requirements": "包含实际案例和数据支持",
  "createdAt": "2025-01-15T10:00:00Z"
}
```

**curl 示例**:
```bash
curl -X POST http://localhost:3000/api/article-settings \
  -H "Content-Type: application/json" \
  -d '{
    "name":"专业权威型",
    "wordCount":2000,
    "style":"专业、权威",
    "requirements":"包含实际案例和数据支持"
  }'
```

---

### 6.3 获取设置详情

**接口**: `GET /api/article-settings/:id`

**描述**: 获取单个设置的详细信息

**路径参数**:
- `id`: 设置 ID

**响应示例**:
```json
{
  "id": 1,
  "name": "专业权威型",
  "wordCount": 2000,
  "style": "专业、权威",
  "requirements": "包含实际案例和数据支持",
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-01-15T10:00:00Z"
}
```

---

### 6.4 更新设置

**接口**: `PUT /api/article-settings/:id`

**描述**: 更新文章设置

**路径参数**:
- `id`: 设置 ID

**请求体**:
```json
{
  "name": "更新后的名称",
  "wordCount": 3000,
  "style": "更新后的风格",
  "requirements": "更新后的要求"
}
```

**响应示例**:
```json
{
  "id": 1,
  "name": "更新后的名称",
  "updatedAt": "2025-01-15T11:00:00Z"
}
```

---

### 6.5 删除设置

**接口**: `DELETE /api/article-settings/:id`

**描述**: 删除文章设置

**路径参数**:
- `id`: 设置 ID

**响应示例**:
```json
{
  "success": true,
  "message": "设置删除成功"
}
```

---

## 7. 转化目标 API

转化目标 API 用于管理文章中的转化目标（如联系方式、产品链接等）。

### 7.1 获取目标列表

**接口**: `GET /api/conversion-targets`

**描述**: 获取所有转化目标

**响应示例**:
```json
{
  "targets": [
    {
      "id": 1,
      "name": "咨询热线",
      "type": "phone",
      "content": "400-123-4567",
      "description": "24小时咨询热线",
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ]
}
```

**curl 示例**:
```bash
curl http://localhost:3000/api/conversion-targets
```

---

### 7.2 创建目标

**接口**: `POST /api/conversion-targets`

**描述**: 创建新的转化目标

**请求体**:
```json
{
  "name": "咨询热线",
  "type": "phone",
  "content": "400-123-4567",
  "description": "24小时咨询热线"
}
```

**目标类型**:
- `phone`: 电话号码
- `email`: 电子邮件
- `url`: 网址链接
- `wechat`: 微信号
- `other`: 其他

**响应示例**:
```json
{
  "id": 1,
  "name": "咨询热线",
  "type": "phone",
  "content": "400-123-4567",
  "description": "24小时咨询热线",
  "createdAt": "2025-01-15T10:00:00Z"
}
```

**curl 示例**:
```bash
curl -X POST http://localhost:3000/api/conversion-targets \
  -H "Content-Type: application/json" \
  -d '{
    "name":"咨询热线",
    "type":"phone",
    "content":"400-123-4567",
    "description":"24小时咨询热线"
  }'
```

---

### 7.3 获取目标详情

**接口**: `GET /api/conversion-targets/:id`

**描述**: 获取单个转化目标的详细信息

**路径参数**:
- `id`: 目标 ID

**响应示例**:
```json
{
  "id": 1,
  "name": "咨询热线",
  "type": "phone",
  "content": "400-123-4567",
  "description": "24小时咨询热线",
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-01-15T10:00:00Z"
}
```

---

### 7.4 更新目标

**接口**: `PUT /api/conversion-targets/:id`

**描述**: 更新转化目标

**路径参数**:
- `id`: 目标 ID

**请求体**:
```json
{
  "name": "更新后的名称",
  "type": "phone",
  "content": "400-999-8888",
  "description": "更新后的描述"
}
```

**响应示例**:
```json
{
  "id": 1,
  "name": "更新后的名称",
  "updatedAt": "2025-01-15T11:00:00Z"
}
```

---

### 7.5 删除目标

**接口**: `DELETE /api/conversion-targets/:id`

**描述**: 删除转化目标

**路径参数**:
- `id`: 目标 ID

**响应示例**:
```json
{
  "success": true,
  "message": "目标删除成功"
}
```

---

## 8. 企业图库 API

企业图库 API 用于管理相册和图片资源。

### 8.1 获取相册列表

**接口**: `GET /api/gallery/albums`

**描述**: 获取所有相册

**响应示例**:
```json
{
  "albums": [
    {
      "id": 1,
      "name": "产品图片",
      "created_at": "2025-01-15T10:00:00Z",
      "image_count": 10,
      "cover_image": "filename.jpg"
    }
  ]
}
```

**curl 示例**:
```bash
curl http://localhost:3000/api/gallery/albums
```

---

### 8.2 创建相册

**接口**: `POST /api/gallery/albums`

**描述**: 创建新相册，支持同时上传图片

**Content-Type**: `multipart/form-data`

**表单字段**:
- `name`: 相册名称（必填）
- `images`: 图片文件（可选，最多 20 张）

**响应示例**:
```json
{
  "id": 1,
  "name": "产品图片",
  "created_at": "2025-01-15T10:00:00Z"
}
```

**curl 示例**:
```bash
# 仅创建相册
curl -X POST http://localhost:3000/api/gallery/albums \
  -F "name=产品图片"

# 创建相册并上传图片
curl -X POST http://localhost:3000/api/gallery/albums \
  -F "name=产品图片" \
  -F "images=@image1.jpg" \
  -F "images=@image2.jpg"
```

**文件限制**:
- 支持格式: JPEG, PNG, GIF, WebP
- 单张图片最大: 5MB
- 最多上传: 20 张

---

### 8.3 获取相册详情

**接口**: `GET /api/gallery/albums/:id`

**描述**: 获取相册详情，包含所有图片

**路径参数**:
- `id`: 相册 ID

**响应示例**:
```json
{
  "id": 1,
  "name": "产品图片",
  "created_at": "2025-01-15T10:00:00Z",
  "images": [
    {
      "id": 1,
      "filename": "product1.jpg",
      "filepath": "12345-product1.jpg",
      "mime_type": "image/jpeg",
      "size": 102400,
      "created_at": "2025-01-15T10:05:00Z"
    }
  ]
}
```

**curl 示例**:
```bash
curl http://localhost:3000/api/gallery/albums/1
```

---

### 8.4 更新相册

**接口**: `PATCH /api/gallery/albums/:id`

**描述**: 更新相册名称

**路径参数**:
- `id`: 相册 ID

**请求体**:
```json
{
  "name": "新的相册名称"
}
```

**响应示例**:
```json
{
  "id": 1,
  "name": "新的相册名称",
  "updated_at": "2025-01-15T11:00:00Z"
}
```

**curl 示例**:
```bash
curl -X PATCH http://localhost:3000/api/gallery/albums/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"新的相册名称"}'
```

---

### 8.5 删除相册

**接口**: `DELETE /api/gallery/albums/:id`

**描述**: 删除相册（会级联删除所有图片）

**路径参数**:
- `id`: 相册 ID

**响应示例**:
```json
{
  "success": true,
  "deletedImages": 10
}
```

**curl 示例**:
```bash
curl -X DELETE http://localhost:3000/api/gallery/albums/1
```

---

### 8.6 上传图片到相册

**接口**: `POST /api/gallery/albums/:albumId/images`

**描述**: 向指定相册上传图片

**Content-Type**: `multipart/form-data`

**路径参数**:
- `albumId`: 相册 ID

**表单字段**:
- `images`: 图片文件（最多 20 张）

**响应示例**:
```json
{
  "uploadedCount": 2,
  "images": [
    {
      "id": 1,
      "filename": "product1.jpg",
      "created_at": "2025-01-15T10:05:00Z"
    }
  ]
}
```

**curl 示例**:
```bash
curl -X POST http://localhost:3000/api/gallery/albums/1/images \
  -F "images=@image1.jpg" \
  -F "images=@image2.jpg"
```

---

### 8.7 获取图片详情

**接口**: `GET /api/gallery/images/:id`

**描述**: 获取单张图片的详细信息

**路径参数**:
- `id`: 图片 ID

**响应示例**:
```json
{
  "id": 1,
  "album_id": 1,
  "filename": "product1.jpg",
  "filepath": "12345-product1.jpg",
  "mime_type": "image/jpeg",
  "size": 102400,
  "created_at": "2025-01-15T10:05:00Z"
}
```

---

### 8.8 删除图片

**接口**: `DELETE /api/gallery/images/:id`

**描述**: 删除单张图片

**路径参数**:
- `id`: 图片 ID

**响应示例**:
```json
{
  "success": true
}
```

**curl 示例**:
```bash
curl -X DELETE http://localhost:3000/api/gallery/images/1
```

---

## 9. 企业知识库 API

企业知识库 API 用于管理知识库和文档资源。

### 9.1 获取知识库列表

**接口**: `GET /api/knowledge-bases`

**描述**: 获取所有知识库

**响应示例**:
```json
{
  "knowledgeBases": [
    {
      "id": 1,
      "name": "产品知识库",
      "description": "产品相关的文档和资料",
      "created_at": "2025-01-15T10:00:00Z",
      "updated_at": "2025-01-15T10:00:00Z",
      "document_count": 5
    }
  ]
}
```

**curl 示例**:
```bash
curl http://localhost:3000/api/knowledge-bases
```

---

### 9.2 创建知识库

**接口**: `POST /api/knowledge-bases`

**描述**: 创建新的知识库

**请求体**:
```json
{
  "name": "产品知识库",
  "description": "产品相关的文档和资料"
}
```

**响应示例**:
```json
{
  "id": 1,
  "name": "产品知识库",
  "description": "产品相关的文档和资料",
  "created_at": "2025-01-15T10:00:00Z"
}
```

**curl 示例**:
```bash
curl -X POST http://localhost:3000/api/knowledge-bases \
  -H "Content-Type: application/json" \
  -d '{
    "name":"产品知识库",
    "description":"产品相关的文档和资料"
  }'
```

---

### 9.3 获取知识库详情

**接口**: `GET /api/knowledge-bases/:id`

**描述**: 获取知识库详情，包含所有文档

**路径参数**:
- `id`: 知识库 ID

**响应示例**:
```json
{
  "id": 1,
  "name": "产品知识库",
  "description": "产品相关的文档和资料",
  "created_at": "2025-01-15T10:00:00Z",
  "updated_at": "2025-01-15T10:00:00Z",
  "document_count": 5,
  "documents": [
    {
      "id": 1,
      "filename": "产品手册.pdf",
      "file_type": ".pdf",
      "file_size": 1024000,
      "content_preview": "产品手册内容预览...",
      "created_at": "2025-01-15T10:05:00Z"
    }
  ]
}
```

**curl 示例**:
```bash
curl http://localhost:3000/api/knowledge-bases/1
```

---

### 9.4 更新知识库

**接口**: `PATCH /api/knowledge-bases/:id`

**描述**: 更新知识库信息

**路径参数**:
- `id`: 知识库 ID

**请求体**:
```json
{
  "name": "更新后的名称",
  "description": "更新后的描述"
}
```

**响应示例**:
```json
{
  "id": 1,
  "name": "更新后的名称",
  "description": "更新后的描述",
  "updated_at": "2025-01-15T11:00:00Z"
}
```

**curl 示例**:
```bash
curl -X PATCH http://localhost:3000/api/knowledge-bases/1 \
  -H "Content-Type: application/json" \
  -d '{
    "name":"更新后的名称",
    "description":"更新后的描述"
  }'
```

---

### 9.5 删除知识库

**接口**: `DELETE /api/knowledge-bases/:id`

**描述**: 删除知识库（会级联删除所有文档）

**路径参数**:
- `id`: 知识库 ID

**响应示例**:
```json
{
  "success": true,
  "deletedDocuments": 5
}
```

**curl 示例**:
```bash
curl -X DELETE http://localhost:3000/api/knowledge-bases/1
```

---

### 9.6 上传文档

**接口**: `POST /api/knowledge-bases/:id/documents`

**描述**: 向知识库上传文档，系统会自动解析文本内容

**Content-Type**: `multipart/form-data`

**路径参数**:
- `id`: 知识库 ID

**表单字段**:
- `files`: 文档文件（最多 20 个）

**响应示例**:
```json
{
  "uploadedCount": 2,
  "documents": [
    {
      "id": 1,
      "filename": "产品手册.pdf",
      "file_type": ".pdf",
      "file_size": 1024000,
      "created_at": "2025-01-15T10:05:00Z"
    }
  ],
  "errors": []
}
```

**curl 示例**:
```bash
curl -X POST http://localhost:3000/api/knowledge-bases/1/documents \
  -F "files=@产品手册.pdf" \
  -F "files=@用户指南.docx"
```

**支持格式**:
- `.txt` - 纯文本
- `.md` - Markdown
- `.pdf` - PDF 文档
- `.doc` - Word 文档
- `.docx` - Word 文档

**文件限制**:
- 单个文件最大: 10MB
- 最多上传: 20 个文件

**注意事项**:
- 系统会自动提取文档的文本内容
- 提取失败的文件会在 `errors` 数组中返回
- 支持中文文件名

---

### 9.7 获取文档详情

**接口**: `GET /api/knowledge-bases/documents/:id`

**描述**: 获取文档的完整内容

**路径参数**:
- `id`: 文档 ID

**响应示例**:
```json
{
  "id": 1,
  "knowledge_base_id": 1,
  "filename": "产品手册.pdf",
  "file_type": ".pdf",
  "file_size": 1024000,
  "content": "完整的文档文本内容...",
  "created_at": "2025-01-15T10:05:00Z"
}
```

**curl 示例**:
```bash
curl http://localhost:3000/api/knowledge-bases/documents/1
```

---

### 9.8 删除文档

**接口**: `DELETE /api/knowledge-bases/documents/:id`

**描述**: 删除单个文档

**路径参数**:
- `id`: 文档 ID

**响应示例**:
```json
{
  "success": true
}
```

**curl 示例**:
```bash
curl -X DELETE http://localhost:3000/api/knowledge-bases/documents/1
```

---

### 9.9 搜索文档

**接口**: `GET /api/knowledge-bases/:id/documents/search`

**描述**: 在知识库中搜索文档（支持文件名和内容搜索）

**路径参数**:
- `id`: 知识库 ID

**查询参数**:
- `q`: 搜索关键词（必填）

**响应示例**:
```json
{
  "documents": [
    {
      "id": 1,
      "filename": "产品手册.pdf",
      "file_type": ".pdf",
      "file_size": 1024000,
      "content_preview": "...搜索关键词相关的内容...",
      "created_at": "2025-01-15T10:05:00Z"
    }
  ]
}
```

**curl 示例**:
```bash
curl "http://localhost:3000/api/knowledge-bases/1/documents/search?q=产品"
```

**搜索说明**:
- 支持文件名搜索
- 支持文档内容全文搜索
- 不区分大小写
- 最多返回 50 条结果

---

## 📚 API 使用最佳实践

### 1. 错误处理

所有 API 调用都应该包含错误处理：

```javascript
try {
  const response = await fetch('http://localhost:3000/api/distillation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword: '英国留学' })
  });
  
  if (!response.ok) {
    const error = await response.json();
    console.error('API 错误:', error.error, error.details);
    return;
  }
  
  const data = await response.json();
  console.log('蒸馏成功:', data);
} catch (error) {
  console.error('网络错误:', error);
}
```

### 2. 分页处理

对于返回列表的 API，建议使用分页：

```javascript
async function getAllArticles() {
  let page = 1;
  const pageSize = 50;
  let allArticles = [];
  
  while (true) {
    const response = await fetch(
      `http://localhost:3000/api/articles?page=${page}&pageSize=${pageSize}`
    );
    const data = await response.json();
    
    allArticles = allArticles.concat(data.articles);
    
    if (data.articles.length < pageSize) {
      break; // 已获取所有数据
    }
    
    page++;
  }
  
  return allArticles;
}
```

### 3. 文件上传

上传文件时使用 FormData：

```javascript
async function uploadImages(albumId, files) {
  const formData = new FormData();
  
  for (const file of files) {
    formData.append('images', file);
  }
  
  const response = await fetch(
    `http://localhost:3000/api/gallery/albums/${albumId}/images`,
    {
      method: 'POST',
      body: formData
    }
  );
  
  return await response.json();
}
```

### 4. 长时间操作

对于可能耗时较长的操作（如文章生成），建议添加超时处理：

```javascript
async function generateArticleWithTimeout(data, timeout = 60000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch('http://localhost:3000/api/articles/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('请求超时');
    }
    throw error;
  }
}
```

### 5. 批量操作

批量操作时建议控制并发数：

```javascript
async function batchDeleteWithLimit(ids, limit = 5) {
  const results = [];
  
  for (let i = 0; i < ids.length; i += limit) {
    const batch = ids.slice(i, i + limit);
    const promises = batch.map(id =>
      fetch(`http://localhost:3000/api/articles/${id}`, {
        method: 'DELETE'
      })
    );
    
    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
  }
  
  return results;
}
```

---

## 🔄 完整业务流程示例

### 流程 1: 从关键词到文章

```javascript
// 1. 配置 AI
await fetch('http://localhost:3000/api/config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    provider: 'deepseek',
    apiKey: 'sk-xxx'
  })
});

// 2. 执行关键词蒸馏
const distillation = await fetch('http://localhost:3000/api/distillation', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ keyword: '英国留学' })
}).then(r => r.json());

// 3. 获取话题列表
const topics = await fetch(
  `http://localhost:3000/api/topics/${distillation.distillationId}`
).then(r => r.json());

// 4. 生成文章
const article = await fetch('http://localhost:3000/api/articles/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    keyword: '英国留学',
    distillationId: distillation.distillationId,
    requirements: '2000字，专业权威',
    topicIds: topics.slice(0, 5).map(t => t.id)
  })
}).then(r => r.json());

console.log('文章生成成功:', article.articleId);
```

### 流程 2: 批量生成文章任务

```javascript
// 1. 创建知识库并上传文档
const kb = await fetch('http://localhost:3000/api/knowledge-bases', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: '产品知识库',
    description: '产品相关文档'
  })
}).then(r => r.json());

// 2. 上传文档
const formData = new FormData();
formData.append('files', documentFile);
await fetch(`http://localhost:3000/api/knowledge-bases/${kb.id}/documents`, {
  method: 'POST',
  body: formData
});

// 3. 创建文章设置
const setting = await fetch('http://localhost:3000/api/article-settings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: '专业型',
    wordCount: 2000,
    style: '专业、权威'
  })
}).then(r => r.json());

// 4. 创建生成任务
const task = await fetch('http://localhost:3000/api/article-generation/tasks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    distillationId: 1,
    albumId: 1,
    knowledgeBaseId: kb.id,
    articleSettingId: setting.id,
    articleCount: 10
  })
}).then(r => r.json());

// 5. 监控任务状态
const checkStatus = async () => {
  const taskDetail = await fetch(
    `http://localhost:3000/api/article-generation/tasks/${task.taskId}`
  ).then(r => r.json());
  
  console.log(`任务状态: ${taskDetail.status}`);
  console.log(`已生成: ${taskDetail.generatedCount}/${taskDetail.articleCount}`);
  
  if (taskDetail.status === 'completed') {
    console.log('任务完成！生成的文章:', taskDetail.generatedArticles);
  } else if (taskDetail.status === 'failed') {
    console.error('任务失败');
  }
};
```

---

## 📞 技术支持

如有问题或建议，请通过以下方式联系：

- **GitHub Issues**: [项目 Issues 页面]
- **技术文档**: [docs 文件夹]
- **开发文档**: [dev-docs 文件夹]

---

**文档版本**: 2.0  
**最后更新**: 2025-01-15  
**维护团队**: GEO Team
