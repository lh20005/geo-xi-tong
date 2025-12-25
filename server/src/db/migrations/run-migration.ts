/**
 * 数据库迁移执行脚本
 * 用于执行SQL迁移文件
 */

import { pool } from '../database';
import fs from 'fs';
import path from 'path';

async function runMigration(migrationFile: string) {
  console.log(`\n🚀 开始执行迁移: ${migrationFile}`);
  
  try {
    const sqlPath = path.join(__dirname, migrationFile);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await pool.query(sql);
    
    console.log(`✅ 迁移执行成功: ${migrationFile}\n`);
  } catch (error) {
    console.error(`❌ 迁移执行失败: ${migrationFile}`);
    console.error(error);
    throw error;
  }
}

async function main() {
  const migrationFile = process.argv[2] || '001_create_security_tables.sql';
  
  try {
    await runMigration(migrationFile);
    console.log('✅ 所有迁移执行完成');
    process.exit(0);
  } catch (error) {
    console.error('❌ 迁移执行失败');
    process.exit(1);
  }
}

main();
