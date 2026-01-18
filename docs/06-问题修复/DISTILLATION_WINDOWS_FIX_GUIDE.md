# Windows 端蒸馏功能修复指南

**修复日期**: 2026-01-17  
**更新日期**: 2026-01-17 21:58  
**问题**: Windows 端蒸馏报错 `column "updated_at" of relation "distillations" does not exist`  
**状态**: ✅ 已自动修复（迁移文件已更新）

---

## ⚠️ 重要更新

**问题已在代码层面修复！** 

迁移文件 `001_init.sql` 已从 SQLite 语法转换为 PostgreSQL 语法，并包含了正确的 `updated_at` 字段定义。

**如果你是新用户或准备重建数据库**，直接启动应用即可，无需手动执行 SQL。

**如果你已有旧数据库且遇到错误**，请参考下面的手动修复步骤。

---

## 问题说明

Windows 端本地 PostgreSQL 数据库的 `distillations` 表缺少 `updated_at` 字段，导致蒸馏功能报错。

---

## 修复步骤（用户操作）

### 方法 1: 使用 psql 命令行（推荐）

1. **打开终端（Terminal）**

2. **连接到本地数据库**：
   ```bash
   psql -d geo_windows
   ```

3. **执行修复 SQL**：
   ```sql
   -- 添加 updated_at 字段
   DO $$ 
   BEGIN
       IF NOT EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'distillations' AND column_name = 'updated_at'
       ) THEN
           ALTER TABLE distillations ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
           RAISE NOTICE 'updated_at 字段已添加';
       ELSE
           RAISE NOTICE 'updated_at 字段已存在';
       END IF;
   END $$;

   -- 为现有记录设置 updated_at 值
   UPDATE distillations SET updated_at = created_at WHERE updated_at IS NULL;
   ```

4. **验证修复**：
   ```sql
   \d distillations
   ```
   
   应该能看到 `updated_at` 字段。

5. **退出 psql**：
   ```sql
   \q
   ```

6. **重启 Windows 客户端**

7. **测试蒸馏功能**

### 方法 2: 使用 SQL 文件

1. **找到修复脚本**：
   ```
   windows-login-manager/fix-distillations-updated-at.sql
   ```

2. **执行脚本**：
   ```bash
   psql -d geo_windows -f windows-login-manager/fix-distillations-updated-at.sql
   ```

3. **重启 Windows 客户端**

4. **测试蒸馏功能**

---

## 验证修复

### 1. 检查数据库字段

```bash
psql -d geo_windows -c "\d distillations"
```

应该看到：
```
 updated_at  | timestamp without time zone |           |          | now()
```

### 2. 测试蒸馏功能

1. 打开 Windows 客户端
2. 进入"关键词蒸馏"页面
3. 输入关键词（如"测试"）
4. 点击"开始蒸馏"
5. 应该能成功生成话题，不再报错

### 3. 查看蒸馏结果

1. 进入"蒸馏结果"页面
2. 应该能看到刚才蒸馏的结果
3. 在"蒸馏历史"中也应该能看到记录

---

## 常见问题

### Q1: 找不到 psql 命令

**A**: 需要安装 PostgreSQL 客户端工具。

**macOS**:
```bash
brew install postgresql
```

**Windows**:
下载并安装 PostgreSQL: https://www.postgresql.org/download/windows/

### Q2: 连接数据库失败

**A**: 检查数据库配置：

```bash
# 查看配置
cat ~/Library/Application\ Support/ai-geo-system/db-config.json
```

默认配置应该是：
```json
{
  "host": "localhost",
  "port": 5432,
  "database": "geo_windows",
  "user": "lzc",
  "password": ""
}
```

### Q3: 权限不足

**A**: 确保你的用户有权限修改数据库：

```bash
# 授予权限
psql -d geo_windows -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO lzc;"
```

### Q4: 仍然报错

**A**: 
1. 确认已执行 SQL 脚本
2. 确认已重启 Windows 客户端
3. 查看客户端日志（开发者工具 Console）
4. 如果还有问题，请提供完整的错误信息

---

## 技术说明

### 为什么需要手动执行？

Windows 端的数据库迁移系统还在开发中，目前需要手动执行 SQL 脚本来更新数据库结构。

### 未来改进

下一个版本将包含：
1. 自动迁移执行系统
2. 数据库版本管理
3. 一键修复工具

---

## 相关文件

- 修复脚本：`windows-login-manager/fix-distillations-updated-at.sql`
- 迁移文件：`windows-login-manager/electron/database/migrations/002_add_updated_at_to_distillations.sql`
- 数据库管理：`windows-login-manager/electron/database/postgres.ts`

---

## 联系支持

如果遇到问题，请提供：
1. 错误截图
2. 数据库表结构（`\d distillations` 的输出）
3. 客户端日志

✅ 按照以上步骤操作后，蒸馏功能应该能正常工作！
