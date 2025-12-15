# 蒸馏结果使用追踪 API 文档

## 概述

本文档描述了蒸馏结果使用追踪功能的所有API接口，包括请求参数、响应格式和错误处理。

## 基础信息

- **Base URL**: `/api/distillation`
- **认证**: 需要有效的会话token
- **Content-Type**: `application/json`

## API接口列表

### 1. 获取蒸馏结果统计列表

获取包含使用统计信息的蒸馏结果列表。

**端点**: `GET /api/distillation/stats`

**查询参数**:
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| page | number | 否 | 1 | 页码 |
| pageSize | number | 否 | 10 | 每页数量 |

**响应**:
```json
{
  "distillations": [
    {
      "distillationId": 1,
      "keyword": "AI技术",
      "provider": "deepseek",
      "usageCount": 5,
      "lastUsedAt": "2024-01-15T10:30:00Z",
      "topicCount": 10,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 50
}
```

**字段说明**:
- `distillationId`: 蒸馏结果ID
- `keyword`: 关键词
- `provider`: AI提供商
- `usageCount`: 使用次数
- `lastUsedAt`: 最后使用时间（可能为null）
- `topicCount`: 话题数量
- `createdAt`: 创建时间
- `total`: 总记录数

**排序规则**:
- 按 `usage_count` 升序排序
- 当 `usage_count` 相同时，按 `created_at` 升序排序

**示例请求**:
```bash
curl -X GET "http://localhost:3000/api/distillation/stats?page=1&pageSize=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**错误响应**:
```json
{
  "error": "错误信息"
}
```

---

### 2. 获取使用历史

获取指定蒸馏结果的使用历史记录。

**端点**: `GET /api/distillation/:id/usage-history`

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | number | 蒸馏结果ID |

**查询参数**:
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| page | number | 否 | 1 | 页码 |
| pageSize | number | 否 | 10 | 每页数量 |

**响应**:
```json
{
  "history": [
    {
      "id": 1,
      "taskId": 10,
      "articleId": 100,
      "articleTitle": "AI技术的未来发展",
      "usedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 25
}
```

**字段说明**:
- `id`: 使用记录ID
- `taskId`: 任务ID
- `articleId`: 文章ID
- `articleTitle`: 文章标题（如果文章被删除则为null）
- `usedAt`: 使用时间

**排序规则**:
- 按 `used_at` 降序排序（最新的在前）

**示例请求**:
```bash
curl -X GET "http://localhost:3000/api/distillation/1/usage-history?page=1&pageSize=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**错误响应**:
- `404 Not Found`: 蒸馏结果不存在
```json
{
  "error": "蒸馏结果不存在"
}
```

---

### 3. 获取推荐的蒸馏结果

获取使用次数最少的蒸馏结果列表（推荐使用）。

**端点**: `GET /api/distillation/recommended`

**查询参数**:
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| limit | number | 否 | 3 | 返回数量 |

**响应**:
```json
[
  {
    "distillationId": 1,
    "keyword": "AI技术",
    "usageCount": 0,
    "topicCount": 10,
    "isRecommended": true,
    "recommendReason": "使用次数最少"
  }
]
```

**字段说明**:
- `distillationId`: 蒸馏结果ID
- `keyword`: 关键词
- `usageCount`: 使用次数
- `topicCount`: 话题数量
- `isRecommended`: 是否推荐（始终为true）
- `recommendReason`: 推荐原因

**过滤规则**:
- 只返回有话题的蒸馏结果（topicCount > 0）
- 按 `usage_count` 升序排序
- 当 `usage_count` 相同时，按 `created_at` 升序排序

**示例请求**:
```bash
curl -X GET "http://localhost:3000/api/distillation/recommended?limit=3" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 4. 重置单个蒸馏结果的使用统计

将指定蒸馏结果的使用次数重置为0，并删除所有使用记录。

**端点**: `POST /api/distillation/:id/reset-usage`

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | number | 蒸馏结果ID |

**请求体**: 无

**响应**:
```json
{
  "success": true,
  "message": "使用统计已重置"
}
```

**示例请求**:
```bash
curl -X POST "http://localhost:3000/api/distillation/1/reset-usage" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**错误响应**:
- `404 Not Found`: 蒸馏结果不存在
- `500 Internal Server Error`: 重置失败

**权限要求**: 管理员权限

---

### 5. 重置所有蒸馏结果的使用统计

将所有蒸馏结果的使用次数重置为0，并清空使用记录表。

**端点**: `POST /api/distillation/reset-all-usage`

**请求体**: 无

**响应**:
```json
{
  "success": true,
  "message": "所有使用统计已重置"
}
```

**示例请求**:
```bash
curl -X POST "http://localhost:3000/api/distillation/reset-all-usage" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**错误响应**:
- `500 Internal Server Error`: 重置失败

**权限要求**: 管理员权限

**警告**: 此操作不可逆，请谨慎使用！

---

### 6. 修复使用统计

检测并修复 `usage_count` 与实际使用记录数量不一致的数据。

**端点**: `POST /api/distillation/repair-usage-stats`

**请求体**: 无

**响应**:
```json
{
  "fixed": 3,
  "errors": [],
  "details": [
    {
      "distillationId": 1,
      "oldCount": 10,
      "newCount": 8
    },
    {
      "distillationId": 2,
      "oldCount": 5,
      "newCount": 5
    }
  ]
}
```

**字段说明**:
- `fixed`: 修复的记录数量
- `errors`: 错误信息列表
- `details`: 修复详情
  - `distillationId`: 蒸馏结果ID
  - `oldCount`: 修复前的使用次数
  - `newCount`: 修复后的使用次数

**示例请求**:
```bash
curl -X POST "http://localhost:3000/api/distillation/repair-usage-stats" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**权限要求**: 管理员权限

---

## 任务API修改

### 获取任务列表

**端点**: `GET /api/generation/tasks`

**修改内容**: 响应数据中添加了 `keyword` 字段

**响应**:
```json
{
  "tasks": [
    {
      "id": 1,
      "status": "completed",
      "keyword": "AI技术",
      "conversionTargetName": "测试公司",
      "progress": 100,
      "generatedCount": 10,
      "requestedCount": 10,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 50
}
```

**新增字段**:
- `keyword`: 蒸馏结果的关键词（如果蒸馏结果被删除则为null）

---

## 错误代码

| HTTP状态码 | 说明 |
|-----------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## 错误响应格式

所有错误响应都遵循以下格式：

```json
{
  "error": "错误信息描述"
}
```

## 数据验证规则

### 分页参数
- `page`: 必须是正整数，最小值为1
- `pageSize`: 必须是正整数，最小值为1，最大值为100

### ID参数
- 必须是正整数
- 必须存在于数据库中

## 性能考虑

### 缓存策略
- 推荐结果可以缓存5分钟
- 统计列表可以缓存1分钟
- 使用历史不建议缓存（实时性要求高）

### 分页建议
- 默认每页10条记录
- 建议最大每页100条记录
- 避免深度分页（offset过大）

## 并发控制

### 使用次数更新
- 使用数据库原子操作（`UPDATE ... SET usage_count = usage_count + 1`）
- 支持并发更新，无需应用层锁

### 智能选择
- 使用数据库行级锁（`SELECT FOR UPDATE`）
- 确保并发场景下的选择唯一性

## 监控指标

建议监控以下指标：
- API响应时间
- 错误率
- 并发请求数
- 数据一致性检查结果

## 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| 1.0.0 | 2024-01-01 | 初始版本 |

## 联系方式

如有问题或建议，请联系开发团队。
