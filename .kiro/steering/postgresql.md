# PostgreSQL 数据库配置规范（强制）

**更新日期**: 2026-01-16  
**状态**: ✅ Windows 端已从 SQLite 迁移到 PostgreSQL

---

## 概述

GEO 系统使用 PostgreSQL 作为统一的数据库解决方案：
- **Windows 端**：本地 PostgreSQL 数据库（`geo_windows`）
- **服务器端**：生产 PostgreSQL 数据库（`geo_system`）

---

## Windows 端本地数据库配置

### 数据库信息

| 项目 | 值 |
|------|-----|
| 数据库名 | `geo_windows` |
| 用户 | `lzc`（macOS 本地用户） |
| 主机 | `localhost` |
| 端口 | `5432` |
| 密码 | 无（本地开发） |

### 环境变量配置

**文件**: `windows-login-manager/.env`

```bash
# PostgreSQL 数据库配置（本地）
DB_HOST=localhost
DB_PORT=5432
DB_NAME=geo_windows
DB_USER=lzc
DB_PASSWORD=

# API 配置
VITE_API_BASE_URL=https://jzgeo.cc
VITE_WS_BASE_URL=wss://jzgeo.cc/ws
```

### 连接池配置

**文件**: `windows-login-manager/electron/database/postgres.ts`

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'geo_windows',
  user: process.env.DB_USER || 'lzc',
  password: process.env.DB_PASSWORD || '',
  max: 10,  // 最大连接数
  idleTimeoutMillis: 30000,  // 空闲超时
  connectionTimeoutMillis: 2000,  // 连接超时
});
```

### 初始化命令

```bash
# 1. 创建数据库（如果不存在）
createdb geo_windows

# 2. 进入项目目录
cd windows-login-manager

# 3. 运行初始化脚本
npm run db:init

# 4. 导入数据（可选）
npm run db:import
```

### 常用命令

```bash
# 连接数据库
psql -d geo_windows

# 查看所有表
\dt

# 查看表结构
\d articles

# 导出数据
pg_dump -U lzc -d geo_windows -f backup_$(date +%Y%m%d).sql

# 导入数据
psql -U lzc -d geo_windows -f backup_20260116.sql

# 删除数据库（谨慎！）
dropdb geo_windows
```

---

## 服务器端生产数据库配置

### 数据库信息

| 项目 | 值 |
|------|-----|
| 数据库名 | `geo_system` |
| 用户 | `geo_user` |
| 主机 | `localhost` |
| 端口 | `5432` |
| 密码 | （生产环境密码） |

### 环境变量配置

**文件**: `server/.env`

```bash
# PostgreSQL 数据库配置（生产）
DATABASE_URL=postgresql://geo_user:password@localhost:5432/geo_system

# 其他配置...
```

### 连接池配置

**文件**: `server/src/db/database.ts`

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,  // 生产环境更大的连接池
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### 常用命令

```bash
# 连接数据库（服务器上）
sudo -u postgres psql -d geo_system

# 查看所有表
\dt

# 导出数据
sudo -u postgres pg_dump -d geo_system -f backup_$(date +%Y%m%d).sql

# 导入数据
sudo -u postgres psql -d geo_system -f backup_20260116.sql

