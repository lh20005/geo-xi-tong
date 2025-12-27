# 迁移系统清理指南

## 当前状况

目前 `server/src/db/migrations/` 目录下有很多旧的迁移文件，这些文件是在建立系统化迁移方案之前创建的，格式不统一，管理混乱。

## 问题

1. **版本号冲突**：多个文件使用相同的版本号（如 001, 002, 003）
2. **格式不统一**：有些文件没有 UP/DOWN 分隔
3. **命名混乱**：有些文件没有版本号前缀
4. **难以管理**：无法确定执行顺序

## 解决方案

### 方案1：全新开始（推荐用于新项目）

如果这是一个新项目或可以重建数据库：

```bash
# 1. 备份当前数据库
pg_dump -h localhost -U geo_user geo_system > backup_before_cleanup.sql

# 2. 清空迁移目录（保留 README.md 和新的迁移文件）
cd server/src/db/migrations
mkdir ../migrations_backup
mv *.sql ../migrations_backup/  # 备份所有旧文件
mv ../migrations_backup/001_initial_schema.sql ./
mv ../migrations_backup/002_add_missing_columns.sql ./

# 3. 重新初始化数据库
dropdb -h localhost -U geo_user geo_system
createdb -h localhost -U geo_user geo_system

# 4. 执行新的迁移系统
cd ../../..
npm run db:migrate
```

### 方案2：保留现有数据（推荐用于生产环境）

如果需要保留现有数据库和数据：

```bash
# 1. 创建一个完整的初始迁移
cd server/src/db/migrations

# 2. 导出当前数据库结构
PGPASSWORD='your_password' pg_dump -h localhost -U geo_user -d geo_system \
  --schema-only --no-owner --no-privileges \
  > 001_initial_schema_complete.sql

# 3. 格式化为标准迁移文件
cat > 001_initial_schema.sql << 'EOF'
-- ==================== UP ====================
-- 初始数据库结构（从现有数据库导出）
-- 日期：2025-12-27

EOF

# 添加导出的结构
cat 001_initial_schema_complete.sql >> 001_initial_schema.sql

# 添加 DOWN 部分
cat >> 001_initial_schema.sql << 'EOF'

-- ==================== DOWN ====================
-- 删除所有表

-- 在这里列出所有表的 DROP 语句
EOF

# 4. 移动旧文件到备份目录
mkdir ../migrations_old
mv 001_add_ollama_support.sql ../migrations_old/
mv 001_create_security_tables.sql ../migrations_old/
# ... 移动所有旧文件

# 5. 手动标记初始迁移为已执行
psql -h localhost -U geo_user -d geo_system << 'EOF'
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(10) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schema_migrations (version, name) 
VALUES ('001', 'initial schema')
ON CONFLICT (version) DO NOTHING;
EOF

# 6. 验证状态
npm run db:status
```

## 推荐的清理步骤（生产环境）

### 步骤1：备份一切

```bash
# 备份数据库
PGPASSWORD='H2SwIAkyzT1G4mAhkbtSULfG' pg_dump -h localhost -U geo_user geo_system \
  > backup_$(date +%Y%m%d_%H%M%S).sql

# 备份迁移文件
cp -r server/src/db/migrations server/src/db/migrations_backup_$(date +%Y%m%d)
```

### 步骤2：创建完整的初始迁移

```bash
# 导出当前数据库结构
PGPASSWORD='H2SwIAkyzT1G4mAhkbtSULfG' pg_dump -h localhost -U geo_user -d geo_system \
  --schema-only --no-owner --no-privileges \
  > server/src/db/current_schema.sql

# 手动编辑 001_initial_schema.sql
# 将 current_schema.sql 的内容放到 UP 部分
# 在 DOWN 部分添加所有表的 DROP 语句
```

### 步骤3：清理旧文件

```bash
cd server/src/db/migrations

# 创建备份目录
mkdir -p ../migrations_old

# 移动所有旧的迁移文件（除了新的 001 和 002）
for file in *.sql; do
  if [[ "$file" != "001_initial_schema.sql" ]] && \
     [[ "$file" != "002_add_missing_columns.sql" ]] && \
     [[ "$file" != "README.md" ]]; then
    mv "$file" ../migrations_old/
  fi
done

# 查看结果
ls -la
```

### 步骤4：初始化迁移系统

```bash
# 在数据库中创建迁移历史表并标记初始迁移为已执行
PGPASSWORD='H2SwIAkyzT1G4mAhkbtSULfG' psql -h localhost -U geo_user -d geo_system << 'EOF'
-- 创建迁移历史表
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(10) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_executed_at 
ON schema_migrations(executed_at DESC);

-- 标记初始迁移为已执行
INSERT INTO schema_migrations (version, name) 
VALUES ('001', 'initial schema')
ON CONFLICT (version) DO NOTHING;

-- 标记第二个迁移为已执行（因为这些列已经存在）
INSERT INTO schema_migrations (version, name) 
VALUES ('002', 'add missing columns')
ON CONFLICT (version) DO NOTHING;

-- 查看状态
SELECT * FROM schema_migrations ORDER BY version;
EOF
```

