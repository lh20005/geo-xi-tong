/**
 * 数据库迁移状态查看脚本
 * 
 * 功能：
 * - 显示当前数据库版本
 * - 列出所有迁移及其状态
 * - 显示待执行的迁移
 * 
 * 使用：npm run db:status
 */

import { pool } from './database';
import fs from 'fs';
import path from 'path';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * 检查迁移表是否存在
 */
async function migrationsTableExists(): Promise<boolean> {
  const result = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'schema_migrations'
    );
  `);
  return result.rows[0].exists;
}

/**
 * 获取已执行的迁移
 */
async function getExecutedMigrations(): Promise<Map<string, {name: string, executedAt: Date}>> {
  const result = await pool.query(
    'SELECT version, name, executed_at FROM schema_migrations ORDER BY version'
  );
  
  const map = new Map();
  result.rows.forEach(row => {
    map.set(row.version, {
      name: row.name,
      executedAt: row.executed_at,
    });
  });
  return map;
}

/**
 * 读取所有迁移文件
 */
function getMigrationFiles(): Array<{version: string, name: string, filename: string}> {
  const migrationsDir = path.join(__dirname, 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }
  
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  return files.map(filename => {
    const match = filename.match(/^(\d{3})_(.+)\.sql$/);
    if (!match) {
      return null;
    }
    
    const [, version, name] = match;
    return {
      version,
      name: name.replace(/_/g, ' '),
      filename,
    };
  }).filter(Boolean) as Array<{version: string, name: string, filename: string}>;
}

/**
 * 格式化日期
 */
function formatDate(date: Date): string {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * 主函数
 */
async function status() {
  try {
    log('\n📊 数据库迁移状态', 'cyan');
    log('='.repeat(80), 'gray');
    
    // 1. 检查迁移表是否存在
    const tableExists = await migrationsTableExists();
    
    if (!tableExists) {
      log('\n⚠️  迁移系统尚未初始化', 'yellow');
      log('   运行 npm run db:migrate 来初始化', 'gray');
      
      const allMigrations = getMigrationFiles();
      if (allMigrations.length > 0) {
        log(`\n📋 发现 ${allMigrations.length} 个迁移文件（待执行）:`, 'yellow');
        allMigrations.forEach(m => {
          log(`   ${m.version} - ${m.name}`, 'gray');
        });
      }
      return;
    }
    
    // 2. 获取已执行的迁移
    const executedMigrations = await getExecutedMigrations();
    
    // 3. 读取所有迁移文件
    const allMigrations = getMigrationFiles();
    
    // 4. 计算统计信息
    const totalMigrations = allMigrations.length;
    const executedCount = executedMigrations.size;
    const pendingCount = totalMigrations - executedCount;
    
    // 5. 显示当前版本
    if (executedCount > 0) {
      const latestVersion = Array.from(executedMigrations.keys()).sort().pop();
      log(`\n✓ 当前数据库版本: ${latestVersion}`, 'green');
    } else {
      log(`\n⚠️  数据库版本: 000 (空数据库)`, 'yellow');
    }
    
    log(`✓ 已执行迁移: ${executedCount}/${totalMigrations}`, 'gray');
    if (pendingCount > 0) {
      log(`⚠️  待执行迁移: ${pendingCount}`, 'yellow');
    }
    
    // 6. 显示所有迁移状态
    log('\n📋 迁移列表:', 'cyan');
    log('-'.repeat(80), 'gray');
    log(
      `${'版本'.padEnd(8)} ${'状态'.padEnd(8)} ${'名称'.padEnd(35)} ${'执行时间'}`,
      'gray'
    );
    log('-'.repeat(80), 'gray');
    
    allMigrations.forEach(migration => {
      const executed = executedMigrations.get(migration.version);
      
      if (executed) {
        const status = '✓ 已执行';
        const executedAt = formatDate(executed.executedAt);
        log(
          `${migration.version.padEnd(8)} ${status.padEnd(12)} ${migration.name.padEnd(35)} ${executedAt}`,
          'green'
        );
      } else {
        const status = '○ 待执行';
        log(
          `${migration.version.padEnd(8)} ${status.padEnd(12)} ${migration.name.padEnd(35)}`,
          'yellow'
        );
      }
    });
    
    log('-'.repeat(80), 'gray');
    
    // 7. 显示待执行的迁移
    if (pendingCount > 0) {
      log(`\n⚠️  有 ${pendingCount} 个待执行的迁移`, 'yellow');
      log('   运行 npm run db:migrate 来执行', 'gray');
    } else {
      log('\n✓ 数据库已是最新版本', 'green');
    }
    
    log('');
    
  } catch (error) {
    log('\n✗ 获取状态失败', 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// 执行状态查看
if (require.main === module) {
  status();
}

export { status };
