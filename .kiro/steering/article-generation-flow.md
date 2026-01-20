# 文章生成技术路线和完整流程

**更新日期**: 2026-01-20  
**状态**: ✅ 已验证

---

## 📋 核心架构

**混合架构**：Windows 桌面客户端（本地数据 + UI） + 云端服务器（AI 生成 + 配额管理）

### 架构特点

- **Windows 端**：负责数据管理、UI 交互、本地永久存储
- **服务器端**：负责 AI 生成、配额管理、任务调度、临时缓存
- **通信方式**：HTTP API（两个独立的 PostgreSQL 数据库）

---

## 1️⃣ 数据准备阶段

### 需要的数据及存储位置

| 数据类型 | 存储位置 | 数据库表 | 说明 |
|---------|---------|---------|------|
| **蒸馏结果** | Windows 端 | `geo_windows.distillations` | 关键词 + 话题列表 |
| **话题列表** | Windows 端 | `geo_windows.topics` | 用户关心的问题 |
| **知识库文档** | Windows 端 | `geo_windows.knowledge_documents` | 企业资料、产品信息 |
| **图库图片** | Windows 端 | `geo_windows.images` | 文章配图 |
| **文章设置** | Windows 端 | `geo_windows.article_settings` | 提示词模板 |
| **转化目标** | Windows 端 | `geo_windows.conversion_targets` | 公司信息 |
| **生成任务** | 服务器端 | `geo_system.generation_tasks` | 任务状态追踪 |
| **生成的文章（临时）** | 服务器端 | `geo_system.articles` | AI 生成后临时存储 |
| **生成的文章（永久）** | Windows 端 | `geo_windows.articles` | 用户本地永久存储 ⭐ |

---

## 2️⃣ 文章生成完整流程

### 阶段 1：用户发起生成请求（Windows 端）

**位置**：`windows-login-manager/src/api/articleGenerationApi.ts`

**用户操作**：

```typescript
// 用户在 UI 选择参数
const config = {
  distillationId: 123,        // 选择的蒸馏结果
  albumId: 456,               // 选择的图库
  knowledgeBaseId: 789,       // 选择的知识库
  articleSettingId: 101,      // 选择的文章设置
  conversionTargetId: 202,    // 选择的转化目标（可选）
  articleCount: 5             // 生成数量
};

// 调用 API
await createTask(config);
```

### 阶段 2：本地数据打包（Windows 端）

**关键代码**：`windows-login-manager/src/api/articleGenerationApi.ts`

**为什么要打包？**
- Windows 端和服务器端是两个独立的 PostgreSQL 数据库
- 服务器无法直接访问 Windows 端数据
- 通过 HTTP API 传递必要的数据快照

**打包内容**：

```typescript
// 1. 提取知识库摘要（最多 3000 字）
const knowledgeSummary = await buildLocalKnowledgeSummary(knowledgeBaseId);
// 示例：【文档1】企业介绍...\n【文档2】产品特点...

// 2. 提取文章设置快照（包含提示词模板）
const articleSettingSnapshot = JSON.stringify({
  name: "SEO文章",
  prompt: "请根据关键词{keyword}和话题{topics}..."
});

// 3. 提取话题快照（所有话题列表）
const topicSnapshots = [
  "如何选择产品？",
  "产品有什么优势？",
  "使用场景有哪些？"
];

// 4. 提取蒸馏关键词
const distillationKeyword = "智能家居";
```

### 阶段 3：发送到服务器（HTTP API）

**请求**：`POST /api/article-generation/tasks`


```json
{
  "distillationId": 123,
  "albumId": 456,
  "knowledgeBaseId": 789,
  "articleSettingId": 101,
  "conversionTargetId": 202,
  "articleCount": 5,
  "resourceSource": "local",
  "knowledgeSummary": "【文档1】企业介绍...\n【文档2】产品特点...",
  "articleSettingSnapshot": "{\"name\":\"SEO文章\",\"prompt\":\"...\"}",
  "topicSnapshots": ["如何选择产品？", "产品有什么优势？", ...],
  "distillationKeyword": "智能家居"
}
```

### 阶段 4：服务器创建任务（服务器端）

