import { pool } from './database';
import fs from 'fs';
import path from 'path';

async function fixConstraint() {
  try {
    console.log('🔄 开始修复Ollama约束...');
    
    const fixSQL = fs.readFileSync(
      path.join(__dirname, 'fix-ollama-constraint.sql'),
      'utf-8'
    );
    
    await pool.query(fixSQL);
    
    console.log('✅ Ollama约束修复完成');
    process.exit(0);
  } catch (error) {
    console.error('❌ 约束修复失败:', error);
    console.error('请检查数据库连接和权限');
    process.exit(1);
  }
}

fixConstraint();
