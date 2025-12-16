import { pool } from '../db/database';

/**
 * 修复卡住的任务
 */

async function fixStuckTasks() {
  console.log('==========================================');
  console.log('修复卡住的任务');
  console.log('==========================================\n');

  try {
    // 1. 查找卡住的任务（超过5分钟没有更新）
    const stuckTasks = await pool.query(`
      SELECT id, distillation_id, requested_count, generated_count
      FROM generation_tasks
      WHERE status = 'running'
        AND updated_at < NOW() - INTERVAL '5 minutes'
    `);

    if (stuckTasks.rows.length === 0) {
      console.log('✅ 没有发现卡住的任务\n');
      return;
    }

    console.log(`⚠️  发现 ${stuckTasks.rows.length} 个卡住的任务:\n`);
    console.table(stuckTasks.rows);
    console.log('');

    // 2. 将卡住的任务标记为失败
    const result = await pool.query(`
      UPDATE generation_tasks
      SET status = 'failed',
          error_message = '任务超时（超过5分钟没有响应）',
          updated_at = CURRENT_TIMESTAMP
      WHERE status = 'running'
        AND updated_at < NOW() - INTERVAL '5 minutes'
      RETURNING id
    `);

    console.log(`✅ 已将 ${result.rows.length} 个任务标记为失败\n`);
    
    for (const row of result.rows) {
      console.log(`  - 任务 ${row.id} 已标记为失败`);
    }
    console.log('');

    console.log('==========================================');
    console.log('修复完成');
    console.log('==========================================\n');

  } catch (error) {
    console.error('修复失败:', error);
  } finally {
    await pool.end();
  }
}

// 运行修复
fixStuckTasks();
