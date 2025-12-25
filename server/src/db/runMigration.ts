import { pool } from './database';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  try {
    console.log('开始执行数据库迁移...');

    const migrationPath = path.join(__dirname, 'migrations', '001_create_subscription_tables.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    await pool.query(sql);

    console.log('✅ 数据库迁移完成');
    console.log('✅ 已创建订阅系统相关表');
    console.log('✅ 已初始化默认套餐数据');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 数据库迁移失败:', error);
    process.exit(1);
  }
}

runMigration();
