import { pool } from '../database';
import { authService } from '../../services/AuthService';

async function runMigration() {
  try {
    console.log('开始执行数据库迁移...');
    
    // 创建users表
    console.log('创建users表...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(100),
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP
      )
    `);
    
    // 创建索引
    console.log('创建索引...');
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)
    `);
    
    // 使用AuthService初始化默认管理员
    console.log('初始化默认管理员账号...');
    await authService.initializeDefaultAdmin();
    
    console.log('✅ 数据库迁移完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 数据库迁移失败:', error);
    process.exit(1);
  }
}

runMigration();
