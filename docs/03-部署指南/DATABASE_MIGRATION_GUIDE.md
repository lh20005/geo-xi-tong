# 数据库迁移系统使用指南

## 概述

我们已经建立了一个完整的数据库迁移系统，解决了手动管理数据库变更的问题。

### 主要优势

✅ **版本控制** - 每次变更都有记录，可追溯  
✅ **自动化** - 一键执行所有待迁移  
✅ **可回滚** - 支持向上和向下迁移  
✅ **可重复** - 多次执行不会出错  
✅ **团队协作** - 统一的迁移流程

## 快速开始

### 1. 查看当前状态

```bash
cd server
npm run db:status
```

输出示例：
```
📊 数据库迁移状态
================================================================================
✓ 当前数据库版本: 002
✓ 已执行迁移: 2/2

📋 迁移列表:
--------------------------------------------------------------------------------
版本     状态       名称                                执行时间
--------------------------------------------------------------------------------
001      ✓ 已执行   initial schema                      2025-12-27 17:30:15
002      ✓ 已执行   add missing columns                 2025-12-27 17:35:22
--------------------------------------------------------------------------------

✓ 数据库已是最新版本
```

### 2. 创建新迁移

```bash
npm run db:create -- add_email_verification
```

这会创建文件：`server/src/db/migrations/003_add_email_verification.sql`

### 3. 编辑迁移文件

```sql
-- ==================== UP ====================
-- 添加邮箱验证功能

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS verification_token VARCHAR(100),
ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_verification_token 
ON users(verification_token) WHERE verification_token IS NOT NULL;

-- ==================== DOWN ====================
-- 回滚邮箱验证功能

DROP INDEX IF EXISTS idx_users_verification_token;

ALTER TABLE users 
DROP COLUMN IF EXISTS email_verified,
DROP COLUMN IF EXISTS verification_token,
DROP COLUMN IF EXISTS verification_expires_at;
```

### 4. 执行迁移

```bash
npm run db:migrate
```

输出示例：
```
🚀 开始数据库迁移...
==================================================
✓ 迁移历史表已就绪
✓ 已执行 2 个迁移
✓ 发现 3 个迁移文件

📋 待执行 1 个迁移:
   003 - add email verification

开始执行迁移...

→ 执行迁移 003: add email verification
✓ 迁移 003 执行成功

==================================================
✓ 所有迁移执行成功！
✓ 数据库版本: 003
```

### 5. 回滚（如果需要）

```bash
# 回滚最后一次迁移
npm run db:rollback

# 回滚到指定版本
npm run db:rollback -- --to=002
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run db:status` | 查看迁移状态 |
| `npm run db:create -- <name>` | 创建新迁移文件 |
| `npm run db:migrate` | 执行所有待迁移 |
| `npm run db:rollback` | 回滚最后一次迁移 |
| `npm run db:rollback -- --to=<version>` | 回滚到指定版本 |

## 生产环境部署

### 方法1：使用自动化脚本（推荐）

```bash
# 在项目根目录执行
./scripts/deployment/deploy-migrations.sh
```

脚本会自动：
1. ✅ 备份生产数据库
2. ✅ 上传迁移文件
3. ✅ 查看迁移状态
4. ✅ 执行迁移
5. ✅ 验证结果

### 方法2：手动部署

