/**
 * 检查文章 ID 64 (task 76) 是否存在于本地数据库
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'geo_windows',
  user: 'lzc',
  password: '',
});

async function checkArticle() {
  try {
    console.log('=== 检查文章 64 (task 76) ===\n');
    
    // 1. 检查是否存在（使用 checkArticleExists 的逻辑）
    const checkQuery = `
      SELECT 1 FROM articles 
      WHERE user_id = $1 AND task_id = $2 AND title = $3
    `;
    
    const checkResult = await pool.query(checkQuery, [
      1, // user_id
      76, // task_id
      '2026年澳洲留学必看！杭州本地机构深度评测' // title
    ]);
    
    console.log('checkArticleExists 查询结果:');
    console.log('- 返回行数:', checkResult.rows.length);
    console.log('- 判断为存在:', checkResult.rows.length > 0);
    console.log();
    
    // 2. 查询所有匹配 task_id 的文章
    const taskQuery = `
      SELECT id, user_id, task_id, title, created_at 
      FROM articles 
      WHERE user_id = $1 AND task_id = $2
    `;
    
    const taskResult = await pool.query(taskQuery, [1, 76]);
    
    console.log('task_id = 76 的文章:');
    console.log('- 数量:', taskResult.rows.length);
    if (taskResult.rows.length > 0) {
      taskResult.rows.forEach(row => {
        console.log(`  - ID: ${row.id}, Title: ${row.title}`);
      });
    } else {
      console.log('  - 无');
    }
    console.log();
    
    // 3. 查询所有匹配标题的文章
    const titleQuery = `
      SELECT id, user_id, task_id, title, created_at 
      FROM articles 
      WHERE user_id = $1 AND title = $2
    `;
    
    const titleResult = await pool.query(titleQuery, [
      1,
      '2026年澳洲留学必看！杭州本地机构深度评测'
    ]);
    
    console.log('标题匹配的文章:');
    console.log('- 数量:', titleResult.rows.length);
    if (titleResult.rows.length > 0) {
      titleResult.rows.forEach(row => {
        console.log(`  - ID: ${row.id}, Task ID: ${row.task_id}, Title: ${row.title}`);
      });
    } else {
      console.log('  - 无');
    }
    console.log();
    
    // 4. 查询最近的文章
    const recentQuery = `
      SELECT id, user_id, task_id, title, created_at 
      FROM articles 
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    const recentResult = await pool.query(recentQuery, [1]);
    
    console.log('最近 10 篇文章:');
    recentResult.rows.forEach(row => {
      console.log(`  - ID: ${row.id}, Task: ${row.task_id}, Created: ${row.created_at}, Title: ${row.title.substring(0, 30)}...`);
    });
    
  } catch (error) {
    console.error('错误:', error);
  } finally {
    await pool.end();
  }
}

checkArticle();
