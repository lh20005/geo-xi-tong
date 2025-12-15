import { pool } from './database';
import * as fs from 'fs';
import * as path from 'path';

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('开始迁移：添加发布状态字段...');
    
    await client.query('BEGIN');
    
    // 读取并执行迁移SQL
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', 'add_publication_status.sql'),
      'utf-8'
    );
    
    await client.query(migrationSQL);
    
    await client.query('COMMIT');
    
    console.log('✓ 迁移成功完成');
    console.log('✓ 已添加 is_published 字段（默认值: false）');
    console.log('✓ 已添加 published_at 字段');
    console.log('✓ 已创建索引 idx_articles_is_published');
    console.log('✓ 已创建索引 idx_articles_published_at');
    
    // 验证迁移
    const result = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'articles'
      AND column_name IN ('is_published', 'published_at')
      ORDER BY column_name
    `);
    
    console.log('\n验证结果:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (默认值: ${row.column_default || 'NULL'})`);
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('迁移失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
