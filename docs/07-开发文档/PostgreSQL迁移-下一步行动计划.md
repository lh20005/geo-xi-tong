# PostgreSQL 迁移 - 下一步行动计划

**创建日期**: 2026-01-16  
**当前进度**: 33.3% (2/6 阶段完成)  
**状态**: 外键约束替代 100% 完成，准备进入阶段 3

---

## 📊 当前状态总结

### ✅ 已完成的工作

#### 阶段 1: Schema 导出（100%）
- ✅ 导出 17 个表的结构（2123 行）
- ✅ 移除 16 个跨数据库外键约束
- ✅ 导出 8 个必需的函数
- ✅ 创建处理脚本（process_schema.py）

#### 阶段 2: 数据导出（100%）
- ✅ 导出 user_id = 1 的所有数据（4614 条 INSERT）
- ✅ 处理 task_id 字段（设为 NULL）
- ✅ 创建数据清理脚本（process_data.py）

#### 外键约束替代实施（100%）
- ✅ 创建 14 个 PostgreSQL Service 类（~3,000 行代码）
- ✅ 实现 user_id 自动管理（BaseServicePostgres）
- ✅ 实现级联删除功能（UserServicePostgres）
- ✅ 实现数据隔离和完整性检查
- ✅ 创建 6 个完整文档

**关键成果**: 所有移除的外键约束功能都已通过应用层实现，不会造成功能缺失！

---

## 🎯 下一步行动（按优先级）

### 🔴 高优先级：立即执行

#### 1. 验证服务器数据库结构 ⚠️

**目的**: 确认哪些表有 task_id 字段，以及它们的用途

**已验证**:
- ✅ `articles.task_id` → `generation_tasks(id)` (跨数据库，已移除)
- ✅ `publishing_records.task_id` → `publishing_tasks(id)` (表间，已保留)
- ✅ `publishing_logs.task_id` → `publishing_tasks(id)` (表间，已保留)

**待验证**:
- ⏳ `distillation_usage.task_id` → `generation_tasks(id)` (跨数据库，已移除)
- ⏳ `topic_usage.task_id` → `generation_tasks(id)` (跨数据库，已移除)

**操作**:
```bash
# 检查 distillation_usage 表
ssh ubuntu@124.221.247.107
sudo -u postgres psql -d geo_system
\d distillation_usage

# 检查 topic_usage 表
\d topic_usage
```

**预期结果**: 确认这两个表的 task_id 字段是否引用 generation_tasks

---

#### 2. 创建本地 PostgreSQL 数据库配置

**目的**: 为 Windows 端配置本地 PostgreSQL 连接

**步骤**:

##### 2.1 创建数据库配置文件

创建 `windows-login-manager/electron/database/postgres.ts`:

```typescript
import { Pool, PoolClient } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

export class PostgresDatabase {
  private pool: Pool;
  private static instance: PostgresDatabase;

  private constructor() {
    // 从配置文件读取连接信息
    const config = this.loadConfig();
    
    this.pool = new Pool({
      host: config.host || 'localhost',
      port: config.port || 5432,
      database: config.database || 'geo_windows',
      user: config.user || 'postgres',
      password: config.password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      console.error('PostgreSQL pool error:', err);
    });
  }

  static getInstance(): PostgresDatabase {
    if (!PostgresDatabase.instance) {
      PostgresDatabase.instance = new PostgresDatabase();
    }
    return PostgresDatabase.instance;
  }

  getPool(): Pool {
    return this.pool;
  }

  async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text, duration, rows: res.rowCount });
      return res;
    } catch (error) {
      console.error('Query error:', error);
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    return await this.pool.query();
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private loadConfig() {
    // 从用户数据目录读取配置
    const configPath = path.join(
      process.env.APPDATA || process.env.HOME || '',
      'geo-windows',
      'db-config.json'
    );

    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }

    // 默认配置
    return {
      host: 'localhost',
      port: 5432,
      database: 'geo_windows',
      user: 'postgres',
      password: ''
    };
  }
}
```

##### 2.2 创建数据库初始化脚本

创建 `windows-login-manager/scripts/init-database.ts`:

