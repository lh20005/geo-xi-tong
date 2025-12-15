import { pool } from './database';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  try {
    console.log('🔄 开始执行数据库迁移...');
    
    const migrationPath = path.join(__dirname, 'migrations', 'add_conversion_target_to_tasks.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ 数据库迁移成功完成！');
    console.log('   - 已添加 conversion_target_id 字段到 generation_tasks 表');
    console.log('   - 已添加外键约束');
    console.log('   - 已添加索引');
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ 数据库迁移失败:', error.message);
    process.exit(1);
  }
}

runMigration();
