import { pool } from './database';
import * as fs from 'fs';
import * as path from 'path';

async function migratePublishingRecords() {
  const client = await pool.connect();
  
  try {
    console.log('开始执行发布记录表迁移...');
    
    await client.query('BEGIN');
    
    // 读取迁移SQL文件
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', '007_add_publishing_records.sql'),
      'utf-8'
    );
    
    // 执行迁移
    await client.query(migrationSQL);
    
    await client.query('COMMIT');
    
    console.log('✅ 发布记录表迁移完成');
    
    // 验证表是否创建成功
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'publishing_records'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ publishing_records 表创建成功');
    } else {
      console.log('❌ publishing_records 表创建失败');
    }
    
    // 验证 articles 表字段
    const columnsResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'articles' 
      AND column_name IN ('is_published', 'published_at')
    `);
    
    console.log(`✅ articles 表字段检查: ${columnsResult.rows.map(r => r.column_name).join(', ')}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// 执行迁移
migratePublishingRecords().catch(console.error);