```bash
# 1. 备份数据库
ssh ubuntu@43.143.163.6 \
  "PGPASSWORD='H2SwIAkyzT1G4mAhkbtSULfG' \
   pg_dump -h localhost -U geo_user geo_system > backup_$(date +%Y%m%d).sql"

# 2. 上传迁移文件
scp -r server/src/db/migrations ubuntu@43.143.163.6:/var/www/geo-system/server/src/db/
scp server/src/db/migrate.ts ubuntu@43.143.163.6:/var/www/geo-system/server/src/db/
scp server/src/db/rollback.ts ubuntu@43.143.163.6:/var/www/geo-system/server/src/db/
scp server/src/db/status.ts ubuntu@43.143.163.6:/var/www/geo-system/server/src/db/

# 3. 查看状态
ssh ubuntu@43.143.163.6 "cd /var/www/geo-system/server && npm run db:status"

# 4. 执行迁移
ssh ubuntu@43.143.163.6 "cd /var/www/geo-system/server && npm run db:migrate"

# 5. 验证
ssh ubuntu@43.143.163.6 "cd /var/www/geo-system/server && npm run db:status"
curl http://43.143.163.6/api/health
```

## 迁移文件编写规范

### 基本结构

```sql
-- ==================== UP ====================
-- 描述：这次迁移做什么
-- 作者：你的名字
-- 日期：2025-12-27

-- 在这里编写向上迁移的SQL
-- 使用 IF EXISTS / IF NOT EXISTS 确保幂等性

-- ==================== DOWN ====================
-- 描述：如何回滚这次迁移

-- 在这里编写向下迁移的SQL
-- 应该完全撤销 UP 部分的变更
```

### 最佳实践

#### ✅ 推荐做法

1. **使用条件语句**
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
DROP TABLE IF EXISTS old_table;
```

2. **添加注释**
```sql
COMMENT ON COLUMN users.email IS '用户邮箱地址';
COMMENT ON TABLE orders IS '订单表';
```

3. **创建索引**
```sql
-- 为常用查询字段创建索引
CREATE INDEX IF NOT EXISTS idx_articles_created_at 
ON articles(created_at DESC);
```

4. **提供完整的回滚**
```sql
-- UP
ALTER TABLE users ADD COLUMN phone VARCHAR(20);
CREATE INDEX idx_users_phone ON users(phone);

-- DOWN
DROP INDEX IF EXISTS idx_users_phone;
ALTER TABLE users DROP COLUMN IF EXISTS phone;
```

#### ❌ 避免做法

1. **不要修改已执行的迁移**
   - 已在生产环境执行的迁移不应修改
   - 如需修改，创建新的迁移文件

2. **不要在迁移中插入业务数据**
   - 迁移只管理结构
   - 数据初始化用单独的 seed 脚本

3. **不要使用 DROP TABLE 删除有数据的表**
   - 先备份数据
   - 或使用软删除（添加 deleted_at 字段）

## 常见场景

### 场景1：添加新列

```sql
-- ==================== UP ====================
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_phone 
ON users(phone) WHERE phone IS NOT NULL;

-- ==================== DOWN ====================
DROP INDEX IF EXISTS idx_users_phone;
ALTER TABLE users 
DROP COLUMN IF EXISTS phone,
DROP COLUMN IF EXISTS phone_verified;
```

### 场景2：创建新表

```sql
-- ==================== UP ====================
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
ON notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_is_read 
ON notifications(is_read) WHERE is_read = false;

-- ==================== DOWN ====================
DROP TABLE IF EXISTS notifications CASCADE;
```

### 场景3：修改列类型

```sql
-- ==================== UP ====================
-- 修改列类型需要小心，可能导致数据丢失
ALTER TABLE users 
ALTER COLUMN age TYPE INTEGER USING age::INTEGER;

-- ==================== DOWN ====================
ALTER TABLE users 
ALTER COLUMN age TYPE VARCHAR(10) USING age::VARCHAR;
```

### 场景4：数据迁移

```sql
-- ==================== UP ====================
-- 添加新列
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);

-- 迁移数据
UPDATE users 
SET full_name = CONCAT(first_name, ' ', last_name)
WHERE full_name IS NULL;

-- 删除旧列（可选）
-- ALTER TABLE users DROP COLUMN first_name, DROP COLUMN last_name;

-- ==================== DOWN ====================
-- 如果删除了旧列，需要恢复
-- ALTER TABLE users 
-- ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
-- ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);

