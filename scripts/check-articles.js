const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkArticles() {
  try {
    console.log('🔍 检查文章数据...\n');

    // 检查文章总数
    const articlesCount = await pool.query('SELECT COUNT(*) FROM articles');
    console.log(`📊 文章总数: ${articlesCount.rows[0].count}`);

    // 检查任务总数
    const tasksCount = await pool.query('SELECT COUNT(*) FROM generation_tasks');
    console.log(`📋 任务总数: ${tasksCount.rows[0].count}`);

    // 检查已完成的任务
    const completedTasks = await pool.query(
      "SELECT id, status, requested_count, generated_count, created_at FROM generation_tasks WHERE status = 'completed' ORDER BY created_at DESC LIMIT 5"
    );
    console.log(`\n✅ 已完成的任务 (最近5个):`);
    completedTasks.rows.forEach(task => {
      console.log(`  - 任务ID: ${task.id}, 状态: ${task.status}, 请求数: ${task.requested_count}, 已生成: ${task.generated_count}, 创建时间: ${task.created_at}`);
    });

    // 检查文章与任务的关联
    const articlesWithTask = await pool.query(
      'SELECT COUNT(*) FROM articles WHERE task_id IS NOT NULL'
    );
    console.log(`\n🔗 有任务ID的文章数: ${articlesWithTask.rows[0].count}`);

    const articlesWithoutTask = await pool.query(
      'SELECT COUNT(*) FROM articles WHERE task_id IS NULL'
    );
    console.log(`❌ 没有任务ID的文章数: ${articlesWithoutTask.rows[0].count}`);

    // 显示最近的文章
    const recentArticles = await pool.query(
      'SELECT id, title, keyword, task_id, created_at FROM articles ORDER BY created_at DESC LIMIT 5'
    );
    console.log(`\n📝 最近的文章 (最近5篇):`);
    recentArticles.rows.forEach(article => {
      console.log(`  - ID: ${article.id}, 标题: ${article.title || '无标题'}, 关键词: ${article.keyword}, 任务ID: ${article.task_id || '无'}, 创建时间: ${article.created_at}`);
    });

    // 检查每个任务生成的文章
    if (completedTasks.rows.length > 0) {
      console.log(`\n🔍 检查每个已完成任务的文章:`);
      for (const task of completedTasks.rows) {
        const taskArticles = await pool.query(
          'SELECT COUNT(*) FROM articles WHERE task_id = $1',
          [task.id]
        );
        console.log(`  - 任务 ${task.id}: 声称生成 ${task.generated_count} 篇, 实际数据库中有 ${taskArticles.rows[0].count} 篇`);
      }
    }

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await pool.end();
  }
}

checkArticles();
