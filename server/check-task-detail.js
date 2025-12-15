const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkTaskDetail() {
  try {
    console.log('🔍 检查任务详情...\n');

    // 获取所有任务
    const tasks = await pool.query(
      'SELECT * FROM generation_tasks ORDER BY created_at DESC'
    );

    console.log(`📋 找到 ${tasks.rows.length} 个任务:\n`);

    for (const task of tasks.rows) {
      console.log(`任务 ID: ${task.id}`);
      console.log(`  状态: ${task.status}`);
      console.log(`  蒸馏ID: ${task.distillation_id}`);
      console.log(`  图库ID: ${task.album_id}`);
      console.log(`  知识库ID: ${task.knowledge_base_id}`);
      console.log(`  文章设置ID: ${task.article_setting_id}`);
      console.log(`  请求数量: ${task.requested_count}`);
      console.log(`  已生成数量: ${task.generated_count}`);
      console.log(`  进度: ${task.progress}%`);
      console.log(`  错误信息: ${task.error_message || '无'}`);
      console.log(`  创建时间: ${task.created_at}`);
      console.log(`  更新时间: ${task.updated_at}`);
      console.log('');
    }

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await pool.end();
  }
}

checkTaskDetail();
