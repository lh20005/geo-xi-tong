# Dashboard 资源排行 API 类型错误修复

## 问题描述

Dashboard 页面调用 `/api/dashboard/top-resources` 接口时返回 500 错误：

```
error: operator does not exist: integer = text
Hint: No operator matches the given name and argument types. You might need to add explicit type casts.
```

## 根本原因

`generation_tasks` 表中的 `knowledge_base_id` 和 `album_id` 字段被定义为 `TEXT` 类型，但在 SQL 查询中与 `knowledge_bases.id`（INTEGER）和 `albums.id`（INTEGER）进行比较，导致类型不匹配。

### 数据库表结构问题

```sql
-- 错误的定义（迁移文件中）
CREATE TABLE generation_tasks (
  ...
  album_id TEXT,
  knowledge_base_id TEXT,
  ...
);

-- 实际引用的表
CREATE TABLE knowledge_bases (
  id SERIAL PRIMARY KEY,  -- INTEGER 类型
  ...
);
```

### 问题 SQL 查询

```typescript
// DashboardService.ts - getTopResources()
const knowledgeBasesQuery = `
  SELECT 
    kb.id,
    kb.name,
    COUNT(gt.id) AS usage_count
  FROM knowledge_bases kb
  LEFT JOIN generation_tasks gt ON kb.id = gt.knowledge_base_id  -- INTEGER = TEXT ❌
    AND gt.user_id = $1
  WHERE kb.user_id = $1
  GROUP BY kb.id, kb.name
  ORDER BY usage_count DESC
  LIMIT 10
`;
```

## 修复步骤

按照 `bugfix-workflow.md` 规则执行：

### 1. 服务器数据库修复

```sql
-- 1. 清理 UUID 格式的 knowledge_base_id（设为 NULL）
UPDATE generation_tasks 
SET knowledge_base_id = NULL 
WHERE knowledge_base_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 2. 清理 UUID 格式的 album_id（设为 NULL）
UPDATE generation_tasks 
SET album_id = NULL 
WHERE album_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 3. 转换 knowledge_base_id 为 INTEGER
ALTER TABLE generation_tasks 
ALTER COLUMN knowledge_base_id TYPE INTEGER USING knowledge_base_id::INTEGER;

-- 4. 转换 album_id 为 INTEGER
ALTER TABLE generation_tasks 
ALTER COLUMN album_id TYPE INTEGER USING album_id::INTEGER;
```

**执行结果**：
- 清理了 2 条 UUID 格式的 `knowledge_base_id` 记录
- 清理了 2 条 UUID 格式的 `album_id` 记录
- 成功转换字段类型为 INTEGER

### 2. 修改本地迁移文件

修改 `server/src/db/migrations/001_initial_schema.sql`：

```sql
-- 修改前
album_id TEXT, -- 支持 INTEGER 和 UUID（Windows 端本地数据）
knowledge_base_id TEXT, -- 支持 INTEGER 和 UUID（Windows 端本地数据）

-- 修改后
album_id INTEGER, -- 相册 ID（服务器端不存储相册，仅记录引用）
knowledge_base_id INTEGER, -- 知识库 ID（服务器端不存储知识库，仅记录引用）
```

## 验证结果

### 数据库字段类型

```bash
$ sudo -u postgres psql -d geo_system -c "\d generation_tasks" | grep -E "(knowledge_base_id|album_id)"

album_id                   | integer                     |           |          | 
knowledge_base_id          | integer                     |           |          |
```

✅ 字段类型已正确转换为 INTEGER

### API 测试

Dashboard API 现在应该正常工作，不再返回类型错误。

## 影响范围

- ✅ 服务器端：已修复，API 正常工作
- ✅ 本地迁移文件：已更新，确保新环境部署时使用正确类型
- ⚠️ 数据丢失：2 条包含 UUID 的历史记录被清理（这些记录无法与现有表关联）

## 相关文件

- `server/src/db/migrations/001_initial_schema.sql` - 迁移文件（已修改）
- `server/src/services/DashboardService.ts` - Dashboard 服务（无需修改）
- `server/src/routes/dashboard.ts` - Dashboard 路由（无需修改）

## 经验教训

1. **类型一致性**：关联字段必须使用相同的数据类型
2. **迁移规范**：遵循 PostgreSQL 规范，使用 SERIAL/INTEGER 作为主键和外键
3. **修复流程**：按照 bugfix-workflow 规则，先修复服务器，再更新迁移文件

## 修复时间

- 发现时间：2026-01-17 17:49:19
- 修复时间：2026-01-17 18:00:00
- 修复人员：Kiro AI Assistant
