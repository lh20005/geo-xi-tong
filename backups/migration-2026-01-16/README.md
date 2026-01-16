# PostgreSQL 迁移 - 2026-01-16

## 📋 概述

本目录包含 Windows 桌面客户端从 SQLite 迁移到 PostgreSQL 的所有文件和脚本。

**迁移目标**: 将 Windows 端从 SQLite 迁移到 PostgreSQL，实现与服务器统一的数据库类型。

**当前状态**: ✅ 阶段 1-2 完成（Schema 导出和数据导出）

---

## 📁 文件清单

### Schema 文件

| 文件名 | 说明 | 状态 |
|--------|------|------|
| `windows_tables_schema.sql` | 原始 schema（2123 行） | ✅ 已导出 |
| `windows_tables_schema_processed.sql` | 处理后的 schema（已移除跨数据库外键） | ✅ 已处理 |
| `windows_functions_clean.sql` | 8 个必需的函数定义 | ✅ 已导出 |

### 数据文件

| 文件名 | 说明 | 状态 |
|--------|------|------|
| `user_1_data_raw.sql` | 原始数据导出（4614 条 INSERT） | ✅ 已导出 |
| `user_1_data_processed.sql` | 处理后的数据（task_id 已设为 NULL） | ✅ 已处理 |

### 脚本文件

| 文件名 | 说明 | 用途 |
|--------|------|------|
| `process_schema.py` | Schema 处理脚本 | 移除跨数据库外键约束 |
| `process_data.py` | 数据处理脚本 | 清理 task_id 字段 |
| `export_user_data.sh` | 数据导出脚本（未使用） | 备用 |

### 文档文件

| 文件名 | 说明 |
|--------|------|
| `MIGRATION_PROGRESS.md` | 详细的迁移进度跟踪 |
| `README.md` | 本文档 |

---

## ✅ 已完成的工作

### 阶段 1：Schema 导出

**完成时间**: 2026-01-16

**成果**:
- ✅ 导出 17 个表的 schema
- ✅ 导出 8 个必需的函数
- ✅ 移除 16 个跨数据库外键约束（13 个 user_id + 3 个 task_id）
- ✅ 保留所有表间外键约束

**关键决策**:
- 移除 `user_id` 外键（users 表保留在服务器）
- 移除 `task_id` 外键（generation_tasks 表保留在服务器）
- 保留表间外键（如 articles → topics, images → albums）

### 阶段 2：数据导出

**完成时间**: 2026-01-16

**成果**:
- ✅ 导出 user_id = 1 的所有数据（4614 条 INSERT 语句）
- ✅ 将 articles.task_id 设为 NULL
- ✅ 添加数据说明注释
- ✅ 添加序列重置语句

**数据统计**:
- articles: 2 条
- albums: 1 条
- images: 2 条
- knowledge_bases: 1 条
- platform_accounts: 1 条
- publishing_tasks: 7 条
- distillations: 1 条
- topics: 12 条

---

## 🎯 下一步计划

### 阶段 3：本地数据库创建（待执行）

**目标**: 在 Windows 端创建本地 PostgreSQL 实例

**步骤**:
1. 选择 PostgreSQL 方案（pg-embed 或独立安装）
2. 创建本地数据库
3. 导入函数定义
4. 导入表结构
5. 验证 schema

### 阶段 4：数据导入（待执行）

**目标**: 将测试数据导入本地数据库

**步骤**:
1. 导入处理后的数据
2. 重置序列
3. 验证数据完整性
4. 测试触发器功能

### 阶段 5：代码迁移（待执行）

**目标**: 修改 Windows 端代码以使用 PostgreSQL

**需要修改的文件**:
- `windows-login-manager/electron/database/sqlite.ts` → 删除
- `windows-login-manager/electron/database/postgres.ts` → 创建
- `windows-login-manager/electron/services/BaseService.ts` → 重写
- 所有 Service 类 → 修改为异步
- 所有 IPC 处理器 → 添加 async/await
- `windows-login-manager/package.json` → 添加 pg 依赖

### 阶段 6：测试验证（待执行）

**目标**: 全面测试迁移后的功能

**测试项**:
- 单元测试（数据库连接、CRUD 操作）
- 集成测试（文章生成、发布流程）
- 性能测试（查询性能、并发处理）

---

## 📊 迁移统计

### Schema 处理

- **表数量**: 17 个
- **函数数量**: 8 个
- **移除的外键**: 16 个
- **保留的外键**: 约 20 个

