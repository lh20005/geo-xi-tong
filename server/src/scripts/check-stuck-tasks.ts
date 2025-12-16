import { pool } from '../db/database';

/**
 * 检查卡住的任务
 */

async function checkStuckTasks() {
  console.log('==========================================');
  console.log('检查卡住的任务');
  console.log('==========================================\n');

  try {
    // 1. 查看所有运行中的任务
    console.log('步骤1: 查看所有运行中的任务...\n');

    const runningTasks = await pool.query(`
      SELECT 
        id,
        distillation_id,
        status,
        requested_count,
        generated_count,
        progress,
        error_message,
        created_at,
        updated_at,
        EXTRACT(EPOCH FROM (NOW() - updated_at)) as seconds_since_update
      FROM generation_tasks
      WHERE status = 'running'
      ORDER BY created_at DESC
    `);

    if (runningTasks.rows.length === 0) {
      console.log('没有运行中的任务\n');
    } else {
      console.log(`找到 ${runningTasks.rows.length} 个运行中的任务:\n`);
      console.table(runningTasks.rows);
      console.log('');
    }

    // 2. 查看所有待处理的任务
    console.log('步骤2: 查看所有待处理的任务...\n');

    const pendingTasks = await pool.query(`
      SELECT 
        id,
        distillation_id,
        status,
        requested_count,
        generated_count,
        created_at,
        EXTRACT(EPOCH FROM (NOW() - created_at)) as seconds_since_creation
      FROM generation_tasks
      WHERE status = 'pending'
      ORDER BY created_at DESC
    `);

    if (pendingTasks.rows.length === 0) {
      console.log('没有待处理的任务\n');
    } else {
      console.log(`找到 ${pendingTasks.rows.length} 个待处理的任务:\n`);
      console.table(pendingTasks.rows);
      console.log('');
    }

    // 3. 识别可能卡住的任务（超过5分钟没有更新）
    console.log('步骤3: 识别可能卡住的任务...\n');

    const stuckTasks = await pool.query(`
      SELECT 
        id,
        distillation_id,
        status,
        requested_count,
        generated_count,
        progress,
        error_message,
        created_at,
        updated_at,
        EXTRACT(EPOCH FROM (NOW() - updated_at)) / 60 as minutes_since_update
      FROM generation_tasks
      WHERE status = 'running'
        AND updated_at < NOW() - INTERVAL '5 minutes'
      ORDER BY updated_at ASC
    `);

    if (stuckTasks.rows.length === 0) {
      console.log('没有发现卡住的任务\n');
    } else {
      console.log(`⚠️  发现 ${stuckTasks.rows.length} 个可能卡住的任务:\n`);
      console.table(stuckTasks.rows);
      console.log('');
      
      console.log('建议操作:');
      for (const task of stuckTasks.rows) {
        console.log(`  任务 ${task.id}: 已经 ${Math.round(task.minutes_since_update)} 分钟没有更新`);
        console.log(`    - 手动标记为失败: UPDATE generation_tasks SET status = 'failed', error_message = '任务超时' WHERE id = ${task.id};`);
        console.log(`    - 或删除任务: DELETE FROM generation_tasks WHERE id = ${task.id};`);
      }
      console.log('');
    }

    // 4. 检查是否有图片选择相关的错误
    console.log('步骤4: 检查最近的错误信息...\n');

    const failedTasks = await pool.query(`
      SELECT 
        id,
        distillation_id,
        status,
        error_message,
        created_at
      FROM generation_tasks
      WHERE status = 'failed'
        AND created_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (failedTasks.rows.length === 0) {
      console.log('最近1小时内没有失败的任务\n');
    } else {
      console.log(`最近1小时内失败的任务:\n`);
      for (const task of failedTasks.rows) {
        console.log(`任务 ${task.id}:`);
        console.log(`  错误信息: ${task.error_message || '无'}`);
        console.log(`  创建时间: ${task.created_at}`);
        console.log('');
      }
    }

    // 5. 提供修复建议
    console.log('==========================================');
    console.log('修复建议:');
    console.log('==========================================\n');
    
    if (stuckTasks.rows.length > 0) {
      console.log('1. 手动修复卡住的任务:');
      console.log('   psql -d geo_system -c "UPDATE generation_tasks SET status = \'failed\', error_message = \'任务超时\' WHERE status = \'running\' AND updated_at < NOW() - INTERVAL \'5 minutes\';"');
      console.log('');
      console.log('2. 或者删除卡住的任务:');
      console.log('   psql -d geo_system -c "DELETE FROM generation_tasks WHERE status = \'running\' AND updated_at < NOW() - INTERVAL \'5 minutes\';"');
      console.log('');
    }
    
    console.log('3. 重启服务以清理内存中的任务:');
    console.log('   npm run dev');
    console.log('');
    console.log('==========================================\n');

  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    await pool.end();
  }
}

// 运行检查
checkStuckTasks();
