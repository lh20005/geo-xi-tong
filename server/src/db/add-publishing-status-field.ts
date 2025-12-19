import { pool } from './database';

/**
 * 添加 publishing_status 字段到 articles 表
 * 用于标记文章是否有待处理的发布任务
 */
async function addPublishingStatusField() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🚀 开始添加 publishing_status 字段...');
    
    // 添加 publishing_status 字段
    // 可能的值：
    // - null: 没有发布任务
    // - 'pending': 有待处理的发布任务
    // - 'publishing': 正在发布中
    console.log('📝 添加 publishing_status 字段...');
    await client.query(`
      ALTER TABLE articles 
      ADD COLUMN IF NOT EXISTS publishing_status VARCHAR(20)
    `);
    
    // 创建索引以提高查询性能
    console.log('📝 创建索引...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_articles_publishing_status 
      ON articles(publishing_status)
    `);
    
    await client.query('COMMIT');
    console.log('✅ publishing_status 字段添加成功！');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 添加失败:', error);
    throw error;
  } finally {
    client.release();
  }
}

// 执行迁移
addPublishingStatusField()
  .then(() => {
    console.log('✅ 迁移完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 迁移失败:', error);
    process.exit(1);
  });
