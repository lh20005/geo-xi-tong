import { pool } from './database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration021() {
  console.log('开始执行迁移 021: 修复配额周期判断...\n');

  try {
    // 读取并执行迁移 SQL
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', '021_fix_quota_period.sql'),
      'utf8'
    );

    await pool.query(migrationSQL);

    console.log('✅ 迁移 021 执行成功');
    console.log('   - 更新了 record_feature_usage 函数');
    console.log('   - 清理了过期的使用记录');
    console.log('   - 初始化了当前月份的使用记录\n');

  } catch (error) {
    console.error('❌ 迁移 021 执行失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration021();
