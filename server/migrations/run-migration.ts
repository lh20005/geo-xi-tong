import { pool } from '../src/db/database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  const migrationFile = path.join(__dirname, '20241225_add_invitation_system.sql');
  
  try {
    console.log('开始执行数据库迁移...');
    
    // 读取 SQL 文件
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    // 执行 SQL
    await pool.query(sql);
    
    console.log('✅ 数据库迁移成功完成！');
    console.log('已添加的功能:');
    console.log('  - invitation_code 字段（6位小写字母和数字）');
    console.log('  - invited_by_code 字段（记录邀请关系）');
    console.log('  - is_temp_password 字段（临时密码标记）');
    console.log('  - refresh_tokens 表（会话管理）');
    console.log('  - login_attempts 表（速率限制）');
    console.log('  - 相关索引和外键约束');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 数据库迁移失败:', error);
    process.exit(1);
  }
}

runMigration();
