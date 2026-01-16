# Windows 端迁移到 PostgreSQL 完整计划

## 🎯 架构说明（重要）

### 当前架构和迁移范围

```
┌─────────────────────────────────────────────────────────────────┐
│                    Windows 桌面客户端                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  React 前端界面                                            │   │
│  │  - 发起 AI 生成请求 ────────────────────┐                 │   │
│  │  - 显示生成结果                          │                 │   │
│  └──────────────────────────────────────────┼─────────────────┘   │
│                                              │                     │
│  ┌──────────────────────────────────────────▼─────────────────┐   │
│  │  本地数据存储（⚠️ 迁移重点）                                │   │
│  │  ┌────────────┐         ┌────────────┐                    │   │
│  │  │  SQLite    │  ═══>   │ PostgreSQL │                    │   │
│  │  │  (旧)      │  迁移    │  (新)      │                    │   │
│  │  └────────────┘         └────────────┘                    │   │
│  │  - 保存文章 ✅ 需要修改                                     │   │
│  │  - 知识库、图库、平台账号等 ✅ 需要修改                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS API 调用
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      服务器端（不受迁移影响）                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  AI 生成服务 ❌ 不需要修改                                  │   │
│  │  - 接收生成请求                                            │   │
│  │  - 预扣减配额                                              │   │
│  │  - 调用 DeepSeek/Gemini API                               │   │
│  │  - 缓存结果到 Redis                                        │   │
│  │  - 返回生成结果                                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  PostgreSQL 数据库                                         │   │
│  │  - 用户管理                                                │   │
│  │  - 配额管理                                                │   │
│  │  - 订阅系统                                                │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 🔑 关键点

1. **AI 生成在服务器端** ❌ 不需要迁移
   - DeepSeek/Gemini API 调用在服务器
   - API 密钥安全存储在服务器
   - 配额管理在服务器

2. **Windows 端只负责** ✅ 需要迁移
   - 发起生成请求
   - 接收生成结果
   - **保存到本地数据库** ⬅️ 从 SQLite 改为 PostgreSQL

3. **迁移影响范围**
   - ✅ 数据库层：SQLite → PostgreSQL
   - ✅ 服务层：同步 → 异步
   - ✅ IPC 处理器：添加 async/await
   - ❌ AI 生成逻辑：不受影响

---

## 📋 概述

**目标**: 将 Windows 桌面客户端从 SQLite 迁移到 PostgreSQL，实现客户端和服务器使用统一数据库，解决跨数据库引用问题。

**迁移策略**: 从服务器 PostgreSQL 数据库导出 schema 和数据，在 Windows 端创建本地 PostgreSQL 实例。

**关键优势**:
- ✅ 统一数据库类型，消除跨数据库引用问题
- ✅ 支持外键约束和事务完整性
- ✅ 使用 PostgreSQL 逻辑复制实现数据同步
- ✅ 保留服务器现有数据和 schema

---

## ⚠️ 重要说明：AI 生成功能位置

### 🎯 AI 生成在服务器端（不受迁移影响）

**当前架构**：
- ✅ **服务器端**：执行 AI 生成（DeepSeek/Gemini/Ollama API 调用）
- ✅ **Windows 端**：只负责发起请求和保存结果

**为什么在服务器端**：
1. **API 密钥安全**：DeepSeek/Gemini API 密钥不能暴露在客户端
2. **配额管理**：服务器统一管理和扣减配额
3. **成本控制**：服务器端监控和限制 API 调用成本

**迁移影响**：
- ❌ **AI 生成逻辑不需要修改**（仍在服务器端）
- ✅ **只需修改 Windows 端保存文章的数据库操作**（从 SQLite 改为 PostgreSQL）

**工作流程**：
```
Windows 端 (PostgreSQL)  →  服务器 (PostgreSQL)
    ↓                           ↓
1. 发起生成请求              2. 预扣减配额
    ↓                           ↓
                            3. 调用 AI API (DeepSeek/Gemini)
    ↓                           ↓
                            4. 缓存结果到 Redis
    ↓                           ↓
5. 接收生成结果              6. 返回 generationId + 文章
    ↓                           ↓
7. 保存到本地 PostgreSQL ⬅️ 这里需要修改
```

---

## 🎯 迁移目标

### 1. 技术目标
- Windows 端集成嵌入式 PostgreSQL
- 从服务器导出完整 schema 和用户数据
- 替换所有 SQLite 相关代码
- 实现 PostgreSQL 逻辑复制

### 2. 数据目标
- 迁移用户核心数据（文章、知识库、图库、平台账号等）
- 保留服务器端管理数据（订阅、配额、订单等）
- 确保数据完整性和一致性

---

## 📊 服务器数据库分析

### 服务器表清单（66 个表）

**核心业务表（需要迁移到 Windows 端）**:

1. `articles` - 文章（⚠️ 保存 AI 生成结果的地方）
2. `albums` - 相册
3. `images` - 图片
4. `knowledge_bases` - 知识库
5. `knowledge_documents` - 知识文档
6. `platform_accounts` - 平台账号
7. `publishing_tasks` - 发布任务
8. `publishing_records` - 发布记录
9. `publishing_logs` - 发布日志
10. `conversion_targets` - 转化目标
11. `distillations` - 蒸馏记录
12. `topics` - 话题
13. `article_settings` - 文章设置
14. `distillation_config` - 蒸馏配置
15. `image_usage` - 图片使用追踪

**服务器专用表（保留在服务器）**:
- `users` - 用户管理
- `subscription_plans` - 订阅套餐
- `user_subscriptions` - 用户订阅
- `orders` - 订单
- `quota_configs` - 配额配置
- `quota_reservations` - 配额预留（⚠️ AI 生成时使用）
- `generation_tasks` - AI 生成任务队列（⚠️ 服务器端管理）
- `admin_logs` - 管理日志
- `audit_logs` - 审计日志
- `security_*` - 安全相关表
- 其他管理和统计表

**🔑 关键说明**：
- `articles` 表在 Windows 端：存储 AI 生成的文章结果
- AI 生成逻辑在服务器端：调用 DeepSeek/Gemini API
- `quota_reservations` 在服务器端：管理配额预扣减

---

## 🔧 技术方案

### 1. Windows 端 PostgreSQL 集成

**方案选择**: 使用 `pg-embed` 或 `postgresql-portable`

#### 推荐方案: pg-embed


```bash
npm install pg-embed --save
```

**优势**:
- 自动下载和管理 PostgreSQL 二进制文件
- 跨平台支持（Windows/Mac/Linux）
- 简单的 API
- 适合 Electron 应用

**配置示例**:
```typescript
import PgEmbed from 'pg-embed';