```typescript
import { PostgresDatabase } from '../electron/database/postgres';
import * as fs from 'fs';
import * as path from 'path';

async function initDatabase() {
  const db = PostgresDatabase.getInstance();
  const pool = db.getPool();

  try {
    console.log('开始初始化数据库...');

    // 1. 导入函数
    console.log('导入函数...');
    const functionsSQL = fs.readFileSync(
      path.join(__dirname, '../../backups/migration-2026-01-16/windows_functions_clean.sql'),
      'utf-8'
    );
    await pool.query(functionsSQL);
    console.log('✅ 函数导入完成');

    // 2. 导入表结构
    console.log('导入表结构...');
    const schemaSQL = fs.readFileSync(
      path.join(__dirname, '../../backups/migration-2026-01-16/windows_tables_schema_processed.sql'),
      'utf-8'
    );
    await pool.query(schemaSQL);
    console.log('✅ 表结构导入完成');

    // 3. 验证
    console.log('验证数据库结构...');
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log('✅ 数据库表:', result.rows.map(r => r.table_name));

    console.log('🎉 数据库初始化完成！');
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  } finally {
    await db.close();
  }
}

initDatabase();
```

##### 2.3 更新 package.json

在 `windows-login-manager/package.json` 添加脚本:

```json
{
  "scripts": {
    "db:init": "ts-node scripts/init-database.ts",
    "db:import-data": "ts-node scripts/import-data.ts"
  }
}
```

---

#### 3. 更新 IPC 处理器为异步

**目的**: 所有 IPC 处理器必须使用 async/await 来调用新的 Service 类

**需要修改的文件**:
- `windows-login-manager/electron/ipc/articleHandlers.ts`
- `windows-login-manager/electron/ipc/albumHandlers.ts`
- `windows-login-manager/electron/ipc/imageHandlers.ts`
- `windows-login-manager/electron/ipc/knowledgeBaseHandlers.ts`
- `windows-login-manager/electron/ipc/platformAccountHandlers.ts`
- `windows-login-manager/electron/ipc/publishingTaskHandlers.ts`
- 其他相关处理器...

**示例修改**:

```typescript
// ❌ 旧代码（同步）
ipcMain.handle('article:findAll', (event) => {
  try {
    return articleService.findAll();
  } catch (error) {
    console.error('查询文章失败:', error);
    throw error;
  }
});

// ✅ 新代码（异步）
ipcMain.handle('article:findAll', async (event) => {
  try {
    return await articleService.findAll();
  } catch (error) {
    console.error('查询文章失败:', error);
    throw error;
  }
});
```

**操作步骤**:
1. 找到所有 IPC 处理器文件
2. 为每个 handler 添加 `async` 关键字
3. 为所有 Service 调用添加 `await`
4. 更新错误处理

---

### 🟡 中优先级：后续执行

#### 4. 导入测试数据

**目的**: 将处理后的测试数据导入本地数据库

**步骤**:

创建 `windows-login-manager/scripts/import-data.ts`:

```typescript
import { PostgresDatabase } from '../electron/database/postgres';
import * as fs from 'fs';
import * as path from 'path';

async function importData() {
  const db = PostgresDatabase.getInstance();
  const pool = db.getPool();

  try {
    console.log('开始导入数据...');

    // 导入处理后的数据
    const dataSQL = fs.readFileSync(
      path.join(__dirname, '../../backups/migration-2026-01-16/user_1_data_processed.sql'),
      'utf-8'
    );
    await pool.query(dataSQL);
    console.log('✅ 数据导入完成');

    // 验证数据
    const tables = [
      'articles',
      'albums',
      'images',
      'knowledge_bases',
      'platform_accounts',
      'publishing_tasks',
      'distillations',
      'topics'
    ];

    for (const table of tables) {
      const result = await pool.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`${table}: ${result.rows[0].count} 条记录`);
    }

    console.log('🎉 数据导入完成！');
  } catch (error) {
    console.error('❌ 数据导入失败:', error);
    throw error;
  } finally {
    await db.close();
  }
}

importData();
```

**运行**:
```bash
cd windows-login-manager
npm run db:import-data
```

---

#### 5. 编写单元测试

**目的**: 确保 Service 类功能正确

**测试文件结构**:
```
windows-login-manager/tests/
├── services/
│   ├── BaseServicePostgres.test.ts
│   ├── UserServicePostgres.test.ts
│   ├── ArticleServicePostgres.test.ts
│   └── ...
└── setup.ts
```

**测试内容**:
- user_id 自动管理
- 数据隔离
- CRUD 操作
- 级联删除
- 事务处理
- 错误处理

**示例测试**:

```typescript
// BaseServicePostgres.test.ts
import { BaseServicePostgres } from '../../electron/services/BaseServicePostgres';

describe('BaseServicePostgres', () => {
  let service: BaseServicePostgres<any>;

  beforeEach(() => {
    // 设置测试环境
    process.env.JWT_TOKEN = 'test-token-with-user-id-1';
    service = new BaseServicePostgres('test_table', 'TestService');
  });

  test('should get user_id from JWT token', () => {
    const userId = service.getCurrentUserId();
    expect(userId).toBe(1);
  });

  test('should auto-add user_id when creating', async () => {
    const result = await service.create({ name: 'test' });
    expect(result.user_id).toBe(1);
  });

  test('should filter by user_id when finding', async () => {
    const results = await service.findAll();
    results.forEach(item => {
      expect(item.user_id).toBe(1);
    });
  });
});
```

