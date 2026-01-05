/**
 * 运行迁移 028: 添加自定义配额同步触发器
 */

import { pool } from './database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration028() {
  console.log('=== 运行迁移 028: 添加自定义配额同步触发器 ===\n');

  try {
    // 读取迁移文件
    const migrationPath = path.join(__dirname, 'migrations', '028_add_custom_quota_sync_trigger.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // 执行迁移
    console.log('执行迁移 SQL...');
    await pool.query(migrationSQL);

    console.log('\n✅ 迁移 028 执行成功！');
    console.log('\n功能说明:');
    console.log('1. 创建了触发器函数 sync_storage_quota_on_custom_quota_change');
    console.log('2. 创建了触发器 trigger_sync_storage_quota');
    console.log('3. 当管理员调整 custom_quotas 时，自动同步 user_storage_usage.storage_quota_bytes');
    console.log('4. 已同步现有的自定义存储配额');

  } catch (error) {
    console.error('\n❌ 迁移 028 执行失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration028();