# 运行迁移
cd /var/www/geo-system/server && npm run db:migrate
```

---

## 数据库表结构规范

### 主键类型

**强制使用 SERIAL（自增整数）**

```sql
CREATE TABLE articles (
    id SERIAL PRIMARY KEY,  -- 自增整数主键
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 字段命名规范

**强制使用 snake_case**

```sql
-- ✅ 正确
user_id INTEGER
created_at TIMESTAMP
is_published BOOLEAN

-- ❌ 错误
userId INTEGER
createdAt TIMESTAMP
isPublished BOOLEAN
```

### 时间戳字段

```sql
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
```

### 布尔字段

```sql
is_published BOOLEAN DEFAULT FALSE,
is_default BOOLEAN DEFAULT FALSE,
is_active BOOLEAN DEFAULT TRUE
```

### 外键约束替代方案

**重要**：Windows 端不使用外键约束，改用应用层验证。

**原因**：
- 避免级联删除的复杂性
- 提高数据操作灵活性
- 简化数据迁移和同步

**实现方式**：

```typescript
// 在 Service 层验证关联
async create(data: CreateInput): Promise<Entity> {
  // 验证 user_id 存在
  const userExists = await this.pool.query(
    'SELECT 1 FROM users WHERE id = $1',
    [data.user_id]
  );
  
  if (userExists.rows.length === 0) {
    throw new Error('User not found');
  }
  
  // 执行插入
  const result = await this.pool.query(
    'INSERT INTO entities (user_id, name) VALUES ($1, $2) RETURNING *',
    [data.user_id, data.name]
  );
  
  return result.rows[0];
}
```

---

## 数据库迁移规范

### Windows 端迁移文件

**位置**: `windows-login-manager/electron/database/migrations/`

**命名**: `001_initial_schema.sql`, `002_add_indexes.sql`, ...

**模板**:

```sql
-- 迁移文件: 001_initial_schema.sql

-- ==================== UP ====================

CREATE TABLE IF NOT EXISTS articles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_articles_user_id ON articles(user_id);
CREATE INDEX idx_articles_created_at ON articles(created_at);

-- 注释
COMMENT ON TABLE articles IS '文章表';
COMMENT ON COLUMN articles.user_id IS '用户 ID';

-- ==================== DOWN ====================

DROP TABLE IF EXISTS articles;
```

### 服务器端迁移文件

**位置**: `server/src/db/migrations/`

**命名**: `001_create_users.sql`, `002_create_articles.sql`, ...

**执行命令**:

```bash
# 查看迁移状态
npm run db:status

# 执行待迁移
npm run db:migrate

# 回滚上次迁移
npm run db:rollback

# 创建新迁移
npm run db:create -- <名称>
```

---

## 数据类型对照表

| PostgreSQL 类型 | 说明 | 示例 |
|----------------|------|------|
| `SERIAL` | 自增整数主键 | `id SERIAL PRIMARY KEY` |
| `INTEGER` | 整数 | `user_id INTEGER NOT NULL` |
| `BIGINT` | 大整数 | `file_size BIGINT` |
| `TEXT` | 文本（无长度限制） | `content TEXT` |
| `VARCHAR(n)` | 可变长度字符串 | `username VARCHAR(50)` |
| `BOOLEAN` | 布尔值 | `is_published BOOLEAN DEFAULT FALSE` |
| `TIMESTAMP` | 时间戳 | `created_at TIMESTAMP DEFAULT NOW()` |
| `DATE` | 日期 | `birth_date DATE` |
| `JSONB` | JSON 二进制格式 | `metadata JSONB` |
| `DECIMAL(m,n)` | 精确小数 | `price DECIMAL(10,2)` |
| `UUID` | UUID 类型 | `reservation_id UUID` |
| `BYTEA` | 二进制数据 | `file_data BYTEA` |

---

## 查询优化规范

### 使用参数化查询

```typescript
// ✅ 正确：防止 SQL 注入
const result = await pool.query(
  'SELECT * FROM articles WHERE user_id = $1 AND title LIKE $2',
  [userId, `%${keyword}%`]
);

// ❌ 错误：SQL 注入风险
const result = await pool.query(
  `SELECT * FROM articles WHERE user_id = ${userId} AND title LIKE '%${keyword}%'`
);
```

### 使用索引

```sql
-- 为常用查询字段创建索引
CREATE INDEX idx_articles_user_id ON articles(user_id);
CREATE INDEX idx_articles_created_at ON articles(created_at);
CREATE INDEX idx_articles_title ON articles USING gin(to_tsvector('english', title));
```

### 批量操作

```typescript
// ✅ 正确：批量插入
const values = articles.map((a, i) => 
  `($${i*3+1}, $${i*3+2}, $${i*3+3})`
).join(',');

const params = articles.flatMap(a => [a.userId, a.title, a.content]);

await pool.query(
  `INSERT INTO articles (user_id, title, content) VALUES ${values}`,
  params
);

// ❌ 错误：逐条插入
for (const article of articles) {
  await pool.query(
    'INSERT INTO articles (user_id, title, content) VALUES ($1, $2, $3)',
    [article.userId, article.title, article.content]
  );
}
```

---

## 事务处理

### 基本事务

```typescript
const client = await pool.connect();

try {
  await client.query('BEGIN');
  
  // 执行多个操作
  await client.query('INSERT INTO articles ...');
  await client.query('UPDATE users ...');
  
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

### 事务隔离级别

```typescript
// 设置隔离级别
await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
```

---

## 备份和恢复

### Windows 端备份

```bash
# 完整备份
pg_dump -U lzc -d geo_windows -f backup_full_$(date +%Y%m%d).sql

# 仅数据备份
pg_dump -U lzc -d geo_windows --data-only -f backup_data_$(date +%Y%m%d).sql

# 仅结构备份
pg_dump -U lzc -d geo_windows --schema-only -f backup_schema_$(date +%Y%m%d).sql

# 恢复备份
psql -U lzc -d geo_windows -f backup_full_20260116.sql
```

### 服务器端备份

```bash
# 完整备份
sudo -u postgres pg_dump -d geo_system -f backup_full_$(date +%Y%m%d).sql

# 压缩备份
sudo -u postgres pg_dump -d geo_system | gzip > backup_$(date +%Y%m%d).sql.gz

# 恢复备份
sudo -u postgres psql -d geo_system -f backup_full_20260116.sql

# 恢复压缩备份
gunzip -c backup_20260116.sql.gz | sudo -u postgres psql -d geo_system
```

---

## 性能监控

### 查看活动连接

```sql
SELECT * FROM pg_stat_activity WHERE datname = 'geo_windows';
```

### 查看表大小

```sql
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 查看慢查询

```sql
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

---

## 常见问题

### 1. 连接失败：role "postgres" does not exist

**问题**: Windows 端配置了错误的用户名

**解决方案**:
```bash
# 检查 .env 文件
DB_USER=lzc  # 应该是本地用户名，不是 postgres
```

### 2. 数据库不存在

**解决方案**:
```bash
# 创建数据库
createdb geo_windows
```

### 3. 权限不足

**解决方案**:
```bash
# 授予权限
psql -d geo_windows -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO lzc;"
```

### 4. 连接池耗尽

**解决方案**:
```typescript
// 增加连接池大小
const pool = new Pool({
  max: 20,  // 从 10 增加到 20
});
```

---

## 禁止事项

### ❌ 绝对禁止

1. 在 Windows 端使用 SQLite（已迁移到 PostgreSQL）
2. 使用外键约束（使用应用层验证）
3. 字段名使用 camelCase（必须使用 snake_case）
4. **主键使用 UUID（必须使用 SERIAL，GEO 系统无例外）**
5. 明文存储敏感数据（必须加密）
6. 跳过参数化查询（防止 SQL 注入）
7. 混用 UUID 和 INTEGER 类型（必须类型一致）
8. **认为 API 传递的 ID 需要 UUID（错误！只是临时参数）**

### ✅ 必须遵守

1. Windows 端数据库名：`geo_windows`
2. 服务器端数据库名：`geo_system`
3. 字段命名：`snake_case`
4. **主键类型：SERIAL（自增整数），所有表无例外**
5. 时间戳：`TIMESTAMP DEFAULT NOW()`
6. 布尔值：`BOOLEAN DEFAULT FALSE`
7. 参数化查询：使用 `$1, $2, ...`
8. 连接池：使用 `pg.Pool`
9. 事务：使用 `BEGIN/COMMIT/ROLLBACK`
10. 备份：定期备份数据库
11. 类型一致性：关联字段必须使用相同类型
12. **API 传递的 ID：使用 number 类型（对应 SERIAL）**

---

## UUID vs SERIAL 主键策略

### 推荐：统一使用 SERIAL

**GEO 系统特点**：
- ✅ 单实例 PostgreSQL 部署
- ✅ 集中式数据库架构
- ✅ 无分布式 ID 生成需求
- ✅ 高性能查询要求

**结论**：使用 SERIAL（自增整数）作为主键

### 性能对比

| 指标 | SERIAL | UUID | 差异 |
|------|--------|------|------|
| 插入速度 | 快 | 慢 3.75x | ⚠️ |
| 索引大小 | 小 | 大 2x | ⚠️ |
| 存储空间 | 8 字节 | 16 字节 | ⚠️ |
| 查询速度 | 快 | 慢 2.4x | ⚠️ |
| 索引碎片 | 少 | 多 | ⚠️ |

### 特殊场景

**GEO 系统中没有需要使用 UUID 的场景！**

**所有表都使用 SERIAL（自增整数）主键。**

**之前的错误判断**：
- ❌ 认为 `quota_reservations` 需要 UUID（因为"跨系统引用"）
- ❌ 认为 `sync_snapshots` 需要 UUID（因为"跨系统引用"）

**正确理解**：
- ✅ Windows 端和服务器端是两个独立的数据库
- ✅ 它们通过 HTTP API 通信
- ✅ API 中传递的 ID 只是临时参数，不持久化到 Windows 端数据库
- ✅ 因此不需要 UUID 的"全局唯一性"

**判断标准**：
- 只有当 ID 需要在**不同数据库**之间**持久化存储**时才考虑 UUID
- GEO 系统中没有这样的场景

### 双 ID 策略（可选，未使用）

如果需要对外暴露不可预测的 ID：

```sql
CREATE TABLE orders (
    -- 内部主键（性能优化）
    id SERIAL PRIMARY KEY,
    
    -- 外部公开 ID（安全性）
    public_id VARCHAR(32) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    
    user_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**使用方式**：
- 内部查询：使用 `id`（快速）
- 外部 API：使用 `public_id`（安全）

---

## 参考资源

- [PostgreSQL 官方文档](https://www.postgresql.org/docs/)
- [node-postgres 文档](https://node-postgres.com/)
- [PostgreSQL 性能优化](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [PostgreSQL 最佳实践](https://wiki.postgresql.org/wiki/Don%27t_Do_This)
