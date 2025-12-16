import { pool } from './database';

/**
 * 图片使用追踪迁移
 * 
 * 功能：
 * 1. 为images表添加usage_count字段，记录图片被使用的次数
 * 2. 创建image_usage表，记录图片使用历史
 * 3. 添加相关索引
 */

async function migrate() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('开始迁移：图片使用追踪...');
    
    // 1. 为images表添加usage_count字段
    console.log('步骤1: 为images表添加usage_count字段...');
    await client.query(`
      ALTER TABLE images 
      ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0
    `);
    
    // 2. 创建image_usage表
    console.log('步骤2: 创建image_usage表...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS image_usage (
        id SERIAL PRIMARY KEY,
        image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
        article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
        used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(image_id, article_id)
      )
    `);
    
    // 3. 添加索引
    console.log('步骤3: 添加索引...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_images_usage_count 
      ON images(album_id, usage_count ASC, created_at ASC)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_image_usage_image_id 
      ON image_usage(image_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_image_usage_article_id 
      ON image_usage(article_id)
    `);
    
    // 4. 添加注释
    console.log('步骤4: 添加注释...');
    await client.query(`
      COMMENT ON COLUMN images.usage_count IS '图片被用于生成文章的次数'
    `);
    
    await client.query(`
      COMMENT ON TABLE image_usage IS '图片使用记录表，追踪每张图片被哪些文章使用'
    `);
    
    await client.query('COMMIT');
    console.log('✅ 迁移成功完成');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    client.release();
  }
}

// 执行迁移
migrate()
  .then(() => {
    console.log('迁移脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('迁移脚本执行失败:', error);
    process.exit(1);
  });
