# PostgreSQL 迁移数据清单

## 📋 概述

本文档列出从服务器 PostgreSQL 迁移到 Windows 端 PostgreSQL 的完整数据清单。

**审计日期**: 2026-01-16  
**服务器**: 124.221.247.107 (geo_system)  
**迁移方向**: 服务器 PostgreSQL → Windows 本地 PostgreSQL

---

## 🎯 迁移范围

### 需要迁移的数据（17 个表）

| # | 表名 | 用途 | 预计数据量 | 优先级 |
|---|------|------|-----------|--------|
| 1 | `articles` | AI 生成的文章 | 大 | 高 |
| 2 | `albums` | 图片相册 | 中 | 高 |
| 3 | `images` | 图片文件 | 大 | 高 |
| 4 | `knowledge_bases` | 知识库 | 中 | 高 |
| 5 | `knowledge_documents` | 知识文档 | 大 | 高 |
| 6 | `platform_accounts` | 平台账号 | 小 | 高 |
| 7 | `publishing_tasks` | 发布任务 | 大 | 高 |
| 8 | `publishing_records` | 发布记录 | 大 | 高 |
| 9 | `publishing_logs` | 发布日志 | 大 | 中 |
| 10 | `conversion_targets` | 转化目标 | 小 | 中 |
| 11 | `distillations` | 蒸馏记录 | 中 | 高 |
| 12 | `topics` | 话题 | 大 | 高 |
| 13 | `article_settings` | 文章设置 | 小 | 中 |
| 14 | `distillation_config` | 蒸馏配置 | 小 | 中 |
| 15 | `image_usage` | 图片使用追踪 | 大 | 中 |
| 16 | `distillation_usage` | 蒸馏使用追踪 | 大 | 中 |
| 17 | `topic_usage` | 话题使用追踪 | 大 | 中 |

---

## 📊 表结构对比

### 1. articles（文章表）⭐ 核心表

**服务器结构**:
- **主键**: `id` (INTEGER, SERIAL)
- **外键**: 
  - `user_id` → `users(id)` ON DELETE CASCADE
  - `distillation_id` → `distillations(id)` ON DELETE SET NULL
  - `topic_id` → `topics(id)` ON DELETE SET NULL
  - `task_id` → `generation_tasks(id)` ON DELETE SET NULL
  - `image_id` → `images(id)` ON DELETE SET NULL

**列清单**（20 列）:
```
id                            INTEGER (SERIAL)
user_id                       INTEGER NOT NULL
title                         VARCHAR(500)
keyword                       VARCHAR(255) NOT NULL
distillation_id               INTEGER
topic_id                      INTEGER
task_id                       INTEGER
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
```

**索引**（13 个）:
- PRIMARY KEY: `articles_pkey` (id)
- `idx_articles_user_id` (user_id)
- `idx_articles_keyword` (keyword)
- `idx_articles_is_published` (is_published)
- `idx_articles_distillation` (distillation_id)
- `idx_articles_topic_id` (topic_id)
- `idx_articles_task_id` (task_id)
- `idx_articles_image_id` (image_id)
- `idx_articles_title` (title)
- `idx_articles_publishing_status` (publishing_status)
- `idx_articles_distillation_keyword_snapshot` (distillation_keyword_snapshot)
- `idx_articles_user_created` (user_id, created_at DESC)
- `idx_articles_user_published_created` (user_id, is_published, created_at DESC)

**触发器**（2 个）:
- `trigger_sync_article_distillation_snapshot` - 同步蒸馏快照
- `trigger_update_article_image_size` - 更新图片大小

**迁移注意事项**:
- ⚠️ `task_id` 引用 `generation_tasks` 表（服务器专用），迁移时设为 NULL
- ⚠️ 触发器函数需要一并迁移
- ✅ 快照字段保留历史数据，即使源数据被删除

---

### 2. albums（相册表）

**服务器结构**:
- **主键**: `id` (INTEGER, SERIAL)
- **外键**: `user_id` → `users(id)` ON DELETE CASCADE