const pgEmbed = new PgEmbed({
  databaseDir: path.join(app.getPath('userData'), 'postgres-data'),
  user: 'geo_user',
  password: 'local_password',
  port: 5433, // 避免与系统 PostgreSQL 冲突
  persistent: true
});

await pgEmbed.start();
```

### 2. 数据迁移策略

#### 阶段 1: Schema 导出
从服务器导出核心业务表的 schema：

```bash
# 导出指定表的 schema
pg_dump -h 124.221.247.107 -U geo_user -d geo_system \
  --schema-only \
  --table=articles \
  --table=albums \
  --table=images \
  --table=knowledge_bases \
  --table=knowledge_documents \
  --table=platform_accounts \
  --table=publishing_tasks \
  --table=publishing_records \
  --table=publishing_logs \
  --table=conversion_targets \
  --table=distillations \
  --table=topics \
  --table=article_settings \
  --table=distillation_config \
  --table=image_usage \
  > windows_schema.sql
```

#### 阶段 2: 数据导出
导出当前用户的数据：

```bash
# 导出指定用户的数据
pg_dump -h 124.221.247.107 -U geo_user -d geo_system \
  --data-only \
  --table=articles \
  --table=albums \
  --table=images \
  --table=knowledge_bases \
  --table=knowledge_documents \
  --table=platform_accounts \
  --table=publishing_tasks \
  --table=publishing_records \
  --table=publishing_logs \
  --table=conversion_targets \
  --table=distillations \
  --table=topics \
  --table=article_settings \
  --table=distillation_config \
  --table=image_usage \
  --where="user_id = 1" \
  > user_data.sql
```

#### 阶段 3: Schema 调整
调整 schema 以适应本地环境：

1. **移除服务器专用约束**
2. **调整序列和默认值**
3. **添加本地专用表**

---

## 📝 需要修改的文件清单

### 1. 数据库层文件（完全重写）

#### `windows-login-manager/electron/database/`


- ❌ **删除**: `sqlite.ts` - SQLite 管理器
- ✅ **新建**: `postgres.ts` - PostgreSQL 管理器
- ✅ **新建**: `migrations/` - PostgreSQL 迁移文件目录
- ✅ **修改**: 所有迁移文件从 SQLite 语法转换为 PostgreSQL 语法

**关键变更**:
```typescript
// 旧: SQLite
import Database from 'better-sqlite3';
const db = new Database(dbPath);

// 新: PostgreSQL
import { Pool } from 'pg';
const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'geo_local',
  user: 'geo_user',
  password: 'local_password'
});
```

### 2. 服务层文件（修改查询语法）

#### `windows-login-manager/electron/services/`

所有服务类需要修改：

- ✅ `BaseService.ts` - 基础服务类（完全重写）
- ✅ `ArticleService.ts` - 文章服务（⚠️ 保存 AI 生成结果）
- ✅ `AlbumService.ts` - 相册服务
- ✅ `ImageService.ts` - 图片服务
- ✅ `KnowledgeBaseService.ts` - 知识库服务
- ✅ `PlatformAccountService.ts` - 平台账号服务
- ✅ `PublishingTaskService.ts` - 发布任务服务
- ✅ `PublishingRecordService.ts` - 发布记录服务
- ✅ `DistillationService.ts` - 蒸馏服务
- ✅ `TopicService.ts` - 话题服务
- ✅ `ArticleSettingService.ts` - 文章设置服务
- ✅ `ConversionTargetService.ts` - 转化目标服务

**⚠️ 特别注意 - ArticleService**：
- 这是保存 AI 生成文章的地方
- AI 生成逻辑在服务器端（不需要修改）
- 只需修改保存文章到数据库的操作（从 SQLite 改为 PostgreSQL）

**关键变更**:
```typescript
// 旧: SQLite 同步查询
const result = this.db.prepare('SELECT * FROM articles WHERE id = ?').get(id);

// 新: PostgreSQL 异步查询
const result = await this.pool.query('SELECT * FROM articles WHERE id = $1', [id]);
return result.rows[0];
```

### 3. IPC 处理器（添加 async/await）

#### `windows-login-manager/electron/ipc/handlers/`

所有 IPC 处理器需要修改为异步：

- ✅ `articleHandlers.ts`
- ✅ `albumHandlers.ts`
- ✅ `imageHandlers.ts`
- ✅ `knowledgeBaseHandlers.ts`
- ✅ `platformAccountHandlers.ts`
- ✅ `publishingHandlers.ts`
- ✅ `distillationHandlers.ts`
- ✅ `topicHandlers.ts`
- ✅ `settingsHandlers.ts`

**关键变更**:
```typescript
// 旧: 同步处理
ipcMain.handle('article:findById', (event, id) => {
  return articleService.findById(id);
});

// 新: 异步处理
ipcMain.handle('article:findById', async (event, id) => {
  return await articleService.findById(id);
});
```

### 4. 依赖包更新

#### `windows-login-manager/package.json`

```json
{
  "dependencies": {
    // 移除
    // "better-sqlite3": "^12.6.0",
    
    // 添加
    "pg": "^8.11.3",
    "pg-embed": "^0.1.0",
    "@types/pg": "^8.10.9"
  }
}
```

### 5. 主进程初始化

#### `windows-login-manager/electron/main.ts`

```typescript
// 旧: 初始化 SQLite
import { sqliteManager } from './database/sqlite';
await sqliteManager.initialize();

