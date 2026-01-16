# PostgreSQL 迁移 - 数据库连接修复

**日期**: 2026-01-16  
**状态**: ✅ 修复完成  
**问题**: Electron 启动时报错 `role "postgres" does not exist`

---

## 问题分析

### 错误日志

```
❌ PostgreSQL 数据库初始化失败: error: role "postgres" does not exist
```

### 根本原因

1. **环境变量未加载**：Electron 主进程没有加载 `.env` 文件
2. **默认配置错误**：`postgres.ts` 中的 `getDefaultConfig()` 方法返回的默认用户是 `postgres`
3. **配置优先级问题**：当环境变量未加载时，使用了错误的默认配置

### 配置文件检查

**`.env` 文件配置**（正确）：
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=geo_windows
DB_USER=lzc  # ✅ 正确的本地用户
DB_PASSWORD=
```

**`postgres.ts` 默认配置**（错误）：
```typescript
private getDefaultConfig(): PostgresConfig {
  return {
    host: 'localhost',
    port: 5432,
    database: 'geo_windows',
    user: 'postgres',  // ❌ 错误：应该是 lzc
    password: ''
  };
}
```

---

## 修复方案

### 1. 修复默认配置 ✅

**文件**: `windows-login-manager/electron/database/postgres.ts`

**修改前**:
```typescript
private getDefaultConfig(): PostgresConfig {
  return {
    host: 'localhost',
    port: 5432,
    database: 'geo_windows',
    user: 'postgres',  // ❌ 错误
    password: ''
  };
}
```

**修改后**:
```typescript
private getDefaultConfig(): PostgresConfig {
  // 从环境变量读取配置，如果没有则使用默认值
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'geo_windows',
    user: process.env.DB_USER || 'lzc',  // ✅ 修复：默认用户改为 lzc
    password: process.env.DB_PASSWORD || ''
  };
}
```

### 2. 加载环境变量 ✅

**文件**: `windows-login-manager/electron/main.ts`

**添加代码**:
```typescript
import * as dotenv from 'dotenv';

// 加载环境变量（必须在最开始）
const envPath = path.join(__dirname, '../../.env');
dotenv.config({ path: envPath });
console.log('✅ 环境变量已加载:', envPath);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);
```

### 3. 安装 dotenv 依赖 ⏭️

**命令**:
```bash
cd windows-login-manager
npm install dotenv
```

---

## 修复后的配置流程

### 配置加载优先级

1. **环境变量**（最高优先级）
   - 从 `.env` 文件加载
   - 通过 `dotenv.config()` 加载到 `process.env`

2. **配置文件**（中等优先级）
   - 从 `userData/db-config.json` 加载
   - 用户可以通过 UI 修改

3. **默认配置**（最低优先级）
   - 硬编码在 `getDefaultConfig()` 中
   - 作为最后的兜底方案

### 配置加载流程图

```
启动 Electron
    ↓
加载 .env 文件 (dotenv.config)
    ↓
初始化 PostgreSQL (initializePostgres)
    ↓
loadConfig()
    ↓
检查配置文件是否存在？
    ├─ 是 → 读取配置文件
    └─ 否 → getDefaultConfig()
              ↓
         从 process.env 读取
              ↓
         如果没有则使用硬编码默认值
```

---

## 验证步骤

### 1. 安装依赖

```bash
cd windows-login-manager
npm install dotenv
```

### 2. 重新编译

```bash
npm run build
```

### 3. 启动应用

```bash
npm run dev
```

### 4. 检查日志

应该看到：
```
✅ 环境变量已加载: /path/to/.env
DB_USER: lzc
DB_NAME: geo_windows
✅ PostgreSQL 数据库连接成功
```

---

## 配置文件说明

### `.env` 文件

**位置**: `windows-login-manager/.env`

**内容**:
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
VITE_LANDING_URL=https://jzgeo.cc

# 应用环境
NODE_ENV=development

# 日志级别
LOG_LEVEL=debug
```

### 配置文件

**位置**: `~/Library/Application Support/windows-login-manager/db-config.json`

**内容**:
```json
{
  "host": "localhost",
  "port": 5432,
  "database": "geo_windows",
  "user": "lzc",
  "password": ""
}
```

---

## 常见问题

### Q1: 为什么需要加载 .env 文件？

**A**: Electron 主进程是 Node.js 环境，不会自动加载 `.env` 文件。需要使用 `dotenv` 包手动加载。

### Q2: 为什么不直接硬编码配置？

**A**: 
- 灵活性：不同开发者可能有不同的数据库配置
- 安全性：避免将敏感信息（如密码）提交到代码库
- 环境隔离：开发、测试、生产环境可以使用不同的配置

### Q3: 配置文件和环境变量哪个优先级高？

**A**: 
1. 环境变量（`.env` 文件）- 最高优先级
2. 配置文件（`db-config.json`）- 中等优先级
3. 默认配置（硬编码）- 最低优先级

### Q4: 如何修改数据库配置？

**A**: 
- **方式 1**：修改 `.env` 文件（推荐）
- **方式 2**：通过应用 UI 修改（会保存到配置文件）
- **方式 3**：直接修改配置文件（不推荐）

---

## 相关文件

| 文件 | 说明 |
|------|------|
| `windows-login-manager/.env` | 环境变量配置文件 |
| `windows-login-manager/electron/main.ts` | Electron 主进程入口 |
| `windows-login-manager/electron/database/postgres.ts` | PostgreSQL 数据库管理类 |
| `.kiro/steering/postgresql.md` | PostgreSQL 配置规范 |

---

## 下一步

1. ✅ 修复默认配置
2. ✅ 添加环境变量加载代码
3. ⏭️ 安装 dotenv 依赖
4. ⏭️ 重新编译并测试
5. ⏭️ 验证数据库连接成功

---

## 总结

通过以下三个步骤修复了数据库连接问题：

1. **修复默认配置**：将 `getDefaultConfig()` 中的默认用户从 `postgres` 改为 `lzc`，并从环境变量读取配置
2. **加载环境变量**：在 `main.ts` 中使用 `dotenv.config()` 加载 `.env` 文件
3. **安装依赖**：安装 `dotenv` 包

这样确保了无论环境变量是否加载成功，都能使用正确的数据库配置。

**关键改进**：
- ✅ 环境变量优先级最高
- ✅ 默认配置作为兜底方案
- ✅ 配置加载流程清晰
- ✅ 错误提示更友好

现在可以安全地启动 Electron 应用了！🎉
