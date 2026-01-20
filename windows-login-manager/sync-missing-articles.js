/**
 * 同步缺失的文章到本地数据库
 * 
 * 使用方法：
 * cd windows-login-manager
 * node sync-missing-articles.js
 */

const { Pool } = require('pg');
const axios = require('axios');

// 本地数据库配置
const localPool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'geo_windows',
  user: 'lzc',
  password: '',
  max: 10,
});

// API 配置
const API_BASE_URL = 'https://jzgeo.cc/api';
const USER_ID = 1; // aizhiruan 的用户 ID

async function syncMissingArticles() {
  console.log('🔍 开始检查缺失的文章...\n');

  try {
    // 1. 获取本地已有的文章 ID（通过 task_id 和 title 组合判断）
    const localArticles = await localPool.query(
      'SELECT task_id, title FROM articles WHERE user_id = $1',
      [USER_ID]
    );
    
    const localArticleSet = new Set(
      localArticles.rows.map(row => `${row.task_id}:${row.title}`)
    );
    
    console.log(`📊 本地已有 ${localArticles.rows.length} 篇文章`);

    // 2. 获取服务器端的所有文章
    const response = await axios.get(`${API_BASE_URL}/articles`, {
      params: { page: 1, pageSize: 1000 },
      headers: {
        'Authorization': `Bearer YOUR_TOKEN_HERE` // 需要替换为实际的 token
      }
    });

    const serverArticles = response.data.articles || [];
    console.log(`📊 服务器端共有 ${serverArticles.length} 篇文章\n`);

    // 3. 找出缺失的文章
    const missingArticles = serverArticles.filter(article => {
      const key = `${article.taskId}:${article.title}`;
      return !localArticleSet.has(key);
    });

    if (missingArticles.length === 0) {
      console.log('✅ 没有缺失的文章，数据已同步！');
      return;
    }

    console.log(`⚠️  发现 ${missingArticles.length} 篇缺失的文章：\n`);
    missingArticles.forEach((article, index) => {
      console.log(`${index + 1}. [任务 ${article.taskId}] ${article.title}`);
    });

    console.log('\n📥 开始同步缺失的文章...\n');

    // 4. 同步缺失的文章
    let successCount = 0;
    let failCount = 0;

    for (const article of missingArticles) {
      try {
        // 获取文章完整内容
        const detailResponse = await axios.get(
          `${API_BASE_URL}/article-generation/articles/${article.id}`,
          {
            headers: {
              'Authorization': `Bearer YOUR_TOKEN_HERE` // 需要替换为实际的 token
            }
          }
        );

        const content = detailResponse.data?.content || '';

        // 插入到本地数据库
        await localPool.query(
          `INSERT INTO articles (
            user_id, title, keyword, content, image_url, provider,
            distillation_keyword_snapshot, topic_question_snapshot,
            task_id, is_published, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
          [
            USER_ID,
            article.title,
            article.keyword || '',
            content,
            article.imageUrl || null,
            article.provider || 'deepseek',
            article.keyword || '',
            article.topic || '',
            article.taskId,
            false
          ]
        );

        successCount++;
        console.log(`✅ [${successCount}/${missingArticles.length}] 同步成功: ${article.title}`);
      } catch (error) {
        failCount++;
        console.error(`❌ 同步失败: ${article.title}`, error.message);
      }
    }

    console.log(`\n📊 同步完成！`);
    console.log(`   成功: ${successCount} 篇`);
    console.log(`   失败: ${failCount} 篇`);

  } catch (error) {
    console.error('❌ 同步过程出错:', error.message);
  } finally {
    await localPool.end();
  }
}

// 运行同步
syncMissingArticles();