**位置**：`server/src/services/ArticleGenerationService.ts` → `createTask()`

**关键逻辑**：

```typescript
// 1. 预先为每篇文章选择不同的话题（避免重复）
const selectedTopics = [];
for (let i = 0; i < articleCount; i++) {
  const topic = topicSnapshots[i]; // 从快照中取话题
  selectedTopics.push({
    topicId: null,  // 本地资源没有服务器端 ID
    question: topic
  });
}

// 2. 为每篇文章创建独立任务（每个任务生成 1 篇）
for (let i = 0; i < selectedTopics.length; i++) {
  const taskId = await pool.query(`
    INSERT INTO generation_tasks (
      distillation_keyword, knowledge_summary,
      article_setting_prompt, requested_count,
      selected_distillation_ids, user_id, status
    ) VALUES (...) RETURNING id
  `);
  
  taskIds.push(taskId);
}

// 3. 将任务加入全局队列（串行执行）
taskQueueExecutor.addTasks(taskIds);
```

**关键设计**：
- ✅ 每个任务只生成 1 篇文章
- ✅ 预先分配话题，避免并发冲突
- ✅ 串行执行，确保话题不重复

### 阶段 5：任务队列执行（服务器端）


**位置**：`server/src/services/ArticleGenerationService.ts` → `TaskQueueExecutor`

```typescript
// 全局单例队列执行器
while (taskQueue.length > 0) {
  const taskId = taskQueue.shift();
  
  // 检查任务是否被取消
  if (await getTaskStatus(taskId) === 'failed') {
    continue; // 跳过已取消的任务
  }
  
  // 执行任务
  await executeTask(taskId);
  
  // 等待 1 秒后执行下一个
  await sleep(1000);
}
```

**为什么使用队列？**
- 控制并发，避免 AI API 限流
- 串行执行，确保话题不重复
- 支持任务取消

### 阶段 6：执行单个任务（服务器端）

**位置**：`server/src/services/ArticleGenerationService.ts` → `executeTask()`

```typescript
async executeTask(taskId: number) {
  // 1. 更新状态为运行中
  await updateTaskStatus(taskId, 'running');
  
  // 2. 获取任务配置
  const task = await getTaskDetail(taskId);
  
  // 3. 解析预分配的话题
  const selectedData = JSON.parse(task.selected_distillation_ids);
  const topic = selectedData.topic; // "如何选择产品？"
  const keyword = task.distillation_keyword; // "智能家居"
  
  // 4. 获取知识库内容（从快照）
  const knowledgeContent = task.knowledgeSummary;
  
  // 5. 获取文章设置提示词（从快照）
  const articlePrompt = task.articleSettingPrompt;
  
  // 6. 获取转化目标信息
  const { companyName, companyIndustry, companyWebsite, companyAddress } 
    = await getConversionTarget(task.conversionTargetId);
  
  // 7. 获取 AI 配置
  const aiConfig = await getActiveAIConfig(); // DeepSeek/Gemini/Ollama
  
  // 8. 选择图片（均衡选择，使用次数最少的优先）
  const { imageUrl, imageId, imageSize } = await selectBalancedImage(task.albumId);
  
  // 9. 生成文章
  const result = await generateSingleArticle(...);
  
  // 10. 保存文章到服务器端（临时存储）
  if (result.success) {
    await saveArticleWithTopicTracking(...);
    await updateTaskStatus(taskId, 'completed');
  }
}
```

### 阶段 7：构建 AI 提示词（服务器端）


**位置**：`server/src/services/ArticleGenerationService.ts` → `buildPromptWithImageInstruction()`

**支持占位符替换**：

```typescript
const prompt = articlePrompt
  .replace(/{keyword}/g, keyword)           // "智能家居"
  .replace(/{topics}/g, topicsFormatted)    // "1. 如何选择产品？"
  .replace(/{topicsList}/g, topicsListText) // "如何选择产品？"
  .replace(/{companyName}/g, companyName)   // "XX科技"
  .replace(/{companyIndustry}/g, companyIndustry)
  .replace(/{companyWebsite}/g, companyWebsite)
  .replace(/{companyAddress}/g, companyAddress)
  .replace(/{knowledgeBase}/g, knowledgeContent);
```

