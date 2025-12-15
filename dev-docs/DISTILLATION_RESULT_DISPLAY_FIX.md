# 蒸馏结果显示修复

## 问题描述

在文章生成任务列表页面，"蒸馏结果"列显示的是关键词（keyword），而不是对应的蒸馏结果内容。

## 问题原因

前端页面的"蒸馏结果"列配置错误，`dataIndex` 设置为 `'keyword'`，导致显示的是关键词字段而不是蒸馏结果字段。

后端 API 也没有返回蒸馏结果数据。

## 修复方案

### 1. 后端修改

#### 修改文件：`server/src/services/articleGenerationService.ts`

**修改接口定义：**
```typescript
export interface GenerationTask {
  // ... 其他字段
  keyword: string;
  provider: string;
  distillationResult?: string | null;  // 新增字段
}
```

**修改 `getTasks` 方法：**
- 在 SQL 查询中添加子查询，获取每个蒸馏记录的第一个话题
- 将查询结果映射到返回对象中

```sql
SELECT 
  -- ... 其他字段
  (SELECT question FROM topics WHERE distillation_id = gt.distillation_id ORDER BY id ASC LIMIT 1) as distillation_result
FROM generation_tasks gt
-- ...
```

**修改 `getTaskDetail` 方法：**
- 同样添加蒸馏结果字段的查询

### 2. 前端修改

#### 修改文件：`client/src/types/articleGeneration.ts`

**更新接口定义：**
```typescript
export interface GenerationTask {
  // ... 其他字段
  keyword: string;
  provider: string;
  distillationResult?: string | null;  // 新增字段
}
```

#### 修改文件：`client/src/pages/ArticleGenerationPage.tsx`

**修改表格列配置：**
```typescript
{
  title: '蒸馏结果',
  dataIndex: 'distillationResult',  // 从 'keyword' 改为 'distillationResult'
  key: 'distillationResult',
  width: 150,
  ellipsis: { showTitle: false },
  render: (text: string | null) => (
    <Tooltip title={text || '已删除'}>
      {text ? (
        <Tag color="cyan">{text}</Tag>
      ) : (
        <Tag color="default">已删除</Tag>
      )}
    </Tooltip>
  )
}
```

## 测试结果

使用测试脚本 `test-distillation-result.sh` 验证：

```bash
✅ distillationResult 字段存在

第一个任务：
  关键词: 雍和植发
  蒸馏结果: <think>
✅ 蒸馏结果与关键词不同，修复成功！
```

## 验证步骤

1. 启动服务器：`cd server && npm run dev`
2. 启动客户端：`cd client && npm run dev`
3. 访问文章生成页面：http://localhost:5174/article-generation
4. 查看任务列表中的"蒸馏结果"列，应该显示对应的话题内容，而不是关键词

## 影响范围

- 后端：`server/src/services/articleGenerationService.ts`
- 前端类型：`client/src/types/articleGeneration.ts`
- 前端页面：`client/src/pages/ArticleGenerationPage.tsx`

## 注意事项

- 蒸馏结果显示的是该蒸馏记录的第一个话题（按 ID 升序）
- 如果蒸馏记录没有关联的话题，则显示"已删除"
- 该修复不影响其他功能，只是修正了显示逻辑

## 完成时间

2025-12-15
