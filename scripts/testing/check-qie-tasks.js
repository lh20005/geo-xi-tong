import { pool } from './server/src/db/database.js';

async function checkTasks() {
  const result = await pool.query(`
    SELECT 
      pt.id,
      pt.platform_id,
      pt.status,
      pt.article_id,
      pt.account_id,
      pt.created_at,
      pt.updated_at,
      pt.status_message,
      a.title as article_title,
      pa.account_name
    FROM publishing_tasks pt
    LEFT JOIN articles a ON pt.article_id = a.id
    LEFT JOIN platform_accounts pa ON pt.account_id = pa.id
    WHERE pt.platform_id = 'qie'
    ORDER BY pt.created_at DESC
    LIMIT 5
  `);
  
  console.log('企鹅号发布任务:');
  console.log(JSON.stringify(result.rows, null, 2));
  
  // 检查最新任务的日志
  if (result.rows.length > 0) {
    const latestTask = result.rows[0];
    console.log('\n最新任务的日志:');
    const logs = await pool.query(`
      SELECT * FROM publishing_logs
      WHERE task_id = $1
      ORDER BY created_at ASC
    `, [latestTask.id]);
    console.log(JSON.stringify(logs.rows, null, 2));
  }
  
  await pool.end();
}

checkTasks().catch(console.error);
