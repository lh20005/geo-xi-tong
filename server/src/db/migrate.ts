import { pool } from './database';
import fs from 'fs';
import path from 'path';

async function migrate() {
  try {
    console.log('🔄 开始数据库迁移...');
    
    const schemaSQL = fs.readFileSync(
      path.join(__dirname, 'schema.sql'),
      'utf-8'
    );
    
    await pool.query(schemaSQL);
    
    console.log('✅ 数据库迁移完成');
    process.exit(0);
  } catch (error) {
    console.error('❌ 数据库迁移失败:', error);
    process.exit(1);
  }
}

migrate();