**最终提示词示例**：

```
请根据关键词'智能家居'和话题'如何选择产品？'，
结合企业知识库内容，生成一篇 700-800 字的 SEO 文章。
文章需要自然提及公司名称'XX科技'和官网'https://...'。

【文档1】企业介绍...
【文档2】产品特点...

请按照'标题：[标题内容]'格式开始，然后是正文。
```

### 阶段 8：调用 AI 生成（服务器端）

**位置**：`server/src/services/ArticleGenerationService.ts` → `generateSingleArticle()`

```typescript
// 1. 创建 AI 服务实例
const aiService = new AIService({
  provider: 'deepseek',  // 或 'gemini', 'ollama'
  apiKey: 'sk-xxx',
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'qwen2.5:7b'
});

// 2. 调用 AI API
const response = await aiService.callAI(prompt);

// 3. 解析响应
const { title, content } = parseArticleResponse(response);

// 4. 插入图片标记
const contentWithImage = insertImageIntoContent(content, imageUrl);
// 结果：content + "\n\n![文章配图](/uploads/gallery/xxx.jpg)"

return { success: true, title, content: contentWithImage };
```

### 阶段 9：保存文章到服务器（服务器端）


**位置**：`server/src/services/ArticleGenerationService.ts` → `saveArticleWithTopicTracking()`

**使用事务确保数据一致性**：

```typescript
const client = await pool.connect();
await client.query('BEGIN');

try {
  // 1. 插入文章到服务器端（临时存储）
  const articleId = await client.query(`
    INSERT INTO articles (
      title, keyword, distillation_id, topic_id, task_id,
      content, image_url, provider, user_id, image_id,
      distillation_keyword_snapshot, topic_question_snapshot
    ) VALUES (...) RETURNING id
  `);
  
  // 2. 记录蒸馏使用
  await client.query(`
    INSERT INTO distillation_usage (distillation_id, task_id, article_id)
    VALUES (...)
  `);
  
  // 3. 更新蒸馏使用次数
  await client.query(`
    UPDATE distillations SET usage_count = usage_count + 1
    WHERE id = $1
  `);
  
  // 4. 记录话题使用
  await client.query(`
    INSERT INTO topic_usage (topic_id, distillation_id, article_id, task_id)
    VALUES (...)
  `);
  
  // 5. 更新话题使用次数
  await client.query(`
    UPDATE topics SET usage_count = usage_count + 1
    WHERE id = $1
  `);
  
  // 6. 增加图片引用计数
  await client.query('SELECT increment_image_reference($1)', [imageId]);
  
  // 7. 记录配额使用
  await usageTrackingService.recordUsage(
    userId, 'articles_per_month', 'article', articleId, 1
  );
  
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
}
```

### 阶段 10：Windows 端轮询任务状态

**位置**：`windows-login-manager/src/pages/ArticleGeneration.tsx`

```typescript
// Windows 端定时查询任务进度
const interval = setInterval(async () => {
  const task = await fetchTaskDetail(taskId);
  
  if (task.status === 'completed') {
    clearInterval(interval);
    
    // 下载文章到本地
    await downloadArticlesFromServer(taskId);
    
    message.success('文章生成完成！');
  }
  
  if (task.status === 'failed') {
    clearInterval(interval);
    message.error(task.errorMessage);
  }
}, 2000); // 每 2 秒轮询一次
```

### 阶段 11：下载文章到本地（Windows 端）

**位置**：`windows-login-manager/electron/ipc/handlers/articleHandlers.ts`

```typescript
// 从服务器获取文章列表
const articles = await apiClient.get(`/articles?taskId=${taskId}`);

// 保存到本地数据库（永久存储）
for (const article of articles.data) {
  await articleService.createArticle({
    user_id: userId,
    title: article.title,
    keyword: article.keyword,
    content: article.content,
    image_url: article.image_url,
    provider: article.provider,
    distillation_keyword_snapshot: article.keyword,
    topic_question_snapshot: article.topic
  });
}
```

---

## 3️⃣ 数据存储生命周期

### 服务器端 articles 表（临时存储）

