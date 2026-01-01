const { pool } = require('./server/dist/db/database');

async function diagnoseTiming() {
  try {
    // 获取最近有多个任务的批次
    const batchResult = await pool.query(`
      SELECT batch_id, MAX(interval_minutes) as interval_minutes, MIN(created_at) as created_at
      FROM publishing_tasks 
      WHERE batch_id IS NOT NULL
      GROUP BY batch_id
      HAVING COUNT(*) > 1
      ORDER BY MIN(created_at) DESC
      LIMIT 5
    `);
    
    console.log('\n📊 批次定时发布诊断\n');
    console.log('='.repeat(100));
    
    for (const batch of batchResult.rows) {
      const batchId = batch.batch_id;
      const shortId = batchId.split('_').pop().substring(0, 8);
      const intervalMinutes = batch.interval_minutes;
      
      console.log(`\n批次: ${shortId} (间隔: ${intervalMinutes}分钟)`);
      console.log('-'.repeat(100));
      
      // 获取该批次的所有任务
      const tasksResult = await pool.query(`
        SELECT id, batch_order, status, created_at, updated_at, article_id, platform_id
        FROM publishing_tasks 
        WHERE batch_id = $1
        ORDER BY batch_order
      `, [batchId]);
      
      const tasks = tasksResult.rows;
      
      if (tasks.length === 0) {
        console.log('  无任务');
        continue;
      }
      
      console.log(`  任务数: ${tasks.length}\n`);
      
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const createdAt = new Date(task.created_at);
        const updatedAt = new Date(task.updated_at);
        
        console.log(`  任务 ${i + 1} (ID: ${task.id}, 顺序: ${task.batch_order})`);
        console.log(`    状态: ${task.status}`);
        console.log(`    创建时间: ${createdAt.toLocaleString('zh-CN')}`);
        console.log(`    完成时间: ${updatedAt.toLocaleString('zh-CN')}`);
        console.log(`    执行耗时: ${Math.round((updatedAt - createdAt) / 1000)}秒`);
        
        // 如果有下一个任务，计算实际间隔
        if (i < tasks.length - 1) {
          const nextTask = tasks[i + 1];
          const nextUpdatedAt = new Date(nextTask.updated_at);
          
          // 计算从当前任务完成到下一个任务完成的时间
          const actualIntervalMs = nextUpdatedAt - updatedAt;
          const actualIntervalMinutes = actualIntervalMs / 60000;
          const actualIntervalSeconds = actualIntervalMs / 1000;
          
          // 计算从当前任务完成到下一个任务开始的时间（估算）
          const nextTaskDuration = (nextUpdatedAt - new Date(nextTask.created_at)) / 1000;
          const waitTime = actualIntervalSeconds - nextTaskDuration;
          
          console.log(`    ⏱️  到下一个任务完成的间隔: ${actualIntervalSeconds.toFixed(1)}秒 (${actualIntervalMinutes.toFixed(2)}分钟)`);
          console.log(`    📊 预期间隔: ${intervalMinutes}分钟 (${intervalMinutes * 60}秒)`);
          console.log(`    🔍 估算等待时间: ${waitTime.toFixed(1)}秒 (${(waitTime / 60).toFixed(2)}分钟)`);
          
          const deviation = actualIntervalMinutes - intervalMinutes;
          if (Math.abs(deviation) > 0.5) {
            console.log(`    ⚠️  偏差: ${deviation > 0 ? '+' : ''}${deviation.toFixed(2)}分钟`);
          } else {
            console.log(`    ✅ 间隔正常`);
          }
        }
        console.log('');
      }
    }
    
    console.log('='.repeat(100));
    console.log('\n💡 说明:');
    console.log('  - "到下一个任务完成的间隔" = 当前任务完成时间 到 下一个任务完成时间');
    console.log('  - "估算等待时间" = 实际间隔 - 下一个任务执行耗时');
    console.log('  - 如果"估算等待时间"接近"预期间隔"，说明定时逻辑正确\n');
    
    await pool.end();
  } catch (error) {
    console.error('诊断失败:', error.message);
    process.exit(1);
  }
}

diagnoseTiming();
