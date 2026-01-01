const { pool } = require('./server/dist/db/database');

async function checkTasks() {
  try {
    const result = await pool.query(`
      SELECT id, batch_id, batch_order, interval_minutes, status, created_at, updated_at
      FROM publishing_tasks 
      WHERE batch_id IS NOT NULL
      ORDER BY batch_id DESC, batch_order
      LIMIT 30
    `);
    
    console.log('\n最近的批次任务:');
    console.log('ID | 批次ID | 顺序 | 间隔(分钟) | 状态 | 创建时间 | 执行时间');
    console.log('-'.repeat(120));
    
    let currentBatch = null;
    result.rows.forEach(row => {
      const shortBatchId = row.batch_id ? row.batch_id.split('_').pop().substring(0, 8) : 'N/A';
      const createdAt = row.created_at ? new Date(row.created_at).toLocaleTimeString('zh-CN') : 'N/A';
      const updatedAt = row.updated_at ? new Date(row.updated_at).toLocaleTimeString('zh-CN') : 'N/A';
      
      if (currentBatch !== row.batch_id) {
        console.log(''); // 批次之间空行
        currentBatch = row.batch_id;
      }
      
      console.log(`${row.id} | ${shortBatchId} | ${row.batch_order} | ${row.interval_minutes || 'NULL'} | ${row.status} | ${createdAt} | ${updatedAt}`);
    });
    
    console.log('\n');
    await pool.end();
  } catch (error) {
    console.error('查询失败:', error.message);
    process.exit(1);
  }
}

checkTasks();
