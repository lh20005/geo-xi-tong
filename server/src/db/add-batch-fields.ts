import { pool } from './database';

/**
 * 添加批次相关字段到 publishing_tasks 表
 */
async function addBatchFields() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🚀 开始添加批次相关字段...');
    
    // 添加 batch_id 字段（批次ID，同一批次的任务共享）
    console.log('📝 添加 batch_id 字段...');
    await client.query(`
      ALTER TABLE publishing_tasks 
      ADD COLUMN IF NOT EXISTS batch_id VARCHAR(50)
    `);
    
    // 添加 batch_order 字段（批次内的执行顺序）
    console.log('📝 添加 batch_order 字段...');
    await client.query(`
      ALTER TABLE publishing_tasks 
      ADD COLUMN IF NOT EXISTS batch_order INTEGER DEFAULT 0
    `);
    
    // 添加 interval_minutes 字段（执行间隔，分钟）
    console.log('📝 添加 interval_minutes 字段...');
    await client.query(`
      ALTER TABLE publishing_tasks 
      ADD COLUMN IF NOT EXISTS interval_minutes INTEGER DEFAULT 0
    `);
    
    // 创建批次相关索引
    console.log('📝 创建批次索引...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_publishing_tasks_batch 
      ON publishing_tasks(batch_id, batch_order)
    `);
    
    await client.query('COMMIT');
    console.log('✅ 批次字段添加成功！');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 添加失败:', error);
    throw error;
  } finally {
    client.release();
  }
}

// 执行迁移
addBatchFields()
  .then(() => {
    console.log('✅ 迁移完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 迁移失败:', error);
    process.exit(1);
  });