-- 删除新列
ALTER TABLE users DROP COLUMN IF EXISTS full_name;
```

## 故障恢复

### 迁移失败怎么办？

1. **查看错误信息**
```bash
npm run db:status
```

2. **PostgreSQL 会自动回滚**
   - 迁移在事务中执行
   - 失败会自动回滚，数据库保持原状

3. **修复问题后重新执行**
```bash
# 修改迁移文件
vim server/src/db/migrations/003_xxx.sql

# 重新执行
npm run db:migrate
```

### 需要紧急回滚？

```bash
# 1. 回滚最后一次迁移
npm run db:rollback

# 2. 重启应用
pm2 restart geo-backend

# 3. 验证系统正常
curl http://43.143.163.6/api/health
```

### 手动标记迁移状态

如果需要手动修复数据库后标记迁移为已执行：

```sql
-- 标记为已执行
INSERT INTO schema_migrations (version, name) 
VALUES ('003', 'add email verification');

-- 取消标记
DELETE FROM schema_migrations WHERE version = '003';
```

## 团队协作

### 开发流程

1. **开发新功能时**
   ```bash
   # 创建迁移
   npm run db:create -- add_feature_x
   
   # 编辑迁移文件
   # 执行迁移
   npm run db:migrate
   
   # 提交代码
   git add server/src/db/migrations/
   git commit -m "feat: add feature X database migration"
   ```

2. **拉取代码后**
   ```bash
   # 更新代码
   git pull
   
   # 查看是否有新迁移
   npm run db:status
   
   # 执行新迁移
   npm run db:migrate
   ```

3. **合并冲突**
   - 如果两个人同时创建了相同版本号的迁移
   - 重命名其中一个文件，使用下一个版本号

### 代码审查检查清单

- [ ] 迁移文件命名正确（版本号_描述.sql）
- [ ] 包含 UP 和 DOWN 两部分
- [ ] 使用 IF EXISTS / IF NOT EXISTS
- [ ] DOWN 部分能完全撤销 UP 的变更
- [ ] 添加了必要的索引
- [ ] 添加了注释说明
- [ ] 在本地测试过迁移和回滚

## 监控和维护

### 定期检查

```bash
# 查看迁移历史
npm run db:status

# 查看数据库大小
psql -h localhost -U geo_user -d geo_system -c "
  SELECT 
    pg_size_pretty(pg_database_size('geo_system')) as size;
"

# 查看表大小
psql -h localhost -U geo_user -d geo_system -c "
  SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
  LIMIT 10;
"
```

### 性能优化

定期检查是否需要：
- 添加索引
- 清理旧数据
- 优化查询
- 分区大表

## 相关文件

```
server/src/db/
├── migrations/                    # 迁移文件目录
│   ├── README.md                 # 迁移系统说明
│   ├── 001_initial_schema.sql    # 初始结构
│   └── 002_add_missing_columns.sql
├── migrate.ts                    # 迁移执行脚本
├── rollback.ts                   # 回滚脚本
├── status.ts                     # 状态查看脚本
├── create-migration.ts           # 迁移文件生成器
└── database.ts                   # 数据库连接

scripts/deployment/
└── deploy-migrations.sh          # 自动化部署脚本

DATABASE_MIGRATION_GUIDE.md       # 本文档
```

## 总结

使用这个迁移系统，你可以：

✅ **不再手动执行SQL** - 一键自动化迁移  
✅ **不再担心遗漏** - 版本控制确保所有变更都被记录  
✅ **不再害怕出错** - 支持回滚，有备份  
✅ **不再重复劳动** - 团队共享迁移文件  
✅ **不再混乱** - 清晰的迁移历史和状态

现在，每次数据库变更只需要：
1. `npm run db:create -- <描述>`
2. 编辑生成的迁移文件
3. `npm run db:migrate`
4. 提交代码

就这么简单！🎉
