/**
 * 数据库迁移执行脚本
 * 
 * 功能：
 * - 自动执行所有待迁移的SQL文件
 * - 记录迁移历史
 * - 支持事务回滚
 * 
 * 使用：npm run db:migrate
 */

import { pool } from './database';
import fs from 'fs';
import path from 'path';

interface Migration {
  version: string;
  name: string;
  filename: string;
  upSql: string;
  downSql: string;
}

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * 创建迁移历史表
 */
async function createMigrationsTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(10) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_schema_migrations_executed_at 
    ON schema_migrations(executed_at DESC);
  `;
  
  await pool.query(sql);
  log('✓ 迁移历史表已就绪', 'gray');
}

/**
 * 获取已执行的迁移版本
 */
async function getExecutedMigrations(): Promise<string[]> {
  const result = await pool.query(
    'SELECT version FROM schema_migrations ORDER BY version'
  );
  return result.rows.map(row => row.version);
}

/**
 * 读取所有迁移文件
 */
function getMigrationFiles(): Migration[] {
  const migrationsDir = path.join(__dirname, 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
    log('✓ 创建迁移目录', 'gray');
    return [];
  }
  
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  return files.map(filename => {
    const match = filename.match(/^(\d{3})_(.+)\.sql$/);
    if (!match) {
      throw new Error(`无效的迁移文件名: ${filename}`);
    }
    
    const [, version, name] = match;
    const filepath = path.join(migrationsDir, filename);
    const content = fs.readFileSync(filepath, 'utf-8');
    
    // 分离 UP 和 DOWN 部分
    const parts = content.split(/--\s*=+\s*DOWN\s*=+/i);
    if (parts.length !== 2) {
      throw new Error(`迁移文件格式错误: ${filename}\n必须包含 UP 和 DOWN 两部分`);
    }
    
    const upPart = parts[0].split(/--\s*=+\s*UP\s*=+/i)[1] || parts[0];
    const downPart = parts[1];
    
    return {
      version,
      name: name.replace(/_/g, ' '),
      filename,
      upSql: upPart.trim(),
      downSql: downPart.trim(),
    };
  });
}

/**
 * 执行单个迁移
 */
async function executeMigration(migration: Migration) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    log(`\n→ 执行迁移 ${migration.version}: ${migration.name}`, 'blue');
    
    // 执行 UP SQL
    await client.query(migration.upSql);
    
    // 记录到迁移历史
    await client.query(
      'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
      [migration.version, migration.name]
    );
    
    await client.query('COMMIT');
    log(`✓ 迁移 ${migration.version} 执行成功`, 'green');
    
  } catch (error) {
    await client.query('ROLLBACK');
    log(`✗ 迁移 ${migration.version} 执行失败`, 'red');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 主函数
 */
async function migrate() {
  try {
    log('\n🚀 开始数据库迁移...', 'blue');
    log('='.repeat(50), 'gray');
    
    // 1. 创建迁移历史表
    await createMigrationsTable();
    
    // 2. 获取已执行的迁移
    const executedVersions = await getExecutedMigrations();
    log(`✓ 已执行 ${executedVersions.length} 个迁移`, 'gray');
    
    // 3. 读取所有迁移文件
    const allMigrations = getMigrationFiles();
    log(`✓ 发现 ${allMigrations.length} 个迁移文件`, 'gray');
    
    // 4. 筛选待执行的迁移
    const pendingMigrations = allMigrations.filter(
      m => !executedVersions.includes(m.version)
    );
    
    if (pendingMigrations.length === 0) {
      log('\n✓ 数据库已是最新版本，无需迁移', 'green');
      return;
    }
    
    log(`\n📋 待执行 ${pendingMigrations.length} 个迁移:`, 'yellow');
    pendingMigrations.forEach(m => {
      log(`   ${m.version} - ${m.name}`, 'gray');
    });
    
    // 5. 执行待迁移
    log('\n开始执行迁移...', 'blue');
    for (const migration of pendingMigrations) {
      await executeMigration(migration);
    }
    
    log('\n' + '='.repeat(50), 'gray');
    log('✓ 所有迁移执行成功！', 'green');
    log(`✓ 数据库版本: ${allMigrations[allMigrations.length - 1].version}`, 'green');
    
  } catch (error) {
    log('\n' + '='.repeat(50), 'gray');
    log('✗ 迁移失败', 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// 执行迁移
if (require.main === module) {
  migrate();
}

export { migrate };