**列清单**（5 列）:
```
id          INTEGER (SERIAL)
user_id     INTEGER
name        VARCHAR(255) NOT NULL
created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**索引**（3 个）:
- PRIMARY KEY: `albums_pkey` (id)
- `idx_albums_user_id` (user_id)
- `idx_albums_created_at` (created_at DESC)

**迁移注意事项**:
- ✅ 结构简单，直接迁移

---

### 3. images（图片表）⭐ 核心表

**服务器结构**:
- **主键**: `id` (INTEGER, SERIAL)
- **外键**:
  - `user_id` → `users(id)` ON DELETE CASCADE
  - `album_id` → `albums(id)` ON DELETE SET NULL

**列清单**（12 列）:
```
id              INTEGER (SERIAL)
user_id         INTEGER
album_id        INTEGER
filename        VARCHAR(255) NOT NULL
filepath        VARCHAR(500) NOT NULL
mime_type       VARCHAR(50) NOT NULL
size            INTEGER NOT NULL
usage_count     INTEGER DEFAULT 0
deleted_at      TIMESTAMP
is_orphan       BOOLEAN DEFAULT false
reference_count INTEGER DEFAULT 0
created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**索引**（8 个）:
- PRIMARY KEY: `images_pkey` (id)
- `idx_images_user_id` (user_id)
- `idx_images_album_id` (album_id)
- `idx_images_created_at` (created_at DESC)
- `idx_images_deleted_at` (deleted_at)
- `idx_images_is_orphan` (is_orphan)
- `idx_images_orphan` (is_orphan) WHERE is_orphan = true
- `idx_images_usage_count` (album_id, usage_count, created_at)

**迁移注意事项**:
- ⚠️ `filepath` 需要调整为本地路径
- ✅ 软删除机制保留
- ✅ 孤儿文件机制保留

---

### 4. knowledge_bases（知识库表）

**服务器结构**:
- **主键**: `id` (INTEGER, SERIAL)
- **外键**: `user_id` → `users(id)` ON DELETE CASCADE

**列清单**（6 列）:
```
id          INTEGER (SERIAL)
user_id     INTEGER
name        VARCHAR(255) NOT NULL
description TEXT
created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**索引**（3 个）:
- PRIMARY KEY: `knowledge_bases_pkey` (id)
- `idx_knowledge_bases_user_id` (user_id)
- `idx_knowledge_bases_created_at` (created_at DESC)

**迁移注意事项**:
- ✅ 结构简单，直接迁移

---

### 5. knowledge_documents（知识文档表）

**服务器结构**:
- **主键**: `id` (INTEGER, SERIAL)
- **外键**: `knowledge_base_id` → `knowledge_bases(id)` ON DELETE CASCADE

**列清单**（7 列）:
```
id                  INTEGER (SERIAL)
knowledge_base_id   INTEGER NOT NULL
filename            VARCHAR(255) NOT NULL
file_type           VARCHAR(50) NOT NULL
file_size           INTEGER NOT NULL
content             TEXT NOT NULL
created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**索引**（2 个）:
- PRIMARY KEY: `knowledge_documents_pkey` (id)
- `idx_knowledge_documents_kb_id` (knowledge_base_id)

**迁移注意事项**:
- ✅ 文档内容已解析为文本，直接迁移

---

## 🔧 数据库函数和触发器

### 需要迁移的函数（8 个）

这些函数被 Windows 端表的触发器使用，必须迁移：

1. **sync_article_distillation_snapshot**
   - 用途: 同步文章的蒸馏快照
   - 触发器: `trigger_sync_article_distillation_snapshot` (articles 表)

2. **update_article_image_size**
   - 用途: 更新文章引用图片的大小
   - 触发器: `trigger_update_article_image_size` (articles 表)

3. **increment_image_reference**
   - 用途: 增加图片引用计数
   - 使用场景: 文章引用图片时

4. **decrement_image_reference**
   - 用途: 减少图片引用计数
   - 使用场景: 文章删除或更换图片时

5. **soft_delete_image**
   - 用途: 软删除图片
   - 使用场景: 删除图片但保留被引用的记录

