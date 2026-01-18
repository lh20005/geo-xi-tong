# 关键词蒸馏 topic_count 字段缺失修复

**修复日期**: 2026-01-17  
**问题**: 关键词蒸馏失败，错误信息：`column "topic_count" of relation "distillations" does not exist`

---

## 问题分析

**服务器端和 Windows 端**的 `distillations` 表都缺少 `topic_count` 字段，导致关键词蒸馏功能无法正常工作。

### 错误信息

```
column "topic_count" of relation "distillations" does not exist
```

### 原因

1. 服务器端：初始迁移文件 `001_initial_schema.sql` 中创建 `distillations` 表时遗漏了 `topic_count` 字段
2. Windows 端：本地 PostgreSQL 数据库 `geo_windows` 也缺少该字段

---

## 修复步骤

### 1. 服务器数据库修复

```sql
-- 添加 topic_count 字段
ALTER TABLE distillations ADD COLUMN IF NOT EXISTS topic_count INTEGER DEFAULT 0;
```

**执行命令**:
```bash
sudo -u postgres psql -d geo_system -c "ALTER TABLE distillations ADD COLUMN IF NOT EXISTS topic_count INTEGER DEFAULT 0;"
```

**重启服务**:
```bash
pm2 restart geo-server
```

### 2. Windows 端本地数据库修复

```sql
-- 添加 topic_count 字段
ALTER TABLE distillations ADD COLUMN IF NOT EXISTS topic_count INTEGER DEFAULT 0;
```

**执行命令**:
```bash
psql -d geo_windows -c "ALTER TABLE distillations ADD COLUMN IF NOT EXISTS topic_count INTEGER DEFAULT 0;"
```

### 3. 修改服务器端迁移文件

**文件**: `server/src/db/migrations/001_initial_schema.sql`

**修改前**:
```sql
CREATE TABLE IF NOT EXISTS distillations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  keyword VARCHAR(255) NOT NULL,
  provider VARCHAR(20) NOT NULL,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**修改后**:
```sql
CREATE TABLE IF NOT EXISTS distillations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  keyword VARCHAR(255) NOT NULL,
  provider VARCHAR(20) NOT NULL,
  usage_count INTEGER DEFAULT 0,
  topic_count INTEGER DEFAULT 0,  -- ✅ 新增字段
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 验证修复

### 1. 检查服务器端表结构

```bash
sudo -u postgres psql -d geo_system -c "\d distillations"
```

**预期输出**:
```
   Column    |            Type             | Collation | Nullable |                  Default                  
-------------+-----------------------------+-----------+----------+-------------------------------------------
 id          | integer                     |           | not null | nextval('distillations_id_seq'::regclass)
 user_id     | integer                     |           |          | 
 keyword     | character varying(255)      |           | not null | 
 provider    | character varying(20)       |           | not null | 
 usage_count | integer                     |           |          | 0
 created_at  | timestamp without time zone |           |          | CURRENT_TIMESTAMP
 topic_count | integer                     |           |          | 0  ✅
```

### 2. 检查 Windows 端表结构

```bash
psql -d geo_windows -c "\d distillations"
```

**预期输出**:
```
   Column    |            Type             | Collation | Nullable |                  Default                  
-------------+-----------------------------+-----------+----------+-------------------------------------------
 id          | integer                     |           | not null | nextval('distillations_id_seq'::regclass)
 user_id     | integer                     |           |          | 
 keyword     | character varying(255)      |           | not null | 
 provider    | character varying(20)       |           | not null | 
 usage_count | integer                     |           |          | 0
 created_at  | timestamp without time zone |           |          | CURRENT_TIMESTAMP
 topic_count | integer                     |           |          | 0  ✅
```

### 3. 测试关键词蒸馏

在 Windows 客户端测试关键词蒸馏功能，确认不再报错。

---

## 影响范围

- ✅ 服务器数据库已修复
- ✅ Windows 端本地数据库已修复
- ✅ 服务器端迁移文件已更新（确保新环境部署正确）
- ✅ 关键词蒸馏功能恢复正常

---

## 注意事项

1. **服务器端**：
   - 字段已添加，服务已重启
   - 无需重新部署代码

2. **Windows 端**：
   - 本地数据库字段已添加
   - 无需重新编译或重启应用
   - 直接刷新页面即可使用

3. **新环境部署**：
   - 使用更新后的迁移文件，会自动包含 `topic_count` 字段

---

## 相关文件

- 服务器端迁移文件：`server/src/db/migrations/001_initial_schema.sql`
- 服务层：`server/src/services/DistillationService.ts`（使用该字段）
- Windows 端数据库：`geo_windows` (PostgreSQL)

---

## 修复完成 ✅

关键词蒸馏功能已恢复正常，服务器端和 Windows 端都可以正常使用。