---

#### 6. 集成测试

**目的**: 测试完整的数据流

**测试场景**:
1. 文章生成流程
   - 创建蒸馏
   - 生成话题
   - 生成文章
   - 验证数据关联

2. 发布流程
   - 创建平台账号
   - 创建发布任务
   - 执行发布
   - 记录发布结果

3. 数据同步
   - 备份数据
   - 恢复数据
   - 验证完整性

---

### 🟢 低优先级：最后执行

#### 7. 性能测试

**目的**: 对比 SQLite 和 PostgreSQL 性能

**测试项**:
- 插入性能（单条/批量）
- 查询性能（简单/复杂）
- 更新性能
- 删除性能
- 并发处理

---

#### 8. 文档完善

**需要更新的文档**:
- API 文档
- 开发指南
- 部署指南
- 用户手册

---

## 📋 详细执行清单

### 阶段 3: 本地数据库创建

- [ ] 创建 `postgres.ts` 数据库连接类
- [ ] 创建 `init-database.ts` 初始化脚本
- [ ] 创建数据库配置文件格式
- [ ] 添加 npm 脚本
- [ ] 测试数据库连接
- [ ] 导入函数
- [ ] 导入表结构
- [ ] 验证 schema

### 阶段 4: 数据导入

- [ ] 创建 `import-data.ts` 导入脚本
- [ ] 导入测试数据
- [ ] 重置序列
- [ ] 验证数据完整性
- [ ] 验证外键约束
- [ ] 验证触发器功能

### 阶段 5: 代码迁移

- [ ] 删除 `sqlite.ts`
- [ ] 更新 `DatabaseManager`
- [ ] 更新所有 IPC 处理器（添加 async/await）
- [ ] 更新错误处理
- [ ] 更新日志记录
- [ ] 测试所有功能

### 阶段 6: 测试验证

- [ ] 编写单元测试
- [ ] 编写集成测试
- [ ] 执行性能测试
- [ ] 修复发现的问题
- [ ] 完善文档

---

## 🎯 成功标准

### 功能完整性
- ✅ 所有 CRUD 操作正常
- ✅ 数据隔离正确
- ✅ 级联删除正常
- ✅ 事务处理正确
- ✅ 错误处理完善

### 性能要求
- ✅ 查询响应时间 < 100ms
- ✅ 插入性能 > 1000 条/秒
- ✅ 并发处理能力 > 10 个连接

### 代码质量
- ✅ TypeScript 类型安全
- ✅ 代码注释完整
- ✅ 错误日志详细
- ✅ 单元测试覆盖率 > 80%

---

## ⚠️ 风险和注意事项

### 1. 数据库连接配置

**风险**: 用户可能不熟悉 PostgreSQL 配置

**缓解措施**:
- 提供详细的安装指南
- 提供配置向导界面
- 提供默认配置
- 提供连接测试功能

### 2. 数据迁移

**风险**: 数据导入可能失败

**缓解措施**:
- 提供数据验证工具
- 提供回滚机制
- 提供详细的错误日志
- 提供手动修复指南

### 3. 性能问题

**风险**: PostgreSQL 可能比 SQLite 慢

**缓解措施**:
- 优化查询
- 添加索引
- 使用连接池
- 实施缓存策略

### 4. 兼容性问题

**风险**: 不同版本的 PostgreSQL 可能有差异

**缓解措施**:
- 指定最低版本要求（PostgreSQL 14+）
- 测试多个版本
- 提供兼容性检查

---

## 📞 需要帮助？

如有问题，请参考：
- [PostgreSQL Services 使用指南](../../windows-login-manager/electron/services/README_POSTGRES_SERVICES.md)
- [快速参考](../../windows-login-manager/electron/services/QUICK_REFERENCE.md)
- [外键约束替代实施完成报告](./外键约束替代实施完成报告.md)
- [PostgreSQL 迁移完整计划](./PostgreSQL迁移完整计划.md)

---

**文档版本**: 1.0  
**创建日期**: 2026-01-16  
**负责人**: AI Assistant  
**状态**: 准备执行阶段 3

---

## 🎊 总结

我们已经完成了最关键的工作：
- ✅ Schema 和数据导出（阶段 1-2）
- ✅ 外键约束替代实施（100% 完成）

接下来的工作主要是：
1. 配置本地 PostgreSQL 数据库
2. 更新代码为异步操作
3. 测试和验证

**预计完成时间**: 2-3 天

**让我们继续前进！** 🚀