// 新: 初始化 PostgreSQL
import { postgresManager } from './database/postgres';
await postgresManager.initialize();
```

---

## 🔄 SQL 语法转换对照表

### 数据类型转换

| SQLite | PostgreSQL | 说明 |
|--------|-----------|------|
| `TEXT` | `TEXT` / `VARCHAR(n)` | 文本 |
| `INTEGER` | `INTEGER` / `SERIAL` | 整数 |
| `REAL` | `REAL` / `NUMERIC` | 浮点数 |
| `BLOB` | `BYTEA` | 二进制 |
| `INTEGER (0/1)` | `BOOLEAN` | 布尔值 |
| `TEXT (ISO 8601)` | `TIMESTAMP` | 时间戳 |

### 语法差异

| 功能 | SQLite | PostgreSQL |
|------|--------|-----------|
| 自增主键 | `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` |
| UUID | `TEXT` | `UUID` |
| 当前时间 | `datetime('now')` | `NOW()` |
| 参数占位符 | `?` | `$1, $2, $3` |
| 字符串连接 | `\|\|` | `\|\|` 或 `CONCAT()` |
| LIMIT | `LIMIT ? OFFSET ?` | `LIMIT $1 OFFSET $2` |
| 布尔值 | `0/1` | `TRUE/FALSE` |

### 查询示例转换

**SQLite**:
```sql
SELECT * FROM articles 
WHERE user_id = ? AND is_published = 1
ORDER BY created_at DESC
LIMIT ? OFFSET ?
```

**PostgreSQL**:
```sql
SELECT * FROM articles 
WHERE user_id = $1 AND is_published = TRUE
ORDER BY created_at DESC
LIMIT $2 OFFSET $3
```

---

## 📋 数据迁移详细规划

### 完整的表、列、函数、触发器清单

**详细审计文档**: 
- `数据库完整审计和迁移清单-详细版.md` - 包含所有表的完整结构
- `PostgreSQL迁移数据清单.md` - 包含迁移步骤和注意事项

#### 需要迁移的表（17 个）

| # | 表名 | 列数 | 索引数 | 触发器数 | 外键数 | 数据量估算 | 优先级 |
|---|------|------|--------|---------|--------|-----------|--------|
| 1 | articles | 20 | 13 | 2 | 5 | 100-1000 | 高 |
| 2 | albums | 5 | 3 | 0 | 1 | 5-20 | 高 |
| 3 | images | 12 | 8 | 0 | 2 | 50-500 | 高 |
| 4 | knowledge_bases | 6 | 3 | 0 | 1 | 5-20 | 高 |
| 5 | knowledge_documents | 7 | 2 | 0 | 1 | 20-100 | 高 |
| 6 | platform_accounts | 15 | 5 | 0 | 1 | 5-15 | 高 |
| 7 | publishing_tasks | 20 | 8 | 0 | 3 | 100-1000 | 高 |
| 8 | publishing_records | 18 | 6 | 0 | 3 | 100-1000 | 高 |
| 9 | publishing_logs | 6 | 2 | 0 | 1 | 1000-10000 | 中 |
| 10 | conversion_targets | 12 | 2 | 0 | 1 | 1-10 | 中 |
| 11 | distillations | 6 | 3 | 0 | 1 | 50-200 | 高 |
| 12 | topics | 7 | 4 | 0 | 2 | 500-2000 | 高 |
| 13 | article_settings | 5 | 2 | 0 | 1 | 5-20 | 中 |
| 14 | distillation_config | 6 | 2 | 0 | 1 | 1-5 | 中 |
| 15 | image_usage | 4 | 3 | 0 | 2 | 50-500 | 中 |
| 16 | distillation_usage | 4 | 3 | 0 | 2 | 100-1000 | 中 |
| 17 | topic_usage | 4 | 3 | 0 | 2 | 500-2000 | 中 |

**总计**: 约 2500-20000 条记录，10-100 MB（不含图片文件）

#### 需要迁移的函数（8 个）

| # | 函数名 | 返回类型 | 用途 | 被哪些表使用 |
|---|--------|---------|------|-------------|
| 1 | sync_article_distillation_snapshot | TRIGGER | 同步文章蒸馏快照 | articles (触发器) |
| 2 | update_article_image_size | TRIGGER | 更新文章图片大小 | articles (触发器) |
| 3 | increment_image_reference | VOID | 增加图片引用计数 | 代码调用 |
| 4 | decrement_image_reference | VOID | 减少图片引用计数 | 代码调用 |
| 5 | soft_delete_image | VOID | 软删除图片 | 代码调用 |
| 6 | is_image_referenced | BOOLEAN | 检查图片是否被引用 | 代码调用 |
| 7 | sync_topic_keyword_snapshot | TRIGGER | 同步话题关键词快照 | topics (触发器) |
| 8 | update_updated_at_column | TRIGGER | 自动更新 updated_at | 多个表 (触发器) |

#### 关键表结构详情

**1. articles（文章表）⭐ 最重要**

```sql
-- 20 列
id                            INTEGER (SERIAL)
user_id                       INTEGER NOT NULL
title                         VARCHAR(500)
keyword                       VARCHAR(255) NOT NULL
distillation_id               INTEGER
topic_id                      INTEGER
task_id                       INTEGER  -- ⚠️ 需要设为 NULL
image_id                      INTEGER
requirements                  TEXT
content                       TEXT NOT NULL
image_url                     VARCHAR(500)
image_size_bytes              INTEGER DEFAULT 0
provider                      VARCHAR(20) NOT NULL
is_published                  BOOLEAN DEFAULT false
publishing_status             VARCHAR(20)
published_at                  TIMESTAMP
distillation_keyword_snapshot VARCHAR(255)
topic_question_snapshot       TEXT
created_at                    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at                    TIMESTAMP DEFAULT CURRENT_TIMESTAMP

