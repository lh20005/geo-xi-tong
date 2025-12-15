import { pool } from './db/database';

async function check() {
  try {
    console.log('检查文章的topic_id字段...\n');
    
    // 查看最新的3篇文章
    const result = await pool.query(`
      SELECT id, title, keyword, topic_id, distillation_id, task_id
      FROM articles
      ORDER BY created_at DESC
      LIMIT 3
    `);
    
    console.log('最新的3篇文章:');
    result.rows.forEach(row => {
      console.log(`  ID=${row.id}, 关键词="${row.keyword}", topic_id=${row.topic_id}, distillation_id=${row.distillation_id}, task_id=${row.task_id}`);
    });
    
    console.log('\n检查topic_usage表:');
    const usageResult = await pool.query(`
      SELECT * FROM topic_usage ORDER BY used_at DESC LIMIT 3
    `);
    
    console.log(`找到 ${usageResult.rows.length} 条使用记录:`);
    usageResult.rows.forEach(row => {
      console.log(`  topic_id=${row.topic_id}, article_id=${row.article_id}, distillation_id=${row.distillation_id}`);
    });
    
    console.log('\n检查topics表的usage_count:');
    const topicsResult = await pool.query(`
      SELECT id, question, usage_count
      FROM topics
      WHERE usage_count > 0
      ORDER BY usage_count DESC
      LIMIT 5
    `);
    
    console.log(`找到 ${topicsResult.rows.length} 个被使用的话题:`);
    topicsResult.rows.forEach(row => {
      console.log(`  ID=${row.id}, 问题="${row.question.substring(0, 30)}...", usage_count=${row.usage_count}`);
    });
    
  } catch (error: any) {
    console.error('检查失败:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

check();