6. **is_image_referenced**
   - 用途: 检查图片是否被引用
   - 使用场景: 删除图片前检查

7. **sync_topic_keyword_snapshot**
   - 用途: 同步话题关键词快照
   - 触发器: topics 表相关

8. **update_updated_at_column**
   - 用途: 自动更新 updated_at 字段
   - 触发器: 多个表使用

### 不需要迁移的函数（42 个）

这些函数用于服务器端的配额、订阅、存储管理等，保留在服务器：

- 配额相关: `check_user_quota`, `consume_quota_with_booster`, `get_available_quota_with_reservations` 等
- 存储相关: `check_storage_quota`, `record_storage_usage`, `sync_user_storage_usage` 等
- 订阅相关: `handle_subscription_renewal`, `set_quota_cycle_on_subscription` 等
- 清理相关: `cleanup_expired_reservations`, `cleanup_expired_tokens` 等

---

## 📝 迁移步骤详细规划

### 阶段 1: Schema 导出（1 天）

#### 1.1 导出表结构

```bash
# 导出所有需要迁移的表的 schema
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
  --table=distillation_usage \
  --table=topic_usage \
  > ./backups/windows_tables_schema.sql
```

#### 1.2 导出函数

```bash
# 导出需要的函数
pg_dump -h 124.221.247.107 -U geo_user -d geo_system \
  --schema-only \
  --routine=sync_article_distillation_snapshot \
  --routine=update_article_image_size \
  --routine=increment_image_reference \
  --routine=decrement_image_reference \
  --routine=soft_delete_image \
  --routine=is_image_referenced \
  --routine=sync_topic_keyword_snapshot \
  --routine=update_updated_at_column \
  > ./backups/windows_functions.sql
```

#### 1.3 Schema 调整

需要调整的内容：

1. **移除服务器专用外键**:
   - `articles.task_id` → `generation_tasks(id)` (删除此外键)
   - `articles.user_id` → `users(id)` (改为简单的 INTEGER，不设外键)

2. **调整序列**:
   - 保留 SERIAL 类型，但重新开始计数

3. **调整触发器**:
   - 确保触发器函数存在

### 阶段 2: 数据导出（1 天）

#### 2.1 按用户导出数据

```bash
# 导出指定用户的数据（示例：user_id = 1）
USER_ID=1

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
  --table=distillation_usage \
  --table=topic_usage \
  > ./backups/user_${USER_ID}_data.sql
```

#### 2.2 数据清理

需要清理的数据：

1. **articles 表**:
   - 将 `task_id` 设为 NULL（因为 generation_tasks 表不迁移）

2. **images 表**:
   - 调整 `filepath` 为相对路径或本地路径

3. **platform_accounts 表**:
   - 确保 `cookies` 和 `credentials` 已加密

### 阶段 3: 数据导入（1 天）

#### 3.1 创建本地数据库

```sql
-- 在 Windows 端本地 PostgreSQL 创建数据库
CREATE DATABASE geo_local;
```

#### 3.2 导入 Schema

```bash
# 导入表结构
psql -h localhost -p 5433 -U geo_user -d geo_local \
  -f ./backups/windows_tables_schema.sql

# 导入函数
psql -h localhost -p 5433 -U geo_user -d geo_local \
  -f ./backups/windows_functions.sql
```

#### 3.3 导入数据

```bash
# 导入用户数据
psql -h localhost -p 5433 -U geo_user -d geo_local \
  -f ./backups/user_1_data.sql
```

### 阶段 4: 数据验证（1 天）

#### 4.1 记录数验证

```sql
-- 验证每个表的记录数
SELECT 'articles' as table_name, COUNT(*) as count FROM articles
UNION ALL
SELECT 'albums', COUNT(*) FROM albums
UNION ALL
SELECT 'images', COUNT(*) FROM images
-- ... 其他表
```

#### 4.2 外键完整性验证

```sql
-- 验证外键关系
SELECT 
  a.id,
  a.album_id,
  al.id as album_exists
FROM images a
LEFT JOIN albums al ON a.album_id = al.id
WHERE a.album_id IS NOT NULL AND al.id IS NULL;
-- 应该返回 0 行
```