| 阶段 | 时间 | 操作 |
|------|------|------|
| 生成后保存 | 立即 | AI 生成完成后立即保存 |
| 保留时间 | 7-30 天 | 可配置的保留期限 |
| 清理策略 | 定期 | 定期清理已下载的文章 |

### Windows 端 articles 表（永久存储）

| 阶段 | 时间 | 操作 |
|------|------|------|
| 下载后保存 | 立即 | 任务完成后立即下载 |
| 保留时间 | 永久 | 用户手动删除 |
| 备份策略 | 用户控制 | 用户可导出备份 |

---

## 4️⃣ 关键技术特点

### ✅ 数据快照机制

**问题**：Windows 端和服务器端数据库隔离

**解决**：将必要数据打包成 JSON 快照发送给服务器

**优势**：
- 删除本地数据后，服务器端文章仍能显示关键词和话题
- 服务器端不依赖 Windows 端数据库
- 支持离线创作后联网同步

### ✅ 话题预分配机制

**问题**：并发生成时可能选择重复话题

**解决**：创建任务时预先为每篇文章分配不同话题

**优势**：
- 避免并发冲突
- 确保话题多样性
- 提高文章质量

### ✅ 任务队列串行执行

**问题**：并发调用 AI API 可能超限

**解决**：全局单例队列，串行执行任务

**优势**：
- 控制并发，避免 API 限流
- 支持任务取消
- 便于错误处理

### ✅ 图片均衡选择

**问题**：随机选择导致部分图片使用过多

**解决**：选择使用次数最少的图片

**实现**：
```sql
SELECT id, filepath, size, usage_count
FROM images
WHERE album_id = $1
ORDER BY usage_count ASC, created_at ASC
LIMIT 1
```

**优势**：
- 图片使用更均衡
- 避免重复使用同一张图片
- 提升文章多样性

### ✅ 事务保证一致性

**问题**：保存文章时可能部分失败

**解决**：使用数据库事务，全部成功或全部回滚

**优势**：
- 数据一致性
- 避免脏数据
- 便于错误恢复

### ✅ 占位符模板系统

**支持的占位符**：
- `{keyword}` - 核心关键词
- `{topics}` - 话题列表（带编号）
- `{topicsList}` - 话题列表（纯文本）
- `{companyName}` - 公司名称
- `{companyIndustry}` - 行业类型
- `{companyWebsite}` - 官方网站
- `{companyAddress}` - 公司地址
- `{knowledgeBase}` - 知识库内容

**优势**：
- 用户可完全自定义提示词
- 灵活控制文章风格
- 支持多种场景

---

## 5️⃣ 数据流向图

```
Windows 端                          服务器端
┌─────────────────┐                ┌─────────────────┐
│ 1. 用户选择参数  │                │                 │
│   - 蒸馏结果     │                │                 │
│   - 图库         │                │                 │
│   - 知识库       │                │                 │
│   - 文章设置     │                │                 │
│   - 转化目标     │                │                 │
└────────┬────────┘                │                 │
         │                          │                 │
         ▼                          │                 │
┌─────────────────┐                │                 │
│ 2. 打包数据快照  │                │                 │
│   - 知识库摘要   │                │                 │
│   - 文章设置快照 │                │                 │
│   - 话题快照     │                │                 │
│   - 蒸馏关键词   │                │                 │
└────────┬────────┘                │                 │
         │                          │                 │
         │ HTTP POST                │                 │
         └─────────────────────────>│ 3. 创建任务     │
                                    │   - 预分配话题  │
                                    │   - 加入队列    │
                                    └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │ 4. 执行任务     │
                                    │   - 构建提示词  │
                                    │   - 调用 AI     │
                                    │   - 解析响应    │
                                    │   - 插入图片    │
                                    └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │ 5. 保存文章     │
                                    │   (临时存储)    │
                                    │   - 插入数据库  │
                                    │   - 更新计数    │
                                    │   - 记录配额    │
                                    └────────┬────────┘
                                             │
         ┌───────────────────────────────────┘
         │ HTTP GET (轮询)
         ▼
┌─────────────────┐
│ 6. 查询任务状态  │
│   - 进度更新     │
│   - 完成通知     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 7. 下载文章     │
│   - 获取内容     │
│   - 保存到本地   │
│   (永久存储)     │
└─────────────────┘
```