-- 13 个索引
-- 2 个触发器
-- 5 个外键（需要调整）
```

**2. images（图片表）⭐ 重要**

```sql
-- 12 列
id              INTEGER (SERIAL)
user_id         INTEGER
album_id        INTEGER
filename        VARCHAR(255) NOT NULL
filepath        VARCHAR(500) NOT NULL  -- ⚠️ 需要调整路径
mime_type       VARCHAR(50) NOT NULL
size            INTEGER NOT NULL
usage_count     INTEGER DEFAULT 0
deleted_at      TIMESTAMP
is_orphan       BOOLEAN DEFAULT false
reference_count INTEGER DEFAULT 0
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP

-- 8 个索引
-- 软删除和孤儿文件机制
```

**3. platform_accounts（平台账号表）⭐ 敏感数据**

```sql
-- 约 15 列
id              TEXT (UUID)
user_id         INTEGER NOT NULL
platform        VARCHAR(50) NOT NULL
platform_id     VARCHAR(255)
account_name    VARCHAR(255)
real_username   VARCHAR(255)
credentials     TEXT  -- ⚠️ 加密存储
cookies         TEXT  -- ⚠️ 加密存储
status          VARCHAR(20) DEFAULT 'inactive'
is_default      BOOLEAN DEFAULT false
error_message   TEXT
last_used_at    TIMESTAMP
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

#### 需要调整的外键约束

**问题外键**（需要移除）:

1. **articles.task_id → generation_tasks(id)**
   - 原因: `generation_tasks` 表保留在服务器（AI 生成任务队列）
   - 解决: 移除外键约束，保留字段，迁移时设为 NULL
   - SQL: `ALTER TABLE articles DROP CONSTRAINT articles_task_id_fkey;`

2. **所有表的 user_id → users(id)**
   - 原因: `users` 表保留在服务器
   - 解决: 移除所有 user_id 外键约束，保留字段
   - 影响表: articles, albums, images, knowledge_bases, platform_accounts 等

**保留的外键**（表间关系）:

- `articles.distillation_id → distillations(id)`
- `articles.topic_id → topics(id)`
- `articles.image_id → images(id)`
- `images.album_id → albums(id)`
- `knowledge_documents.knowledge_base_id → knowledge_bases(id)`
- 等等...

#### 需要调整的数据

**1. articles 表**:
```sql
-- 清理 task_id（因为 generation_tasks 不迁移）
UPDATE articles SET task_id = NULL;
```

**2. images 表**:
```sql
-- 调整文件路径
UPDATE images 
SET filepath = REPLACE(filepath, '/var/www/geo-system/uploads/', '{userData}/uploads/');
```

**3. platform_accounts 表**:
```sql
-- 验证加密
SELECT id, platform, 
  CASE WHEN cookies LIKE '%encrypted%' THEN 'OK' ELSE 'NEED_ENCRYPT' END as cookie_status
FROM platform_accounts;
```

---

## 📋 详细实施步骤

### 阶段 1: 准备工作（1-2 天）

#### 1.1 导出服务器 Schema

**步骤 1: 导出所有需要迁移的表结构**

```bash
# 创建导出目录
mkdir -p ./backups/postgres-migration

# 导出表结构（不含数据）
pg_dump -h 124.221.247.107 -U geo_user -d geo_system \
  --schema-only \
  --no-owner \
  --no-privileges \
  --table=articles \
  --table=albums \
  --table=images \
  --table=knowledge_bases \
  --table=knowledge_documents \
  --table=platform_accounts \
  --table=publishing_tasks \
  --table=publishing_records \
  --table=publishing_logs \
  --table=conversion_targets \
  --table=distillations \
  --table=topics \
  --table=article_settings \
  --table=distillation_config \
  --table=image_usage \
  --table=distillation_usage \
  --table=topic_usage \
  > ./backups/postgres-migration/01_tables_schema.sql
```

**步骤 2: 导出函数**

```bash
# 导出所有需要的函数
pg_dump -h 124.221.247.107 -U geo_user -d geo_system \
  --schema-only \
  --no-owner \
  --no-privileges \
  -t '' \
  --routine=sync_article_distillation_snapshot \
  --routine=update_article_image_size \
  --routine=increment_image_reference \
  --routine=decrement_image_reference \
  --routine=soft_delete_image \
  --routine=is_image_referenced \
  --routine=sync_topic_keyword_snapshot \
  --routine=update_updated_at_column \
  > ./backups/postgres-migration/02_functions.sql
```

**步骤 3: 手动调整 Schema**

创建 `./backups/postgres-migration/03_schema_adjusted.sql`:

```sql
-- ==================== 调整后的 Schema ====================
-- 移除服务器专用的外键约束

-- 1. 移除 user_id 外键（所有表）
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_user_id_fkey;
ALTER TABLE albums DROP CONSTRAINT IF EXISTS albums_user_id_fkey;
ALTER TABLE images DROP CONSTRAINT IF EXISTS images_user_id_fkey;
ALTER TABLE knowledge_bases DROP CONSTRAINT IF EXISTS knowledge_bases_user_id_fkey;
ALTER TABLE platform_accounts DROP CONSTRAINT IF EXISTS platform_accounts_user_id_fkey;
-- ... 其他表

-- 2. 移除 task_id 外键
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_task_id_fkey;

-- 3. 保留表间关系的外键
-- 这些外键保持不变，因为相关表都会迁移
```

#### 1.2 导出测试用户数据

**步骤 1: 确定测试用户 ID**

```bash
# 查询测试用户
ssh -i "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem" ubuntu@124.221.247.107 \
  "sudo -u postgres psql -d geo_system -c \"SELECT id, username, email FROM users WHERE email LIKE '%test%' OR username LIKE '%test%' LIMIT 5;\""
```

