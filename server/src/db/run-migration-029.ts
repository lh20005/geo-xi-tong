/**
 * 运行迁移 029: 更新 get_user_storage_quota 函数以支持自定义配额
 */

import { pool } from './database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration029() {
  console.log('=== 运行迁移 029: 更新 get_user_storage_quota 函数 ===\n');

  try {
    // 读取迁移文件
    const migrationPath = path.join(__dirname, 'migrations', '029_update_get_user_storage_quota_for_custom.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // 执行迁移
    console.log('执行迁移 SQL...');
    await pool.query(migrationSQL);

    console.log('\n✅ 迁移 029 执行成功！');
    console.log('\n功能说明:');
    console.log('1. 更新了 get_user_storage_quota 函数');
    console.log('2. 函数现在优先使用 custom_quotas 中的存储配额');
    console.log('3. 如果没有自定义配额，则使用套餐默认配额');
    console.log('4. 完整支持配额调整功能');

  } catch (error) {
    console.error('\n❌ 迁移 029 执行失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration029();