---

## 6️⃣ 错误处理和容错

### 任务取消机制

```typescript
// 用户可以随时取消任务
await cancelTask(taskId);

// 服务器端检查任务状态
if (await getTaskStatus(taskId) === 'failed') {
  return; // 停止执行
}
```

### 部分成功处理

```typescript
// 如果生成 5 篇文章，成功 3 篇，失败 2 篇
if (generatedCount > 0) {
  // 标记为完成，用户可以看到已生成的文章
  await updateTaskStatus(taskId, 'completed', generatedCount);
} else {
  // 全部失败才标记为失败
  await updateTaskStatus(taskId, 'failed', 0, errorMessage);
}
```

### 网络中断恢复

```typescript
// Windows 端可以重新下载文章
if (task.status === 'completed' && !hasLocalArticles) {
  await downloadArticlesFromServer(taskId);
}
```

---

## 7️⃣ 性能优化

### 批量操作

- 批量查询话题（一次性加载所有话题）
- 批量保存文章（使用事务）
- 批量更新计数（原子操作）

### 缓存策略

- AI 配置缓存（避免重复查询）
- 图片选择缓存（减少数据库查询）
- 任务状态缓存（减少轮询压力）

### 并发控制

- 全局队列限制并发数
- 任务间隔 1 秒（避免 API 限流）
- 支持任务优先级（未实现）

---

## 8️⃣ 常见问题

### Q1: 为什么文章要先保存到服务器再下载到本地？

**A**: 
- AI 生成在服务器端执行（需要 API 密钥）
- 服务器端作为临时缓存，防止网络中断导致文章丢失
- 支持多设备同步（未来功能）

### Q2: 如果 Windows 端下载失败怎么办？

**A**: 
- 服务器端保留文章 7-30 天
- 用户可以重新下载
- 任务状态会显示"已完成但未下载"

### Q3: 为什么使用数据快照而不是直接传 ID？

**A**: 
- Windows 端和服务器端是两个独立的数据库
- 服务器无法通过 ID 查询 Windows 端数据
- 快照确保删除本地数据后服务器端仍能显示

### Q4: 话题会重复使用吗？

**A**: 
- 不会。每个任务预先分配不同的话题
- 如果话题不足，会提示用户
- 话题使用次数会记录，便于统计

### Q5: 可以同时生成多个任务吗？

**A**: 
- 可以创建多个任务
- 但会串行执行（全局队列）
- 避免 AI API 限流

---

## 9️⃣ 相关文件索引

### Windows 端

- **API 调用**：`windows-login-manager/src/api/articleGenerationApi.ts`
- **文章服务**：`windows-login-manager/electron/services/ArticleService.ts`
- **IPC 处理**：`windows-login-manager/electron/ipc/handlers/articleHandlers.ts`
- **UI 页面**：`windows-login-manager/src/pages/ArticleGeneration.tsx`

### 服务器端

- **路由**：`server/src/routes/articleGeneration.ts`
- **服务**：`server/src/services/ArticleGenerationService.ts`
- **AI 服务**：`server/src/services/aiService.ts`
- **内容清理**：`server/src/services/contentCleaner.ts`
- **图片选择**：`server/src/services/imageSelectionService.ts`

### 数据库

- **服务器端迁移**：`server/src/db/migrations/`
- **Windows 端迁移**：`windows-login-manager/electron/database/migrations/`

---

## 🔟 总结

GEO 系统的文章生成采用了**混合架构**：

- **Windows 端**：负责数据管理、UI 交互、本地永久存储
- **服务器端**：负责 AI 生成、配额管理、任务调度、临时缓存

通过**数据快照机制**实现了两端的数据隔离，通过**任务队列**实现了并发控制，通过**事务机制**保证了数据一致性。

整个流程设计精巧，既保证了用户数据隐私（本地存储），又充分利用了云端 AI 能力（集中生成）。

**核心优势**：
- ✅ 离线可用（本地永久存储）
- ✅ 数据隐私（敏感数据本地化）
- ✅ 容错性强（服务器临时缓存）
- ✅ 性能优化（队列控制、批量操作）
- ✅ 灵活扩展（支持多种 AI 提供商）