**步骤 2: 导出指定用户的数据**

```bash
# 假设测试用户 ID 为 1
USER_ID=1

# 导出数据（使用 COPY 格式，更快）
ssh -i "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem" ubuntu@124.221.247.107 << 'EOF'
sudo -u postgres psql -d geo_system << 'SQL'
-- 导出 articles
\copy (SELECT * FROM articles WHERE user_id = 1) TO '/tmp/articles.csv' CSV HEADER;

-- 导出 albums
\copy (SELECT * FROM albums WHERE user_id = 1) TO '/tmp/albums.csv' CSV HEADER;

-- 导出 images
\copy (SELECT * FROM images WHERE user_id = 1) TO '/tmp/images.csv' CSV HEADER;

-- 导出 knowledge_bases
\copy (SELECT * FROM knowledge_bases WHERE user_id = 1) TO '/tmp/knowledge_bases.csv' CSV HEADER;

-- 导出 knowledge_documents (通过 knowledge_bases 关联)
\copy (SELECT kd.* FROM knowledge_documents kd JOIN knowledge_bases kb ON kd.knowledge_base_id = kb.id WHERE kb.user_id = 1) TO '/tmp/knowledge_documents.csv' CSV HEADER;

-- 导出 platform_accounts
\copy (SELECT * FROM platform_accounts WHERE user_id = 1) TO '/tmp/platform_accounts.csv' CSV HEADER;

-- 导出 publishing_tasks
\copy (SELECT * FROM publishing_tasks WHERE user_id = 1) TO '/tmp/publishing_tasks.csv' CSV HEADER;

-- 导出 publishing_records
\copy (SELECT * FROM publishing_records WHERE user_id = 1) TO '/tmp/publishing_records.csv' CSV HEADER;

-- 导出 publishing_logs (通过 publishing_tasks 关联)
\copy (SELECT pl.* FROM publishing_logs pl JOIN publishing_tasks pt ON pl.task_id = pt.id WHERE pt.user_id = 1) TO '/tmp/publishing_logs.csv' CSV HEADER;

-- 导出 conversion_targets
\copy (SELECT * FROM conversion_targets WHERE user_id = 1) TO '/tmp/conversion_targets.csv' CSV HEADER;

-- 导出 distillations
\copy (SELECT * FROM distillations WHERE user_id = 1) TO '/tmp/distillations.csv' CSV HEADER;

-- 导出 topics (通过 distillations 关联)
\copy (SELECT t.* FROM topics t JOIN distillations d ON t.distillation_id = d.id WHERE d.user_id = 1) TO '/tmp/topics.csv' CSV HEADER;

-- 导出 article_settings
\copy (SELECT * FROM article_settings WHERE user_id = 1) TO '/tmp/article_settings.csv' CSV HEADER;

-- 导出 distillation_config
\copy (SELECT * FROM distillation_config WHERE user_id = 1) TO '/tmp/distillation_config.csv' CSV HEADER;

-- 导出 image_usage (通过 images 关联)
\copy (SELECT iu.* FROM image_usage iu JOIN images i ON iu.image_id = i.id WHERE i.user_id = 1) TO '/tmp/image_usage.csv' CSV HEADER;

-- 导出 distillation_usage (通过 distillations 关联)
\copy (SELECT du.* FROM distillation_usage du JOIN distillations d ON du.distillation_id = d.id WHERE d.user_id = 1) TO '/tmp/distillation_usage.csv' CSV HEADER;

-- 导出 topic_usage (通过 topics 关联)
\copy (SELECT tu.* FROM topic_usage tu JOIN topics t ON tu.topic_id = t.id JOIN distillations d ON t.distillation_id = d.id WHERE d.user_id = 1) TO '/tmp/topic_usage.csv' CSV HEADER;
SQL
EOF

# 下载所有 CSV 文件
scp -i "/Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem" \
  ubuntu@124.221.247.107:/tmp/*.csv \
  ./backups/postgres-migration/data/
```

#### 1.3 数据清理脚本

创建 `./backups/postgres-migration/04_data_cleanup.sql`:

```sql
-- ==================== 数据清理 ====================

-- 1. 清理 articles.task_id（因为 generation_tasks 不迁移）
UPDATE articles SET task_id = NULL;

-- 2. 调整 images.filepath（从服务器路径改为本地路径）
-- 注意：这个需要在导入后执行，因为需要知道本地路径
-- UPDATE images 
-- SET filepath = REPLACE(filepath, '/var/www/geo-system/uploads/', 'C:/Users/{username}/AppData/Roaming/geo-system/uploads/');

-- 3. 验证加密数据
-- 检查 platform_accounts 的 cookies 和 credentials 是否已加密
SELECT 
  id, 
  platform,
  CASE 
    WHEN cookies IS NULL THEN 'NULL'
    WHEN LENGTH(cookies) > 100 THEN 'ENCRYPTED'
    ELSE 'PLAIN'
  END as cookie_status,
  CASE 
    WHEN credentials IS NULL THEN 'NULL'
    WHEN LENGTH(credentials) > 50 THEN 'ENCRYPTED'
    ELSE 'PLAIN'
  END as credential_status
FROM platform_accounts;
```

#### 1.4 创建验证脚本

创建 `./backups/postgres-migration/05_verify_export.sh`:

```bash
#!/bin/bash

echo "验证导出的数据..."

# 检查文件是否存在
FILES=(
  "01_tables_schema.sql"
  "02_functions.sql"
  "03_schema_adjusted.sql"
  "04_data_cleanup.sql"
  "data/articles.csv"
  "data/albums.csv"
  "data/images.csv"
  # ... 其他文件
)

for file in "${FILES[@]}"; do
  if [ -f "./backups/postgres-migration/$file" ]; then
    echo "✓ $file 存在"
  else
    echo "✗ $file 缺失"
  fi
done

# 统计记录数
echo ""
echo "数据记录统计:"
for csv in ./backups/postgres-migration/data/*.csv; do
  count=$(wc -l < "$csv")
  echo "$(basename $csv): $((count - 1)) 条记录"  # 减去表头
done
```


