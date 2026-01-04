#!/usr/bin/env node
/**
 * 运行迁移 018: 添加存储购买表
 */

import { pool } from './database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  console.log('[Migration 018] 开始执行迁移: 添加存储购买表...');

  try {
    // 读取迁移文件
    const migrationPath = path.join(__dirname, 'migrations', '018_add_storage_purchases.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // 执行迁移
    await pool.query(migrationSQL);

    console.log('[Migration 018] ✓ 迁移执行成功!');
    console.log('[Migration 018] 已创建:');
    console.log('  - storage_purchases 表');
    console.log('  - 相关索引');
    console.log('  - activate_storage_purchase() 触发器');
    console.log('  - expire_storage_purchases() 函数');

    // 验证表是否创建成功
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = 'storage_purchases'
    `);

    if (result.rows.length > 0) {
      console.log('[Migration 018] ✓ 表验证成功');
    } else {
      console.error('[Migration 018] ✗ 表验证失败');
    }

  } catch (error: any) {
    console.error('[Migration 018] ✗ 迁移失败:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
