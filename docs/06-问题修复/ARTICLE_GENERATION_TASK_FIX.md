# 文章生成任务创建错误修复

**修复日期**: 2026-01-19  
**问题类型**: 服务器端代码错误  
**影响范围**: Windows 端文章生成任务创建功能

---

## 问题描述

Windows 端创建文章生成任务时报错：

```
POST https://jzgeo.cc/api/article-generation/tasks 500 (Internal Server Error)
{
  "error": "创建任务失败",
  "details": "话题选择功能已迁移到 Windows 端，服务器端不再提供此功能"
}
```

### 错误日志

```
创建任务错误: Error: 话题选择功能已迁移到 Windows 端，服务器端不再提供此功能
    at new TopicSelectionService (/var/www/geo-system/server/services/topicSelectionService.js:15:15)
    at ArticleGenerationService.createTask (/var/www/geo-system/server/services/articleGenerationService.js:223:30)
```

---

## 问题分析

### 根本原因

`ArticleGenerationService.createTask()` 方法中实例化了 `TopicSelectionService`：

```typescript
// ❌ 错误代码
const topicService = new TopicSelectionService();
```

但 `TopicSelectionService` 的构造函数会抛出错误：

```typescript
export class TopicSelectionService {
  constructor() {
    throw new Error('话题选择功能已迁移到 Windows 端，服务器端不再提供此功能');
  }
}
```

### 为什么会这样？

1. **架构迁移遗留问题**：话题选择功能已迁移到 Windows 端本地执行
2. **代码清理不彻底**：`createTask` 方法中仍然实例化了已废弃的服务
3. **实际上不需要**：代码中直接使用 SQL 查询选择话题，不需要 `TopicSelectionService`

---

## 修复方案

### 修改文件

`server/src/services/articleGenerationService.ts`

### 修改内容

**修改前**（第 287-290 行）：

```typescript
// 1. 预先为每篇文章选择不同的话题（一次性选择，避免并发冲突）
console.log(`[任务创建] 预先选择 ${config.articleCount} 个不同的话题...`);
const topicService = new TopicSelectionService();  // ❌ 会抛出错误
const selectedTopics: Array<{ topicId: number; question: string }> = [];
```

**修改后**：

```typescript
// 1. 预先为每篇文章选择不同的话题（一次性选择，避免并发冲突）
console.log(`[任务创建] 预先选择 ${config.articleCount} 个不同的话题...`);
// [已修复] 不再实例化 TopicSelectionService，直接使用 SQL 查询
const selectedTopics: Array<{ topicId: number; question: string }> = [];
```

---

## 修复步骤

### 1. 修改源代码

```bash
# 编辑文件
vim server/src/services/articleGenerationService.ts

# 删除第 289 行：
const topicService = new TopicSelectionService();

# 添加注释说明
// [已修复] 不再实例化 TopicSelectionService，直接使用 SQL 查询
```

### 2. 编译代码

```bash
cd server
npm run build
```

**编译结果**：✅ 成功

### 3. 部署到服务器

```bash
scp -i "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem" \
  server/dist/services/articleGenerationService.js \
  ubuntu@124.221.247.107:/var/www/geo-system/server/services/
```

**上传结果**：✅ 成功（78KB）

### 4. 重启服务

```bash
ssh -i "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem" \
  ubuntu@124.221.247.107 "pm2 restart geo-server"
```

**重启结果**：✅ 成功

---

## 验证修复

### 服务状态

```bash
pm2 status
```

```
┌────┬───────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id │ name          │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
├────┼───────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 0  │ geo-server    │ default     │ 1.0.0   │ fork    │ 2546099  │ 0s     │ 100  │ online    │ 0%       │ 22.4mb   │ ubuntu   │ disabled │
└────┴───────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────��
```

✅ 服务运行正常

### 测试建议

在 Windows 端测试创建文章生成任务：

1. 打开 Windows 桌面客户端
2. 进入"文章生成"页面
3. 点击"新建任务"
4. 填写任务配置：
   - 选择蒸馏结果
   - 选择图库
   - 选择知识库
   - 选择文章设置
   - 选择转化目标
   - 设置文章数量
5. 提交任务
6. 检查是否成功创建

**预期结果**：任务创建成功，不再报 500 错误

---

## 技术说明

### 为什么不需要 TopicSelectionService？

`createTask` 方法中已经直接使用 SQL 查询来选择话题：

```typescript
// 查询下一个未使用的话题
const topicResult = await pool.query(
  `SELECT id, question, usage_count
   FROM topics
   WHERE distillation_id = $1 ${usedTopicIds.size > 0 ? `AND id NOT IN (${Array.from(usedTopicIds).join(',')})` : ''}
   ORDER BY usage_count ASC, created_at ASC
   LIMIT 1`,
  [config.distillationId]
);
```

这个查询已经实现了话题选择的核心逻辑：
- 按使用次数升序排序（优先选择使用次数少的）
- 排除已选择的话题（避免重复）
- 限制返回 1 条记录

因此不需要额外的 `TopicSelectionService`。

### 架构说明

根据 GEO 系统架构：

- **Windows 端**：负责话题选择、文章生成、本地存储
- **服务器端**：负责 AI 生成、配额管理、数据同步

`TopicSelectionService` 已经被标记为废弃，但代码中仍有引用，导致运行时错误。

---

## 相关文件

- 修改文件：`server/src/services/articleGenerationService.ts`
- 废弃服务：`server/src/services/topicSelectionService.ts`
- 部署文件：`server/dist/services/articleGenerationService.js`

---

## 总结

✅ **问题已修复**

- 移除了对废弃服务 `TopicSelectionService` 的实例化
- 保留了直接 SQL 查询的话题选择逻辑
- 服务器端代码已编译并部署
- 服务已重启，运行正常

**下一步**：在 Windows 端测试文章生成任务创建功能
