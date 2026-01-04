import { pool } from './database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  console.log('开始执行迁移 023: 添加缺失的配额检查和记录...\n');

  try {
    const migrationPath = path.join(__dirname, 'migrations', '023_add_missing_quota_checks.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    await pool.query(migrationSQL);

    console.log('\n✅ 迁移 023 执行成功！');

  } catch (error) {
    console.error('\n❌ 迁移执行失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration();