```bash
# 1. 连接到服务器
ssh -i /Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem ubuntu@124.221.247.107

# 2. 导出 schema
sudo -u postgres pg_dump -d geo_system \
  --schema-only \
  --table=articles --table=albums --table=images \
  --table=knowledge_bases --table=knowledge_documents \
  --table=platform_accounts --table=publishing_tasks \
  --table=publishing_records --table=publishing_logs \
  --table=conversion_targets --table=distillations \
  --table=topics --table=article_settings \
  --table=distillation_config --table=image_usage \
  > /tmp/windows_schema.sql

# 3. 导出测试用户数据（user_id = 1）
sudo -u postgres pg_dump -d geo_system \
  --data-only \
  --table=articles --table=albums --table=images \
  --table=knowledge_bases --table=knowledge_documents \
  --table=platform_accounts --table=publishing_tasks \
  --table=publishing_records --table=publishing_logs \
  --table=conversion_targets --table=distillations \
  --table=topics --table=article_settings \
  --table=distillation_config --table=image_usage \
  > /tmp/user_data.sql

# 4. 下载到本地
scp -i /Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem \
  ubuntu@124.221.247.107:/tmp/windows_schema.sql \
  ./backups/

scp -i /Users/lzc/Desktop/GEO资料/腾讯云ssh秘钥/kiro.pem \
  ubuntu@124.221.247.107:/tmp/user_data.sql \
  ./backups/
```

#### 1.2 分析和调整 Schema

创建 `windows-login-manager/electron/database/migrations/001_init_from_server.sql`：

```sql
-- 从服务器导出的 schema，调整后的版本
-- 移除服务器专用约束和触发器
-- 保留核心表结构和索引
```

#### 1.3 创建测试计划

- 单元测试：每个 Service 类的 CRUD 操作
- 集成测试：IPC 通信和数据流
- 性能测试：查询性能对比

### 阶段 2: 数据库层重写（2-3 天）

#### 2.1 创建 PostgreSQL 管理器

**文件**: `windows-login-manager/electron/database/postgres.ts`

```typescript
import { Pool, PoolClient } from 'pg';
import PgEmbed from 'pg-embed';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';
import log from 'electron-log';

class PostgresManager {
  private static instance: PostgresManager;
  private pool: Pool | null = null;
  private pgEmbed: PgEmbed | null = null;
  private initialized: boolean = false;

  private constructor() {}

  static getInstance(): PostgresManager {
    if (!PostgresManager.instance) {
      PostgresManager.instance = new PostgresManager();
    }
    return PostgresManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      log.info('PostgreSQL: Already initialized');
      return;
    }

    try {
      log.info('PostgreSQL: Initializing...');

      const userDataPath = app.getPath('userData');
      const dbDir = path.join(userDataPath, 'postgres-data');

      // 初始化嵌入式 PostgreSQL
      this.pgEmbed = new PgEmbed({
        databaseDir: dbDir,
        user: 'geo_user',
        password: 'local_password',
        port: 5433,
        persistent: true
      });

      await this.pgEmbed.start();
      log.info('PostgreSQL: Embedded server started');

      // 创建连接池
      this.pool = new Pool({
        host: 'localhost',
        port: 5433,
        database: 'geo_local',
        user: 'geo_user',
        password: 'local_password',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000
      });

      // 测试连接
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      log.info('PostgreSQL: Connection pool created');

      // 运行迁移
      await this.runMigrations();

      this.initialized = true;
      log.info('PostgreSQL: Initialized successfully');
    } catch (error) {
      log.error('PostgreSQL: Initialization failed:', error);
      throw error;
    }
  }

  private async runMigrations(): Promise<void> {
    if (!this.pool) throw new Error('Pool not initialized');

    log.info('PostgreSQL: Running migrations...');

    // 创建迁移记录表
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 获取迁移文件
    let migrationsDir: string;
    if (app.isPackaged) {
      migrationsDir = path.join(process.resourcesPath, 'migrations');
    } else {
      migrationsDir = path.join(__dirname, 'migrations');
    }

    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    log.info(`PostgreSQL: Found ${migrationFiles.length} migration files`);

    // 执行未应用的迁移
    for (const file of migrationFiles) {
      const result = await this.pool.query(
        'SELECT 1 FROM _migrations WHERE name = $1',
        [file]
      );

      if (result.rows.length === 0) {
        log.info(`PostgreSQL: Applying migration: ${file}`);
        
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        
        const client = await this.pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(sql);
          await client.query(
            'INSERT INTO _migrations (name) VALUES ($1)',
            [file]
          );
          await client.query('COMMIT');
          log.info(`PostgreSQL: Applied migration: ${file}`);
        } catch (error) {
          await client.query('ROLLBACK');
          log.error(`PostgreSQL: Failed to apply migration ${file}:`, error);
          throw error;
        } finally {
          client.release();
        }
      }
    }

    log.info('PostgreSQL: Migrations completed');
  }

  getPool(): Pool {
    if (!this.pool) {
      throw new Error('PostgreSQL not initialized');
    }
    return this.pool;
  }

  async query(text: string, params?: any[]): Promise<any> {
    if (!this.pool) throw new Error('PostgreSQL not initialized');
    return await this.pool.query(text, params);
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    if (this.pgEmbed) {
      await this.pgEmbed.stop();
      this.pgEmbed = null;
    }
    this.initialized = false;
    log.info('PostgreSQL: Closed');
  }
}

export const postgresManager = PostgresManager.getInstance();
export function getPool(): Pool {
  return postgresManager.getPool();
}
```

#### 2.2 重写 BaseService

**文件**: `windows-login-manager/electron/services/BaseService.ts`

