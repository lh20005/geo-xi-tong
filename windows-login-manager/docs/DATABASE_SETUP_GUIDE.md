# PostgreSQL 数据库配置指南

本指南将帮助你配置 Windows 桌面客户端的本地 PostgreSQL 数据库。

---

## 📋 前置要求

### 1. 安装 PostgreSQL

**Windows 用户**：

1. 下载 PostgreSQL 安装包：https://www.postgresql.org/download/windows/
2. 推荐版本：PostgreSQL 14 或更高版本
3. 安装时记住设置的密码（默认用户名是 `postgres`）
4. 确保安装了 pgAdmin（图形化管理工具）

**验证安装**：

```bash
# 打开命令行，检查 PostgreSQL 是否安装成功
psql --version
```

应该显示类似：`psql (PostgreSQL) 14.x`

---

## 🚀 快速开始

### 步骤 1：安装依赖

```bash
cd windows-login-manager
npm install
```

这会安装 `pg`（PostgreSQL 客户端）和其他必需的依赖。

---

### 步骤 2：创建数据库

使用 pgAdmin 或命令行创建数据库：

**方法 A：使用 pgAdmin**

1. 打开 pgAdmin
2. 连接到本地 PostgreSQL 服务器
3. 右键点击 "Databases" → "Create" → "Database"
4. 数据库名称：`geo_windows`
5. 点击 "Save"

**方法 B：使用命令行**

```bash
# 连接到 PostgreSQL
psql -U postgres

# 创建数据库
CREATE DATABASE geo_windows;

# 退出
\q
```

---

### 步骤 3：配置数据库连接

运行配置向导：

```bash
npm run db:setup
```

按提示输入：
- 数据库主机：`localhost`（默认）
- 数据库端口：`5432`（默认）
- 数据库名称：`geo_windows`（默认）
- 用户名：`postgres`（默认）
- 密码：你安装 PostgreSQL 时设置的密码

配置会保存到：`%APPDATA%/ai-geo-system/db-config.json`

---

### 步骤 4：初始化数据库结构

```bash
npm run db:init
```

这会：
1. 连接到数据库
2. 导入函数定义（8 个函数）
3. 导入表结构（17 个表）
4. 验证数据库结构

**预期输出**：

```
🚀 开始初始化数据库...

📡 连接到数据库...
✅ 数据库连接成功

📦 导入函数定义...
✅ 函数导入完成

📦 导入表结构...
共 XXX 条 SQL 语句
✅ 表结构导入完成

🔍 验证数据库结构...

✅ 数据库表 (17 个):
  - articles
  - albums
  - images
  ...

✅ 数据库函数 (8 个):
  - sync_article_distillation_snapshot
  - update_article_image_size
  ...

🎉 数据库初始化完成！
```

---

### 步骤 5：导入测试数据（可选）

```bash
npm run db:import-data
```

这会导入测试用户（user_id = 1）的数据，包括：
- 2 篇文章
- 1 个相册
- 2 张图片
- 1 个知识库
- 1 个平台账号
- 7 个发布任务
- 1 个蒸馏
- 12 个话题

---

## 🔧 配置文件

### 配置文件位置

Windows: `%APPDATA%/ai-geo-system/db-config.json`

### 配置文件格式

```json
{
  "host": "localhost",
  "port": 5432,
  "database": "geo_windows",
  "user": "postgres",
  "password": "your_password"
}
```

### 手动修改配置

如果需要修改配置，可以：

1. 直接编辑配置文件
2. 或重新运行 `npm run db:setup`

---

## 🔍 验证安装

### 检查数据库连接

使用 pgAdmin 或命令行：

```bash
psql -U postgres -d geo_windows -c "SELECT COUNT(*) FROM articles;"
```

应该显示文章数量。

### 检查表结构

```bash
psql -U postgres -d geo_windows -c "\dt"
```

应该显示 17 个表。

### 检查函数

```bash
psql -U postgres -d geo_windows -c "\df"
```

应该显示 8 个函数。

---

## ❓ 常见问题

### Q1: 连接失败 "password authentication failed"

**原因**：密码错误

**解决**：
1. 确认 PostgreSQL 安装时设置的密码
2. 重新运行 `npm run db:setup` 输入正确密码

---

### Q2: 连接失败 "could not connect to server"

**原因**：PostgreSQL 服务未启动

**解决**：
1. 打开 "服务"（Windows + R → `services.msc`）
2. 找到 "postgresql-x64-14"（版本号可能不同）
3. 右键 → "启动"

---

### Q3: 数据库 "geo_windows" 不存在

**原因**：未创建数据库

**解决**：
1. 使用 pgAdmin 或命令行创建数据库
2. 参考"步骤 2：创建数据库"

---

### Q4: 初始化失败 "already exists"

**原因**：表或函数已存在

**解决**：
- 这是正常的，脚本会跳过已存在的对象
- 如果需要重新初始化，先删除数据库：
  ```bash
  psql -U postgres -c "DROP DATABASE geo_windows;"
  psql -U postgres -c "CREATE DATABASE geo_windows;"
  npm run db:init
  ```

---

### Q5: 如何备份数据？

**使用 pg_dump**：

```bash
pg_dump -U postgres -d geo_windows -f backup.sql
```

**恢复备份**：

```bash
psql -U postgres -d geo_windows -f backup.sql
```

---

## 📚 相关文档

- [PostgreSQL 官方文档](https://www.postgresql.org/docs/)
- [pg 客户端文档](https://node-postgres.com/)
- [PostgreSQL Services 使用指南](../electron/services/README_POSTGRES_SERVICES.md)
- [PostgreSQL 迁移完整计划](../../docs/07-开发文档/PostgreSQL迁移完整计划.md)

---

## 🆘 需要帮助？

如果遇到问题：

1. 检查 PostgreSQL 服务是否运行
2. 检查配置文件是否正确
3. 查看错误日志
4. 参考常见问题部分

---

**文档版本**: 1.0  
**创建日期**: 2026-01-16  
**适用版本**: PostgreSQL 14+
