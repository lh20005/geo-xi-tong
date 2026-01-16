# Windows 端文章生成 UUID 支持修复

## 问题描述

Windows 端无法生成文章，报错：
```
invalid input syntax for type integer: "a4362244-64f1-497b-8b49-88e4653ec2b9"
operator does not exist: integer = text
```

## 根本原因

1. `generation_tasks` 表的 `album_id` 和 `knowledge_base_id` 字段是 `INTEGER` 类型，但 Windows 端传递的是 UUID 字符串
2. 数据库触发器 `sync_generation_task_snapshots()` 在查询 `albums` 和 `knowledge_bases` 表时，使用了类型不匹配的比较

## 解决方案

### 1. 服务器数据库修复（已完成）

#### 步骤 1：修改字段类型

```sql
-- 删除外键约束
ALTER TABLE generation_tasks DROP CONSTRAINT IF EXISTS generation_tasks_album_id_fkey;
ALTER TABLE generation_tasks DROP CONSTRAINT IF EXISTS generation_tasks_knowledge_base_id_fkey;

-- 修改字段类型为 TEXT（支持 UUID 和数字）
ALTER TABLE generation_tasks ALTER COLUMN album_id TYPE TEXT USING album_id::TEXT;
ALTER TABLE generation_tasks ALTER COLUMN knowledge_base_id TYPE TEXT USING knowledge_base_id::TEXT;

-- 添加注释
COMMENT ON COLUMN generation_tasks.album_id IS '图库ID（支持INTEGER和UUID）';
COMMENT ON COLUMN generation_tasks.knowledge_base_id IS '知识库ID（支持INTEGER和UUID）';
```

#### 步骤 2：修复触发器函数

```sql
-- 修复触发器函数，处理 TEXT 类型的 album_id 和 knowledge_base_id
CREATE OR REPLACE FUNCTION sync_generation_task_snapshots()
RETURNS TRIGGER AS $$
BEGIN
  -- 同步转化目标快照
  IF NEW.conversion_target_id IS NOT NULL THEN
    SELECT company_name, industry, website, address
    INTO NEW.conversion_target_name, NEW.conversion_target_industry,
         NEW.conversion_target_website, NEW.conversion_target_address
    FROM conversion_targets
    WHERE id = NEW.conversion_target_id;
  END IF;

  -- 同步蒸馏关键词快照
  IF NEW.distillation_id IS NOT NULL AND NEW.distillation_keyword IS NULL THEN
    SELECT keyword INTO NEW.distillation_keyword
    FROM distillations
    WHERE id = NEW.distillation_id;
  END IF;

  -- 同步图库名称快照（仅当 album_id 是数字时）
  IF NEW.album_id IS NOT NULL AND NEW.album_name IS NULL THEN
    -- 检查是否是数字 ID（服务器数据）
    IF NEW.album_id ~ '^[0-9]+$' THEN
      SELECT name INTO NEW.album_name
      FROM albums
      WHERE id = NEW.album_id::INTEGER;
    END IF;
    -- 如果是 UUID（Windows 端数据），跳过查询
  END IF;

  -- 同步知识库名称快照（仅当 knowledge_base_id 是数字时）
  IF NEW.knowledge_base_id IS NOT NULL AND NEW.knowledge_base_name IS NULL THEN
    -- 检查是否是数字 ID（服务器数据）
    IF NEW.knowledge_base_id ~ '^[0-9]+$' THEN
      SELECT name INTO NEW.knowledge_base_name
      FROM knowledge_bases
      WHERE id = NEW.knowledge_base_id::INTEGER;
    END IF;
    -- 如果是 UUID（Windows 端数据），跳过查询
  END IF;

  -- 同步文章设置快照
  IF NEW.article_setting_id IS NOT NULL THEN
    IF NEW.article_setting_name IS NULL OR NEW.article_setting_name = '' THEN
      SELECT name INTO NEW.article_setting_name
      FROM article_settings
      WHERE id = NEW.article_setting_id;
    END IF;
    IF NEW.article_setting_prompt IS NULL OR NEW.article_setting_prompt = '' THEN
      SELECT prompt INTO NEW.article_setting_prompt
      FROM article_settings
      WHERE id = NEW.article_setting_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 2. 本地迁移文件修改（已完成）

修改 `server/src/db/migrations/001_initial_schema.sql`：

```sql
-- 修改前
album_id INTEGER REFERENCES albums(id) ON DELETE SET NULL,
knowledge_base_id INTEGER REFERENCES knowledge_bases(id) ON DELETE SET NULL,

-- 修改后
album_id TEXT, -- 支持 INTEGER 和 UUID（Windows 端本地数据）
knowledge_base_id TEXT, -- 支持 INTEGER 和 UUID（Windows 端本地数据）
```

修改 `server/src/db/migrations/041_preserve_article_setting_snapshot.sql` 中的触发器函数（同上）。

## 技术说明

### 为什么使用 TEXT 而不是 UUID 类型？

1. **兼容性**：TEXT 类型可以同时存储：
   - Web 端的数字 ID（如 `"123"`）
   - Windows 端的 UUID（如 `"a4362244-64f1-497b-8b49-88e4653ec2b9"`）

2. **灵活性**：不需要在应用层做类型转换

3. **向后兼容**：已有的数字 ID 会自动转换为字符串

### 触发器函数的智能处理

触发器函数使用正则表达式 `~ '^[0-9]+$'` 检测 ID 格式：
- 如果是纯数字（如 `"123"`）→ 转换为 INTEGER 并查询服务器数据库
- 如果是 UUID 格式 → 跳过查询（因为是 Windows 端本地数据，服务器数据库中不存在）

### 数据验证

服务器端代码已经包含了验证逻辑（`server/src/routes/articleGeneration.ts`）：

```typescript
// 如果 albumId 是数字，验证服务器数据库中是否存在
// 如果是 UUID，说明来自 Windows 端本地数据，跳过验证
if (typeof validatedData.albumId === 'number') {
  const albumCheck = await pool.query('SELECT id FROM albums WHERE id = $1', [validatedData.albumId]);
  if (albumCheck.rows.length === 0) {
    return res.status(404).json({ error: '图库不存在' });
  }
}
```

## 验证结果

- ✅ 服务器数据库字段类型已修改为 TEXT
- ✅ 触发器函数已修复，支持 UUID 和数字 ID
- ✅ 本地迁移文件已更新
- ✅ 服务器重启成功
- ✅ 健康检查通过

## 测试建议

Windows 端现在可以：
1. 使用本地 SQLite 的 UUID 格式的 `albumId` 和 `knowledgeBaseId`
2. 正常创建文章生成任务
3. 服务器会跳过对 UUID 格式 ID 的数据库验证（因为这些是本地数据）

## 相关文件

- 服务器迁移文件：
  - `server/src/db/migrations/001_initial_schema.sql`
  - `server/src/db/migrations/041_preserve_article_setting_snapshot.sql`
- 路由验证逻辑：`server/src/routes/articleGeneration.ts`
- 服务层实现：`server/src/services/articleGenerationService.ts`

## 修复时间

2025-01-16

## 修复人员

Kiro AI Assistant