#### 4.3 触发器验证

```sql
-- 测试触发器
INSERT INTO articles (user_id, keyword, content, provider)
VALUES (1, 'test', 'test content', 'deepseek');

-- 检查 created_at 和 updated_at 是否自动设置
SELECT id, created_at, updated_at FROM articles ORDER BY id DESC LIMIT 1;
```

---

## ⚠️ 关键注意事项

### 1. 外键依赖

**问题**: `articles.task_id` 引用服务器专用的 `generation_tasks` 表

**解决方案**:
- 迁移时将所有 `task_id` 设为 NULL
- 移除此外键约束
- 保留字段用于未来可能的用途

### 2. 用户 ID 处理

**问题**: `user_id` 引用服务器的 `users` 表

**解决方案**:
- Windows 端不迁移 `users` 表
- `user_id` 保留为 INTEGER，从 JWT token 获取
- 不设置外键约束

### 3. 文件路径调整

**问题**: `images.filepath` 和 `knowledge_documents` 的文件路径

**解决方案**:
- 服务器路径: `/var/www/geo-system/uploads/...`
- Windows 路径: `C:\Users\{username}\AppData\Roaming\geo-system\uploads\...`
- 迁移时需要批量替换路径

### 4. 触发器函数

**问题**: 触发器依赖的函数必须先创建

**解决方案**:
- 先导入函数
- 再导入表结构（包含触发器）
- 验证触发器是否正常工作

### 5. 序列重置

**问题**: SERIAL 字段的序列需要重置

**解决方案**:
```sql
-- 导入数据后，重置序列
SELECT setval('articles_id_seq', (SELECT MAX(id) FROM articles));
SELECT setval('albums_id_seq', (SELECT MAX(id) FROM albums));
-- ... 其他表
```

---

## 📋 迁移检查清单

### Schema 迁移

- [ ] 导出所有 17 个表的 schema
- [ ] 导出 8 个必需的函数
- [ ] 调整外键约束（移除 task_id 外键）
- [ ] 调整 user_id 为简单 INTEGER
- [ ] 验证触发器定义

### 数据迁移

- [ ] 导出测试用户数据
- [ ] 清理 task_id 字段（设为 NULL）
- [ ] 调整文件路径
- [ ] 验证数据完整性
- [ ] 导入到本地 PostgreSQL

### 功能验证

- [ ] 验证所有表的记录数
- [ ] 验证外键完整性
- [ ] 测试触发器功能
- [ ] 测试 CRUD 操作
- [ ] 验证索引性能

### 代码迁移

- [ ] 修改 DatabaseManager (SQLite → PostgreSQL)
- [ ] 修改 BaseService (同步 → 异步)
- [ ] 修改所有 Service 类
- [ ] 修改所有 IPC 处理器
- [ ] 更新 package.json 依赖

---

## 📊 预计数据量

基于测试用户（user_id = 1）的数据量估算：

| 表名 | 预计记录数 | 预计大小 |
|------|-----------|---------|
| articles | 100-1000 | 1-10 MB |
| albums | 5-20 | < 1 MB |
| images | 50-500 | 元数据 < 1 MB，文件另计 |
| knowledge_bases | 5-20 | < 1 MB |
| knowledge_documents | 20-100 | 1-5 MB |
| platform_accounts | 5-15 | < 1 MB |
| publishing_tasks | 100-1000 | 1-10 MB |
| publishing_records | 100-1000 | 1-10 MB |
| publishing_logs | 1000-10000 | 5-50 MB |
| 其他表 | 少量 | < 1 MB |

**总计**: 约 10-100 MB（不含图片文件）

---

## 🎯 下一步行动

1. **立即执行**: 导出服务器 schema 和测试数据
2. **创建脚本**: 自动化数据清理和路径调整
3. **本地测试**: 在开发环境验证完整流程
4. **文档更新**: 记录遇到的问题和解决方案

---

**文档版本**: 1.0  
**创建日期**: 2026-01-16  
**最后更新**: 2026-01-16  
**状态**: 待审核
