import { pool } from './database';

async function migrateGallery() {
  try {
    console.log('🔄 开始企业图库数据库迁移...');
    
    // 删除旧表（如果存在）
    await pool.query('DROP TABLE IF EXISTS images CASCADE');
    await pool.query('DROP TABLE IF EXISTS albums CASCADE');
    
    console.log('✅ 已删除旧表');
    
    // 创建新表
    await pool.query(`
      CREATE TABLE albums (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ 已创建albums表');
    
    await pool.query(`
      CREATE TABLE images (
        id SERIAL PRIMARY KEY,
        album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        filepath VARCHAR(500) NOT NULL,
        mime_type VARCHAR(50) NOT NULL,
        size INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ 已创建images表');
    
    // 创建索引
    await pool.query('CREATE INDEX idx_albums_created_at ON albums(created_at DESC)');
    await pool.query('CREATE INDEX idx_images_album_id ON images(album_id)');
    await pool.query('CREATE INDEX idx_images_created_at ON images(created_at DESC)');
    
    console.log('✅ 已创建索引');
    console.log('✅ 企业图库数据库迁移完成');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 企业图库数据库迁移失败:', error);
    process.exit(1);
  }
}

migrateGallery();
