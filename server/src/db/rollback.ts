/**
 * 数据库迁移回滚脚本
 * 
 * 功能：
 * - 回滚最后一次迁移
 * - 支持回滚到指定版本
 * - 自动执行 DOWN SQL
 * 
 * 使用：
 * - npm run db:rollback              # 回滚最后一次
 * - npm run db:rollback -- --to=003  # 回滚到版本003
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
 * 获取已执行的迁移
 */
async function getExecutedMigrations(): Promise<Array<{version: string, name: string}>> {
  const result = await pool.query(
    'SELECT version, name FROM schema_migrations ORDER BY version DESC'
  );
  return result.rows;
}

/**
 * 读取迁移文件
 */
function getMigrationFile(version: string): Migration | null {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.startsWith(version) && f.endsWith('.sql'));
  
  if (files.length === 0) {
    return null;
  }
  
  const filename = files[0];
  const match = filename.match(/^(\d{3})_(.+)\.sql$/);
  if (!match) {
    return null;
  }
  
  const [, ver, name] = match;
  const filepath = path.join(migrationsDir, filename);
  const content = fs.readFileSync(filepath, 'utf-8');
  
  // 分离 UP 和 DOWN 部分
  const parts = content.split(/--\s*=+\s*DOWN\s*=+/i);
  if (parts.length !== 2) {
    throw new Error(`迁移文件格式错误: ${filename}`);
  }
  
  const upPart = parts[0].split(/--\s*=+\s*UP\s*=+/i)[1] || parts[0];
  const downPart = parts[1];
  
  return {
    version: ver,
    name: name.replace(/_/g, ' '),
    filename,
    upSql: upPart.trim(),
    downSql: downPart.trim(),
  };
}

/**
 * 回滚单个迁移
 */
async function rollbackMigration(migration: Migration) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    log(`\n→ 回滚迁移 ${migration.version}: ${migration.name}`, 'blue');
    
    // 执行 DOWN SQL
    await client.query(migration.downSql);
    
    // 从迁移历史中删除
    await client.query(
      'DELETE FROM schema_migrations WHERE version = $1',
      [migration.version]
    );
    
    await client.query('COMMIT');
    log(`✓ 迁移 ${migration.version} 回滚成功`, 'green');
    
  } catch (error) {
    await client.query('ROLLBACK');
    log(`✗ 迁移 ${migration.version} 回滚失败`, 'red');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 主函数
 */
async function rollback() {
  try {
    // 解析命令行参数
    const args = process.argv.slice(2);
    const toVersionArg = args.find(arg => arg.startsWith('--to='));
    const targetVersion = toVersionArg ? toVersionArg.split('=')[1] : null;
    
    log('\n🔄 开始回滚数据库迁移...', 'blue');
    log('='.repeat(50), 'gray');
    
    // 1. 获取已执行的迁移
    const executedMigrations = await getExecutedMigrations();
    
    if (executedMigrations.length === 0) {
      log('\n✓ 没有可回滚的迁移', 'yellow');
      return;
    }
    
    log(`✓ 当前数据库版本: ${executedMigrations[0].version}`, 'gray');
    
    // 2. 确定要回滚的迁移
    let migrationsToRollback: Array<{version: string, name: string}>;
    
    if (targetVersion) {
      // 回滚到指定版本
      const targetIndex = executedMigrations.findIndex(m => m.version === targetVersion);
      if (targetIndex === -1) {
        throw new Error(`未找到版本 ${targetVersion}`);
      }
      migrationsToRollback = executedMigrations.slice(0, targetIndex);
      log(`✓ 将回滚到版本 ${targetVersion}`, 'gray');
    } else {
      // 回滚最后一次
      migrationsToRollback = [executedMigrations[0]];
      log(`✓ 将回滚最后一次迁移`, 'gray');
    }
    
    if (migrationsToRollback.length === 0) {
      log('\n✓ 已经是目标版本，无需回滚', 'yellow');
      return;
    }
    
    log(`\n📋 待回滚 ${migrationsToRollback.length} 个迁移:`, 'yellow');
    migrationsToRollback.forEach(m => {
      log(`   ${m.version} - ${m.name}`, 'gray');
    });
    
    // 3. 执行回滚
    log('\n开始执行回滚...', 'blue');
    for (const executed of migrationsToRollback) {
      const migration = getMigrationFile(executed.version);
      if (!migration) {
        throw new Error(`未找到迁移文件: ${executed.version}`);
      }
      await rollbackMigration(migration);
    }
    
    // 4. 显示当前版本
    const remainingMigrations = await getExecutedMigrations();
    const currentVersion = remainingMigrations.length > 0 
      ? remainingMigrations[0].version 
      : '000 (空数据库)';
    
    log('\n' + '='.repeat(50), 'gray');
    log('✓ 回滚成功！', 'green');
    log(`✓ 当前数据库版本: ${currentVersion}`, 'green');
    
  } catch (error) {
    log('\n' + '='.repeat(50), 'gray');
    log('✗ 回滚失败', 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// 执行回滚
if (require.main === module) {
  rollback();
}

export { rollback };
