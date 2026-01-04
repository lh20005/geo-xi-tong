#!/usr/bin/env node
/**
 * 运行迁移 019: 修复存储配额
 * 
 * 修复内容：
 * 1. 普通用户默认存储从 200MB 改为 20MB
 * 2. 管理员默认存储从无限改为 1GB
 */

import { pool } from './database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  console.log('[Migration 019] 开始修复存储配额...\n');

  try {
    // 读取迁移文件
    const migrationPath = path.join(__dirname, 'migrations', '019_fix_storage_quotas.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // 执行迁移
    await pool.query(migrationSQL);

    // 验证结果
    console.log('\n[Migration 019] 验证迁移结果...\n');

    // 检查管理员配额
    const adminResult = await pool.query(`
      SELECT u.username, u.role, usu.storage_quota_bytes
      FROM users u
      JOIN user_storage_usage usu ON u.id = usu.user_id
      WHERE u.role = 'admin'
    `);

    console.log('管理员存储配额:');
    adminResult.rows.forEach(row => {
      const quotaGB = (row.storage_quota_bytes / 1024 / 1024 / 1024).toFixed(2);
      console.log(`  - ${row.username}: ${quotaGB} GB (${row.storage_quota_bytes} bytes)`);
    });

    // 检查普通用户配额
    const userResult = await pool.query(`
      SELECT u.username, u.role, usu.storage_quota_bytes
      FROM users u
      JOIN user_storage_usage usu ON u.id = usu.user_id
      WHERE u.role != 'admin'
      LIMIT 5
    `);

    console.log('\n普通用户存储配额（前5个）:');
    userResult.rows.forEach(row => {
      const quotaMB = (row.storage_quota_bytes / 1024 / 1024).toFixed(2);
      console.log(`  - ${row.username}: ${quotaMB} MB (${row.storage_quota_bytes} bytes)`);
    });

    // 统计信息
    const statsResult = await pool.query(`
      SELECT 
        COUNT(CASE WHEN u.role = 'admin' THEN 1 END) as admin_count,
        COUNT(CASE WHEN u.role != 'admin' THEN 1 END) as user_count,
        COUNT(CASE WHEN u.role = 'admin' AND usu.storage_quota_bytes = 1073741824 THEN 1 END) as admin_1gb_count,
        COUNT(CASE WHEN u.role != 'admin' AND usu.storage_quota_bytes = 10485760 THEN 1 END) as user_10mb_count
      FROM users u
      JOIN user_storage_usage usu ON u.id = usu.user_id
    `);

    const stats = statsResult.rows[0];
    console.log('\n统计信息:');
    console.log(`  - 管理员总数: ${stats.admin_count}`);
    console.log(`  - 管理员配额为1GB的数量: ${stats.admin_1gb_count}`);
    console.log(`  - 普通用户总数: ${stats.user_count}`);
    console.log(`  - 普通用户配额为10MB的数量: ${stats.user_10mb_count}`);

    console.log('\n✅ 迁移 019 成功完成！');
    console.log('   - 管理员存储配额已更新为 1GB');
    console.log('   - 普通用户默认存储配额已更新为 10MB');

  } catch (error) {
    console.error('❌ 迁移失败:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// 运行迁移
runMigration();
