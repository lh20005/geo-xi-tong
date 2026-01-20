# 文章自动同步问题修复报告

**日期**: 2026-01-20  
**问题**: 生成的文章没有自动同步到本地数据库  
**用户**: aizhiruan (user_id: 1)

---

## 问题分析

### 症状

- 服务器端：18 篇文章，最新的是 `2026-01-20 10:15:40`
- Windows 端：13 篇文章，最新的是 `2026-01-19 18:29:32`
- 缺失：5 篇文章（今天生成的）

### 缺失的文章

| ID | 标题 | 任务 ID | 创建时间 |
|----|------|---------|----------|
| 57 | 2026法国留学机构排名：这5家专业实力最强 | 69 | 2026-01-20 08:42:25 |
| 58 | 2026年澳大利亚留学机构排名，这5家实力最强 | 70 | 2026-01-20 09:30:37 |
| 59 | 2026年澳大利亚留学，这5家杭州机构你必须知道 | 71 | 2026-01-20 09:47:38 |
| 60 | 2026澳大利亚留学机构排名：这5家实力最强！ | 72 | 2026-01-20 09:58:57 |
| 61 | 2026法国留学机构TOP榜：这5家实力与口碑并存 | 73 | 2026-01-20 10:15:40 |

---

## 根本原因

### 1. 自动同步逻辑依赖内存状态

**位置**: `windows-login-manager/src/pages/ArticleGenerationPage.tsx`

```typescript
// 记录已同步的文章ID，避免重复检查
const syncedTaskArticlesRef = useMemo(() => new Map<number, Set<number>>(), []);
```

**问题**:
- `syncedTaskArticlesRef` 是内存中的数据
- 页面刷新后会丢失
- 如果用户在文章生成完成前关闭了页面，再次打开时不会重新同步

### 2. 自动同步触发条件

```typescript
const autoSyncTasks = useCallback(async (taskList: GenerationTask[]) => {
  const syncableTasks = taskList.filter(
    (task) => (task.status === 'completed' || task.status === 'running') && task.generatedCount > 0
  );
  // ...
}, [syncedTaskArticlesRef, invalidateCacheByPrefix]);
```

**问题**:
- 只在页面加载时触发一次
- 如果页面加载时任务还在运行中，可能会错过同步时机
- 轮询间隔可能不够频繁

### 3. 服务器端接口正常

服务器端的 `/api/article-generation/tasks/:id` 接口**已经正确返回** `generatedArticles` 字段，所以问题不在服务器端。

---

## 临时修复方案

### 已执行的修复

使用 SSH 和 PostgreSQL 直接同步数据：

```bash
# 1. 从服务器导出缺失的文章
ssh ubuntu@124.221.247.107 "sudo -u postgres psql -d geo_system -c \"\\COPY (SELECT user_id, title, keyword, content, image_url, provider, distillation_keyword_snapshot, topic_question_snapshot, task_id, created_at FROM articles WHERE id IN (57, 58, 59, 60, 61) ORDER BY id) TO '/tmp/missing_articles.csv' WITH CSV HEADER;\""

# 2. 下载到本地
scp -i "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem" ubuntu@124.221.247.107:/tmp/missing_articles.csv /tmp/missing_articles.csv

# 3. 导入到本地数据库
psql -U lzc -d geo_windows -c "\COPY articles (user_id, title, keyword, content, image_url, provider, distillation_keyword_snapshot, topic_question_snapshot, task_id, created_at) FROM '/tmp/missing_articles.csv' WITH CSV HEADER;"
```

**结果**: ✅ 5 篇文章已成功同步到本地数据库

---

## 长期修复方案

### 方案 1: 改进自动同步逻辑（推荐）

**修改文件**: `windows-login-manager/src/pages/ArticleGenerationPage.tsx`

**改进点**:

1. **持久化同步状态**
   ```typescript
   // 使用本地数据库记录已同步的文章
   const checkArticleSynced = async (taskId: number, articleId: number) => {
     const result = await localArticleApi.checkArticleExists(taskId, articleTitle);
     return result.data?.exists;
   };
   ```

2. **增加同步重试机制**
   ```typescript
   // 如果同步失败，记录到队列中，定期重试
   const syncQueue = new Set<{ taskId: number; articleId: number }>();
   ```

3. **增加手动同步按钮**
   ```typescript
   // 在 UI 上添加"同步文章"按钮，允许用户手动触发同步
   <Button onClick={handleManualSync}>同步文章</Button>
   ```

### 方案 2: 服务器端推送通知

**实现方式**:
- 使用 WebSocket 推送文章生成完成的通知
- Windows 端收到通知后立即同步

**优点**:
- 实时性更好
- 不依赖轮询

**缺点**:
- 需要修改服务器端代码
- 增加系统复杂度

### 方案 3: 定期全量同步

**实现方式**:
- 每次打开应用时，检查服务器端是否有新文章
- 定期（如每小时）执行一次全量同步

**优点**:
- 简单可靠
- 不会遗漏文章

**缺点**:
- 可能产生重复同步
- 网络开销较大

---

## 推荐实施步骤

### 第一阶段：快速修复（已完成）

- [x] 手动同步缺失的 5 篇文章
- [x] 验证数据完整性

### 第二阶段：改进自动同步（待实施）

1. **添加手动同步按钮**
   - 位置：文章生成页面顶部
   - 功能：点击后检查所有已完成任务，同步缺失的文章

2. **改进自动同步逻辑**
   - 使用数据库检查文章是否存在（而不是内存状态）
   - 增加同步失败重试机制
   - 增加同步日志记录

3. **添加同步状态提示**
   - 显示"正在同步 X 篇文章"
   - 显示"同步完成"或"同步失败"

### 第三阶段：优化用户体验（可选）

1. **添加同步历史记录**
   - 记录每次同步的时间和结果
   - 允许用户查看同步日志

2. **添加冲突处理**
   - 如果本地和服务器端都有同名文章，提示用户选择保留哪个

3. **添加离线模式提示**
   - 如果网络断开，提示用户"文章将在联网后自动同步"

---

## 验证结果

### 同步前

```sql
SELECT COUNT(*) as total, MAX(created_at) as latest 
FROM articles WHERE user_id = 1;
-- total: 13, latest: 2026-01-19 18:29:32
```

### 同步后

```sql
SELECT COUNT(*) as total, MAX(created_at) as latest 
FROM articles WHERE user_id = 1;
-- total: 18, latest: 2026-01-20 10:15:40
```

✅ **验证通过**：5 篇缺失的文章已成功同步

---

## 相关文件

- **Windows 端页面**: `windows-login-manager/src/pages/ArticleGenerationPage.tsx`
- **Windows 端 API**: `windows-login-manager/src/api/articleGenerationApi.ts`
- **服务器端路由**: `server/src/routes/articleGeneration.ts`
- **服务器端服务**: `server/src/services/articleGenerationService.ts`

---

## 总结

**问题已修复**：5 篇缺失的文章已手动同步到本地数据库。

**建议后续改进**：
1. 添加手动同步按钮（优先级：高）
2. 改进自动同步逻辑，使用数据库检查而不是内存状态（优先级：高）
3. 添加同步失败重试机制（优先级：中）
4. 添加同步状态提示和日志（优先级：中）

**预防措施**：
- 定期检查服务器端和本地数据库的文章数量是否一致
- 在文章生成页面添加"数据同步状态"指示器
- 考虑实现 WebSocket 推送通知机制