### 步骤5：验证

```bash
# 查看迁移状态
cd server
npm run db:status

# 应该显示：
# ✓ 当前数据库版本: 002
# ✓ 已执行迁移: 2/2
# ✓ 数据库已是最新版本
```

## 生产环境部署清理脚本

创建一个自动化清理脚本：

```bash
#!/bin/bash
# scripts/deployment/cleanup-migrations.sh

set -e

SERVER_USER="ubuntu"
SERVER_HOST="43.143.163.6"
SERVER_PASSWORD="Woaini7758521@"
DB_PASSWORD="H2SwIAkyzT1G4mAhkbtSULfG"

echo "🧹 清理迁移系统..."

# 1. 备份
echo "📦 备份数据库..."
sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no \
  $SERVER_USER@$SERVER_HOST \
  "PGPASSWORD='$DB_PASSWORD' pg_dump -h localhost -U geo_user geo_system > /tmp/backup_before_cleanup.sql"

# 2. 备份迁移文件
echo "📦 备份迁移文件..."
sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no \
  $SERVER_USER@$SERVER_HOST \
  "cp -r /var/www/geo-system/server/src/db/migrations /var/www/geo-system/server/src/db/migrations_old"

# 3. 清理旧文件
echo "🗑️  清理旧迁移文件..."
sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no \
  $SERVER_USER@$SERVER_HOST << 'ENDSSH'
cd /var/www/geo-system/server/src/db/migrations
for file in *.sql; do
  if [[ "$file" != "001_initial_schema.sql" ]] && \
     [[ "$file" != "002_add_missing_columns.sql" ]]; then
    rm -f "$file"
  fi
done
ENDSSH

# 4. 初始化迁移系统
echo "🔧 初始化迁移系统..."
sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no \
  $SERVER_USER@$SERVER_HOST \
  "PGPASSWORD='$DB_PASSWORD' psql -h localhost -U geo_user -d geo_system" << 'ENDSQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(10) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schema_migrations (version, name) 
VALUES ('001', 'initial schema'), ('002', 'add missing columns')
ON CONFLICT (version) DO NOTHING;
ENDSQL

# 5. 验证
echo "✅ 验证迁移状态..."
sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no \
  $SERVER_USER@$SERVER_HOST \
  "cd /var/www/geo-system/server && npm run db:status"

echo "✅ 清理完成！"
```

## 清理后的目录结构

```
server/src/db/
├── migrations/
│   ├── README.md                    # 迁移系统说明
│   ├── 001_initial_schema.sql       # 完整的初始结构
│   └── 002_add_missing_columns.sql  # 后续添加的列
├── migrations_old/                  # 旧的迁移文件（备份）
│   ├── 001_add_ollama_support.sql
│   ├── 001_create_security_tables.sql
│   └── ...
├── migrate.ts                       # 迁移执行脚本
├── rollback.ts                      # 回滚脚本
├── status.ts                        # 状态查看脚本
└── create-migration.ts              # 迁移文件生成器
```

## 注意事项

### ⚠️ 重要警告

1. **生产环境操作前必须备份**
   ```bash
   pg_dump -h localhost -U geo_user geo_system > backup.sql
   ```

2. **在测试环境先验证**
   - 先在开发环境测试清理流程
   - 确认无误后再在生产环境执行

3. **保留旧文件备份**
   - 不要删除旧的迁移文件
   - 移动到 `migrations_old/` 目录保存

4. **团队沟通**
   - 通知团队成员清理计划
   - 确保所有人都更新代码

### ✅ 检查清单

清理前：
- [ ] 备份生产数据库
- [ ] 备份迁移文件
- [ ] 在测试环境验证
- [ ] 通知团队成员

清理后：
- [ ] 验证迁移状态
- [ ] 测试API功能
- [ ] 检查应用日志
- [ ] 更新文档

## 总结

清理迁移系统后，你将获得：

✅ **清晰的版本控制** - 只有两个基础迁移文件  
✅ **统一的格式** - 所有迁移都遵循 UP/DOWN 格式  
✅ **易于管理** - 版本号连续，命名规范  
✅ **可追溯** - 清晰的迁移历史  

从现在开始，所有新的数据库变更都使用新的迁移系统：
1. `npm run db:create -- <描述>`
2. 编辑生成的迁移文件
3. `npm run db:migrate`
4. 提交到Git

简单、清晰、高效！🎉
