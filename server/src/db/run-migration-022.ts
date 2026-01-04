import { pool } from './database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  console.log('开始执行迁移 022: 修复配额系统...\n');

  try {
    // 读取迁移文件
    const migrationPath = path.join(__dirname, 'migrations', '022_fix_quota_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // 执行迁移
    await pool.query(migrationSQL);

    console.log('\n✅ 迁移 022 执行成功！');
    console.log('\n修复内容:');
    console.log('1. ✅ record_feature_usage 函数已更新为支持月度配额');
    console.log('2. ✅ 所有用户的配额周期已修正为月度');
    console.log('3. ✅ 本月使用量已重新计算');
    console.log('4. ✅ 缺失的配额记录已初始化');

  } catch (error) {
    console.error('\n❌ 迁移执行失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration();