### 数据处理

- **INSERT 语句**: 4614 条
- **task_id 清理**: 已完成
- **数据大小**: 约 1.8 MB

---

## 🔑 关键技术决策

### 1. 外键约束处理

**决策**: 移除跨数据库外键，保留表间外键

**原因**:
- users 表和 generation_tasks 表保留在服务器
- 跨数据库无法建立外键约束
- 应用层保证 user_id 完整性（从 JWT 获取）

**影响**:
- 需要在应用层实现数据完整性检查
- 需要手动实现级联删除逻辑
- 多层验证机制（前端 + 应用层 + 数据库 + 服务器）

### 2. task_id 字段处理

**决策**: 将 task_id 设为 NULL

**原因**:
- generation_tasks 表保留在服务器（AI 任务队列）
- Windows 端不需要这个表
- 保留字段用于未来可能的用途

**影响**:
- 迁移的数据中 task_id 全部为 NULL
- 不影响功能（AI 生成在服务器端）

### 3. 函数迁移

**决策**: 迁移 8 个必需的函数

**原因**:
- 这些函数被 Windows 端表的触发器使用
- 不迁移会导致触发器失败

**函数列表**:
1. sync_article_distillation_snapshot
2. update_article_image_size
3. increment_image_reference
4. decrement_image_reference
5. soft_delete_image
6. is_image_referenced
7. sync_topic_keyword_snapshot
8. update_updated_at_column

---

## 🛠️ 使用说明

### 导入 Schema

```bash
# 1. 创建数据库
createdb geo_local

# 2. 导入函数
psql -d geo_local -f windows_functions_clean.sql

# 3. 导入表结构
psql -d geo_local -f windows_tables_schema_processed.sql
```

### 导入数据

```bash
# 导入处理后的数据
psql -d geo_local -f user_1_data_processed.sql
```

### 验证导入

```sql
-- 检查表数量
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- 应该返回 17

-- 检查函数数量
SELECT COUNT(*) FROM pg_proc 
WHERE proname IN (
  'sync_article_distillation_snapshot',
  'update_article_image_size',
  'increment_image_reference',
  'decrement_image_reference',
  'soft_delete_image',
  'is_image_referenced',
  'sync_topic_keyword_snapshot',
  'update_updated_at_column'
);
-- 应该返回 8

-- 检查数据记录数
SELECT 'articles' as table_name, COUNT(*) as count FROM articles
UNION ALL SELECT 'albums', COUNT(*) FROM albums
UNION ALL SELECT 'images', COUNT(*) FROM images
UNION ALL SELECT 'topics', COUNT(*) FROM topics;
```

---

## ⚠️ 注意事项

### 1. 外键约束

- ❌ user_id 外键已移除（应用层保证）
- ❌ task_id 外键已移除（字段设为 NULL）
- ✅ 表间外键保留（数据库层面保证）

### 2. 数据完整性

- user_id 从 JWT token 获取（服务器签发，安全可靠）
- 所有操作添加 `WHERE user_id = $1` 条件
- 使用事务保证原子性

### 3. 序列重置

导入数据后必须重置序列：

```sql
SELECT setval('articles_id_seq', (SELECT COALESCE(MAX(id), 1) FROM articles));
-- 对所有表执行类似操作
```

### 4. 触发器验证

导入后测试触发器是否正常工作：

```sql
-- 测试 update_updated_at_column 触发器
UPDATE articles SET title = 'test' WHERE id = 1;
SELECT id, title, updated_at FROM articles WHERE id = 1;
-- updated_at 应该自动更新
```

---

## 📚 相关文档

- [PostgreSQL 迁移完整计划](../../docs/07-开发文档/PostgreSQL迁移完整计划.md)
- [PostgreSQL 迁移数据清单](../../docs/07-开发文档/PostgreSQL迁移数据清单.md)
- [迁移问题解答](../../docs/07-开发文档/迁移问题解答.md)
- [外键约束功能替代方案](../../docs/07-开发文档/外键约束功能替代方案.md)

---

## 📞 联系方式

如有问题，请参考：
- 迁移进度文档：`MIGRATION_PROGRESS.md`
- 技术文档：`docs/07-开发文档/`

---

**文档版本**: 1.0  
**创建日期**: 2026-01-16  
**最后更新**: 2026-01-16  
**状态**: 阶段 1-2 完成，阶段 3-6 待执行