```typescript
import { Pool } from 'pg';
import { getPool } from '../database/postgres';
import log from 'electron-log';
import * as crypto from 'crypto';

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SortParams {
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}

export abstract class BaseService<T> {
  protected tableName: string;
  protected serviceName: string;

  constructor(tableName: string, serviceName?: string) {
    this.tableName = tableName;
    this.serviceName = serviceName || tableName;
  }

  protected get pool(): Pool {
    return getPool();
  }

  protected generateId(): string {
    return crypto.randomUUID();
  }

  protected now(): Date {
    return new Date();
  }

  async findById(id: string): Promise<T | null> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM ${this.tableName} WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      log.error(`${this.serviceName}: findById failed:`, error);
      throw error;
    }
  }

  async findAll(userId?: number): Promise<T[]> {
    try {
      let sql = `SELECT * FROM ${this.tableName}`;
      const params: any[] = [];

      if (userId !== undefined) {
        sql += ' WHERE user_id = $1';
        params.push(userId);
      }

      sql += ' ORDER BY created_at DESC';

      const result = await this.pool.query(sql, params);
      return result.rows;
    } catch (error) {
      log.error(`${this.serviceName}: findAll failed:`, error);
      throw error;
    }
  }

  async findPaginated(
    userId: number,
    params: PaginationParams & SortParams & { search?: string },
    searchFields: string[] = []
  ): Promise<PaginatedResult<T>> {
    try {
      const page = params.page || 1;
      const pageSize = params.pageSize || 20;
      const offset = (page - 1) * pageSize;

      let whereClauses: string[] = ['user_id = $1'];
      let queryParams: any[] = [userId];
      let paramIndex = 2;

      // 搜索条件
      if (params.search && searchFields.length > 0) {
        const searchConditions = searchFields.map(field => {
          const condition = `${field} ILIKE $${paramIndex}`;
          paramIndex++;
          return condition;
        });
        whereClauses.push(`(${searchConditions.join(' OR ')})`);
        searchFields.forEach(() => {
          queryParams.push(`%${params.search}%`);
        });
      }

      const whereClause = whereClauses.join(' AND ');

      // 排序
      const sortField = params.sortField || 'created_at';
      const sortOrder = params.sortOrder || 'desc';
      const orderClause = `ORDER BY ${sortField} ${sortOrder.toUpperCase()}`;

      // 查询总数
      const countSql = `SELECT COUNT(*) as total FROM ${this.tableName} WHERE ${whereClause}`;
      const countResult = await this.pool.query(countSql, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // 查询数据
      const dataSql = `
        SELECT * FROM ${this.tableName} 
        WHERE ${whereClause} 
        ${orderClause}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      queryParams.push(pageSize, offset);
      const dataResult = await this.pool.query(dataSql, queryParams);

      return {
        data: dataResult.rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      log.error(`${this.serviceName}: findPaginated failed:`, error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        `DELETE FROM ${this.tableName} WHERE id = $1`,
        [id]
      );
      return result.rowCount > 0;
    } catch (error) {
      log.error(`${this.serviceName}: delete failed:`, error);
      throw error;
    }
  }

  async deleteMany(ids: string[]): Promise<number> {
    try {
      if (ids.length === 0) return 0;

      const result = await this.pool.query(
        `DELETE FROM ${this.tableName} WHERE id = ANY($1::uuid[])`,
        [ids]
      );
      return result.rowCount;
    } catch (error) {
      log.error(`${this.serviceName}: deleteMany failed:`, error);
      throw error;
    }
  }

  async count(userId?: number): Promise<number> {
    try {
      let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
      const params: any[] = [];

      if (userId !== undefined) {
        sql += ' WHERE user_id = $1';
        params.push(userId);
      }

      const result = await this.pool.query(sql, params);
      return parseInt(result.rows[0].count);
    } catch (error) {
      log.error(`${this.serviceName}: count failed:`, error);
      throw error;
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        `SELECT 1 FROM ${this.tableName} WHERE id = $1 LIMIT 1`,
        [id]
      );
      return result.rows.length > 0;
    } catch (error) {
      log.error(`${this.serviceName}: exists failed:`, error);
      throw error;
    }
  }
}
```

### 阶段 3: 服务层迁移（3-4 天）

逐个修改所有 Service 类：

1. 将所有同步方法改为 async
2. 替换 `this.db.prepare()` 为 `await this.pool.query()`
3. 修改参数占位符从 `?` 到 `$1, $2`
4. 修改布尔值从 `0/1` 到 `TRUE/FALSE`
5. 修改时间处理从字符串到 `TIMESTAMP`

**示例**: ArticleService 部分方法

```typescript
// 旧: SQLite
create(data: CreateArticleData): Article {
  const id = this.generateId();
  const now = this.now();
  
  this.db.prepare(`
    INSERT INTO articles (id, user_id, title, content, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, data.userId, data.title, data.content, now);
  
  return this.findById(id)!;
}

// 新: PostgreSQL
async create(data: CreateArticleData): Promise<Article> {
  const id = this.generateId();
  
  const result = await this.pool.query(`
    INSERT INTO articles (id, user_id, title, content, created_at)
    VALUES ($1, $2, $3, $4, NOW())
    RETURNING *
  `, [id, data.userId, data.title, data.content]);
  
  return result.rows[0];
}
```

**⚠️ AI 生成文章保存流程**：
```typescript
// Windows 端接收服务器生成的文章后保存
async saveGeneratedArticle(generatedArticle: GeneratedArticle): Promise<Article> {
  // 1. 从服务器接收文章数据
  const { article, generationId } = generatedArticle;
  
  // 2. 保存到本地 PostgreSQL（这里需要修改）
  const savedArticle = await articleService.create({
    userId: currentUserId,
    title: article.title,
    content: article.content,
    keyword: article.keyword,
    provider: 'deepseek', // 或 'gemini'
    // ... 其他字段
  });
  
  // 3. 通知服务器确认收到
  await remoteArticleGenerationApi.confirm(generationId);
  
  return savedArticle;
}
```

### 阶段 4: IPC 处理器迁移（1-2 天）

修改所有 IPC 处理器为异步：

```typescript
// 旧
ipcMain.handle('article:create', (event, data) => {
  return articleService.create(data);
});

// 新
ipcMain.handle('article:create', async (event, data) => {
  return await articleService.create(data);
});
```

### 阶段 5: 测试和验证（2-3 天）

#### 5.1 单元测试

为每个 Service 创建测试：

```typescript
describe('ArticleService', () => {
  it('should create article', async () => {
    const article = await articleService.create({
      userId: 1,
      title: 'Test',
      content: 'Content'
    });
    expect(article.id).toBeDefined();
  });
});
```

#### 5.2 集成测试

测试完整流程：
- 文章创建 → 知识库关联 → 图片关联 → 发布任务创建

#### 5.3 性能测试

对比 SQLite 和 PostgreSQL 的性能：
- 查询速度
- 插入速度
- 事务性能

### 阶段 6: PostgreSQL 逻辑复制配置（2-3 天）

#### 6.1 服务器配置

在服务器 PostgreSQL 上启用逻辑复制：

```sql
-- 修改 postgresql.conf
wal_level = logical
max_replication_slots = 10
max_wal_senders = 10

-- 创建发布
CREATE PUBLICATION geo_pub FOR TABLE 
  articles, albums, images, knowledge_bases, knowledge_documents,
  platform_accounts, publishing_tasks, publishing_records,
  conversion_targets, distillations, topics, article_settings;
```

#### 6.2 Windows 端配置

创建订阅：

```sql
CREATE SUBSCRIPTION geo_sub
CONNECTION 'host=124.221.247.107 port=5432 dbname=geo_system user=geo_user password=xxx'
PUBLICATION geo_pub;
```

#### 6.3 冲突解决策略

- 使用 UUID 避免 ID 冲突
- 设置 `conflict_resolution = 'last_write_wins'`
- 实现自定义冲突处理逻辑

---

## ⚠️ 风险和注意事项

### 0. AI 生成功能风险（最重要）

**问题**: 误以为需要迁移 AI 生成逻辑

**澄清**:
- ❌ **不需要迁移 AI 生成逻辑**（保持在服务器端）
- ✅ **只需修改保存文章的数据库操作**
- ✅ **服务器端的 AI 生成服务不受影响**

**验证方法**:
```typescript
// 测试 AI 生成功能
1. Windows 端发起生成请求
2. 服务器调用 DeepSeek/Gemini API
3. Windows 端接收结果
4. 保存到本地 PostgreSQL ✅ 这里是唯一变化
5. 确认服务器删除缓存
```

### 1. 性能风险

**问题**: 嵌入式 PostgreSQL 可能比 SQLite 占用更多资源

**缓解**:
- 优化连接池配置
- 使用索引优化查询
- 定期 VACUUM 清理

### 2. 数据一致性风险

**问题**: 逻辑复制可能出现延迟或冲突

**缓解**:
- 实现冲突检测和解决机制
- 使用时间戳跟踪最后修改时间
- 提供手动同步选项

### 3. 迁移风险

**问题**: 用户现有 SQLite 数据需要迁移

**缓解**:
- 提供自动迁移工具
- 保留 SQLite 数据作为备份
- 支持回滚到 SQLite

### 4. 兼容性风险

**问题**: 不同 Windows 版本可能有兼容性问题

**缓解**:
- 充分测试 Windows 7/10/11
- 提供详细的错误日志
- 准备降级方案

---

## 📊 迁移时间表

| 阶段 | 任务 | 预计时间 | 负责人 |
|------|------|---------|--------|
| 1 | 准备工作 | 1-2 天 | 开发 |
| 2 | 数据库层重写 | 2-3 天 | 开发 |
| 3 | 服务层迁移 | 3-4 天 | 开发 |
| 4 | IPC 处理器迁移 | 1-2 天 | 开发 |
| 5 | 测试和验证 | 2-3 天 | 测试 |
| 6 | 逻辑复制配置 | 2-3 天 | 开发 |
| 7 | 文档和培训 | 1-2 天 | 全员 |

**总计**: 12-19 天

---

## ✅ 验收标准

### 功能验收

- [ ] Windows 端成功启动嵌入式 PostgreSQL
- [ ] 所有 CRUD 操作正常工作
- [ ] 数据迁移工具正常运行
- [ ] 逻辑复制正常同步
- [ ] 冲突解决机制有效
- [ ] **⚠️ AI 生成功能正常**：
  - [ ] 发起生成请求成功
  - [ ] 服务器调用 AI API 成功
  - [ ] 接收生成结果成功
  - [ ] 保存到本地 PostgreSQL 成功
  - [ ] 确认机制正常工作

### 性能验收

- [ ] 查询性能不低于 SQLite
- [ ] 内存占用在可接受范围（< 200MB）
- [ ] 启动时间 < 5 秒

### 稳定性验收

- [ ] 连续运行 24 小时无崩溃
- [ ] 处理 10000+ 条记录无问题
- [ ] 网络中断后能自动恢复同步

---

## 📚 参考资料

- [PostgreSQL 官方文档](https://www.postgresql.org/docs/)
- [pg-embed GitHub](https://github.com/bmuskalla/pg-embed)
- [PostgreSQL 逻辑复制](https://www.postgresql.org/docs/current/logical-replication.html)
- [Electron 数据库最佳实践](https://www.electronjs.org/docs/latest/tutorial/database)

---

## 🎯 下一步行动

1. **立即开始**: 导出服务器 schema 和数据
2. **创建分支**: `feature/postgres-migration`
3. **设置开发环境**: 安装 PostgreSQL 和相关工具
4. **开始编码**: 从数据库层开始重写

---

**文档版本**: 1.0  
**创建日期**: 2026-01-16  
**最后更新**: 2026-01-16  
**状态**: 待审核
