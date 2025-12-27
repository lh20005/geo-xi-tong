# 数据库迁移系统

## 概述

本系统使用版本化的迁移文件来管理数据库结构变更，确保：
- ✅ 可追溯：每次变更都有记录
- ✅ 可回滚：支持向上和向下迁移
- ✅ 可重复：多次执行不会出错
- ✅ 自动化：一键执行所有待迁移

## 目录结构

```
server/src/db/
├── migrations/
│   ├── README.md                    # 本文件
│   ├── 001_initial_schema.sql       # 初始数据库结构
│   ├── 002_add_invitation_fields.sql
│   ├── 003_add_missing_tables.sql
│   ├── 004_add_address_column.sql
│   └── 005_add_usage_count.sql
├── migrate.ts                       # 迁移执行脚本
└── rollback.ts                      # 回滚脚本
```

## 迁移文件命名规范

```
{版本号}_{描述}.sql

例如：
001_initial_schema.sql
002_add_user_fields.sql
003_create_orders_table.sql
```

- **版本号**：3位数字，从001开始递增
- **描述**：简短的英文描述，使用下划线分隔
- **扩展名**：.sql

## 迁移文件格式

每个迁移文件包含两部分：

```sql
-- ==================== UP ====================
-- 向上迁移：应用此变更

CREATE TABLE example (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);

-- ==================== DOWN ====================
-- 向下迁移：回滚此变更

DROP TABLE IF EXISTS example;
```

## 使用方法

### 1. 查看迁移状态
```bash
npm run db:status
```

### 2. 执行所有待迁移
```bash
npm run db:migrate
```

### 3. 回滚最后一次迁移
```bash
npm run db:rollback
```

### 4. 回滚到指定版本
```bash
npm run db:rollback -- --to=003
```

### 5. 重置数据库（危险操作）
```bash
npm run db:reset
```

## 创建新迁移

### 方法1：使用生成器（推荐）
```bash
npm run db:create -- add_email_to_users
```

这会创建一个新的迁移文件，例如：`006_add_email_to_users.sql`

### 方法2：手动创建
1. 在 `migrations/` 目录下创建新文件
2. 使用下一个版本号
3. 按照格式编写 UP 和 DOWN 部分

## 迁移历史表

系统会自动创建 `schema_migrations` 表来跟踪已执行的迁移：

```sql
CREATE TABLE schema_migrations (
  version VARCHAR(10) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 最佳实践

### ✅ 推荐做法

1. **每次变更创建新迁移**
   - 不要修改已执行的迁移文件
   - 如需修改，创建新的迁移文件

2. **使用 IF EXISTS / IF NOT EXISTS**
   ```sql
   ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
   ```

3. **添加索引时检查是否存在**
   ```sql
   CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
   ```

4. **提供完整的回滚逻辑**
   - 确保 DOWN 部分能完全撤销 UP 的变更

5. **测试迁移和回滚**
   ```bash
   npm run db:migrate
   npm run db:rollback
   npm run db:migrate
   ```

### ❌ 避免做法

1. **不要修改已执行的迁移**
   - 已在生产环境执行的迁移不应修改

2. **不要在迁移中插入业务数据**
   - 迁移只管理结构，数据用 seed 文件

3. **不要使用 DROP TABLE 删除有数据的表**
   - 先备份数据，或使用软删除

## 生产环境部署流程

### 1. 部署前检查
```bash
# 在本地测试迁移
npm run db:migrate

# 检查迁移状态
npm run db:status

# 测试回滚
npm run db:rollback
npm run db:migrate
```

### 2. 备份生产数据库
```bash
ssh ubuntu@server "pg_dump -h localhost -U geo_user geo_system > backup_$(date +%Y%m%d_%H%M%S).sql"
```

### 3. 执行迁移
```bash
# 上传迁移文件
scp -r server/src/db/migrations ubuntu@server:/var/www/geo-system/server/src/db/

# 执行迁移
ssh ubuntu@server "cd /var/www/geo-system/server && npm run db:migrate"
```

### 4. 验证结果
```bash
# 检查迁移状态
ssh ubuntu@server "cd /var/www/geo-system/server && npm run db:status"

# 测试API
curl http://server/api/health
```

## 故障恢复

### 迁移失败
```bash
# 1. 查看错误日志
npm run db:status

# 2. 手动修复数据库
psql -h localhost -U geo_user -d geo_system

# 3. 标记迁移为已执行（如果手动修复成功）
INSERT INTO schema_migrations (version, name) VALUES ('005', 'add_usage_count');

# 或回滚到上一个版本
npm run db:rollback
```

### 需要紧急回滚
```bash
# 1. 回滚最后一次迁移
npm run db:rollback

# 2. 重启应用
pm2 restart geo-backend

# 3. 验证系统正常
curl http://server/api/health
```

## 常见问题

### Q: 如何在多个环境保持同步？
A: 使用相同的迁移文件，按顺序执行。每个环境的 `schema_migrations` 表会记录已执行的版本。

### Q: 迁移执行到一半失败了怎么办？
A: PostgreSQL 支持事务，迁移会自动回滚。修复问题后重新执行即可。

### Q: 可以跳过某个迁移吗？
A: 不建议。如果必须跳过，手动在 `schema_migrations` 表中插入记录。

### Q: 如何处理数据迁移？
A: 创建专门的数据迁移文件，在 UP 部分编写数据转换逻辑。

## 示例：完整的迁移文件

```sql
-- ==================== UP ====================
-- 添加用户邀请功能相关字段

-- 1. 添加邀请码字段
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS invitation_code VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS invited_by_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS is_temp_password BOOLEAN DEFAULT false;

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_users_invitation_code 
ON users(invitation_code);

CREATE INDEX IF NOT EXISTS idx_users_invited_by_code 
ON users(invited_by_code);

-- 3. 为现有用户生成邀请码
UPDATE users 
SET invitation_code = LOWER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6))
WHERE invitation_code IS NULL;

-- 4. 添加外键约束
ALTER TABLE users 
ADD CONSTRAINT fk_users_invited_by 
FOREIGN KEY (invited_by_code) 
REFERENCES users(invitation_code) 
ON DELETE SET NULL;

-- ==================== DOWN ====================
-- 回滚邀请功能

-- 1. 删除外键约束
ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_invited_by;

-- 2. 删除索引
DROP INDEX IF EXISTS idx_users_invitation_code;
DROP INDEX IF EXISTS idx_users_invited_by_code;

-- 3. 删除字段
ALTER TABLE users 
DROP COLUMN IF EXISTS invitation_code,
DROP COLUMN IF EXISTS invited_by_code,
DROP COLUMN IF EXISTS is_temp_password;
```

## 相关命令

```json
// package.json
{
  "scripts": {
    "db:migrate": "ts-node src/db/migrate.ts",
    "db:rollback": "ts-node src/db/rollback.ts",
    "db:status": "ts-node src/db/status.ts",
    "db:create": "ts-node src/db/create-migration.ts",
    "db:reset": "ts-node src/db/reset.ts"
  }
}
```
