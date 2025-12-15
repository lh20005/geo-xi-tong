import { pool } from './database';
import fs from 'fs';
import path from 'path';

async function migrateOllama() {
  try {
    console.log('🔄 开始Ollama支持迁移...');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', '001_add_ollama_support.sql'),
      'utf-8'
    );
    
    await pool.query(migrationSQL);
    
    console.log('✅ Ollama支持迁移完成');
    process.exit(0);
  } catch (error) {
    console.error('❌ Ollama迁移失败:', error);
    console.error('这可能是因为迁移已经执行过，或者数据库连接失败');
    process.exit(1);
  }
}

migrateOllama();
