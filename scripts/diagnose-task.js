#!/usr/bin/env node

/**
 * 文章生成任务诊断脚本
 * 用法: node scripts/diagnose-task.js <taskId>
 */

const path = require('path');
const { Pool } = require(path.join(__dirname, '../server/node_modules/pg'));
require(path.join(__dirname, '../server/node_modules/dotenv')).config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function diagnoseTask(taskId) {
  console.log(`\n========== 诊断任务 ${taskId} ==========\n`);

  try {
    // 获取任务信息
    const taskResult = await pool.query(
      `SELECT * FROM generation_tasks WHERE id = $1`,
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      console.error(`❌ 任务 ${taskId} 不存在`);
      return;
    }

    const task = taskResult.rows[0];
    console.log('📋 任务信息:');
    console.log(`  ID: ${task.id}`);
    console.log(`  状态: ${task.status}`);
    console.log(`  请求数量: ${task.requested_count}`);
    console.log(`  已生成数量: ${task.generated_count}`);
    console.log(`  进度: ${task.progress}%`);
    console.log(`  错误信息: ${task.error_message || '无'}`);
    console.log(`  创建时间: ${task.created_at}`);
    console.log(`  更新时间: ${task.updated_at}`);
    console.log('');

    // 检查蒸馏记录
    console.log('🔍 检查蒸馏记录...');
    const distillationResult = await pool.query(
      'SELECT * FROM distillations WHERE id = $1',
      [task.distillation_id]
    );
    if (distillationResult.rows.length === 0) {
      console.log(`  ❌ 蒸馏记录 ${task.distillation_id} 不存在`);
    } else {
      const distillation = distillationResult.rows[0];
      console.log(`  ✅ 蒸馏记录存在`);
      console.log(`     关键词: ${distillation.keyword}`);
      console.log(`     提供商: ${distillation.provider}`);

      // 检查话题
      const topicsResult = await pool.query(
        'SELECT COUNT(*) as count FROM topics WHERE distillation_id = $1',
        [task.distillation_id]
      );
      const topicCount = parseInt(topicsResult.rows[0].count);
      if (topicCount === 0) {
        console.log(`  ❌ 没有关联的话题`);
      } else {
        console.log(`  ✅ 有 ${topicCount} 个话题`);
      }
    }
    console.log('');

    // 检查图库
    console.log('🔍 检查图库...');
    const albumResult = await pool.query(
      'SELECT * FROM albums WHERE id = $1',
      [task.album_id]
    );
    if (albumResult.rows.length === 0) {
      console.log(`  ❌ 图库 ${task.album_id} 不存在`);
    } else {
      const album = albumResult.rows[0];
      console.log(`  ✅ 图库存在: ${album.name}`);

      // 检查图片
      const imagesResult = await pool.query(
        'SELECT COUNT(*) as count FROM images WHERE album_id = $1',
        [task.album_id]
      );
      const imageCount = parseInt(imagesResult.rows[0].count);
      if (imageCount === 0) {
        console.log(`  ⚠️  图库中没有图片（将使用默认占位图）`);
      } else {
        console.log(`  ✅ 有 ${imageCount} 张图片`);
      }
    }
    console.log('');

    // 检查知识库
    console.log('🔍 检查知识库...');
    const kbResult = await pool.query(
      'SELECT * FROM knowledge_bases WHERE id = $1',
      [task.knowledge_base_id]
    );
    if (kbResult.rows.length === 0) {
      console.log(`  ❌ 知识库 ${task.knowledge_base_id} 不存在`);
    } else {
      const kb = kbResult.rows[0];
      console.log(`  ✅ 知识库存在: ${kb.name}`);

      // 检查文档
      const docsResult = await pool.query(
        'SELECT COUNT(*) as count FROM knowledge_documents WHERE knowledge_base_id = $1',
        [task.knowledge_base_id]
      );
      const docCount = parseInt(docsResult.rows[0].count);
      console.log(`  📄 有 ${docCount} 个文档`);
    }
    console.log('');

    // 检查文章设置
    console.log('🔍 检查文章设置...');
    const settingResult = await pool.query(
      'SELECT * FROM article_settings WHERE id = $1',
      [task.article_setting_id]
    );
    if (settingResult.rows.length === 0) {
      console.log(`  ❌ 文章设置 ${task.article_setting_id} 不存在`);
    } else {
      const setting = settingResult.rows[0];
      console.log(`  ✅ 文章设置存在: ${setting.name}`);
    }
    console.log('');

    // 检查AI配置
    console.log('🔍 检查AI配置...');
    const aiConfigResult = await pool.query(
      'SELECT * FROM api_configs WHERE is_active = true LIMIT 1'
    );
    if (aiConfigResult.rows.length === 0) {
      console.log(`  ❌ 没有活跃的AI配置`);
    } else {
      const config = aiConfigResult.rows[0];
      console.log(`  ✅ AI配置存在`);
      console.log(`     提供商: ${config.provider}`);
      if (config.provider === 'ollama') {
        console.log(`     Base URL: ${config.ollama_base_url || '未设置'}`);
        console.log(`     Model: ${config.ollama_model || '未设置'}`);
        if (!config.ollama_base_url || !config.ollama_model) {
          console.log(`  ❌ Ollama配置不完整`);
        }
      } else {
        console.log(`     API Key: ${config.api_key ? '已设置' : '未设置'}`);
        if (!config.api_key) {
          console.log(`  ❌ API Key未设置`);
        }
      }
    }
    console.log('');

    // 检查生成的文章
    console.log('🔍 检查生成的文章...');
    const articlesResult = await pool.query(
      'SELECT id, title, keyword, created_at FROM articles WHERE task_id = $1 ORDER BY created_at DESC',
      [taskId]
    );
    if (articlesResult.rows.length === 0) {
      console.log(`  ❌ 没有生成任何文章`);
    } else {
      console.log(`  ✅ 已生成 ${articlesResult.rows.length} 篇文章:`);
      articlesResult.rows.forEach((article, index) => {
        console.log(`     ${index + 1}. [${article.id}] ${article.title || article.keyword}`);
      });
    }
    console.log('');

    // 提供建议
    console.log('💡 建议:');
    const recommendations = [];

    if (task.status === 'completed' && task.generated_count === 0) {
      recommendations.push('任务标记为已完成但没有生成任何文章，这是一个bug，建议重试任务');
    }

    if (distillationResult.rows.length === 0) {
      recommendations.push('蒸馏记录不存在，无法生成文章');
    } else {
      const topicsResult = await pool.query(
        'SELECT COUNT(*) as count FROM topics WHERE distillation_id = $1',
        [task.distillation_id]
      );
      if (parseInt(topicsResult.rows[0].count) === 0) {
        recommendations.push('没有话题，无法生成文章');
      }
    }

    if (albumResult.rows.length === 0) {
      recommendations.push('图库不存在');
    }

    if (kbResult.rows.length === 0) {
      recommendations.push('知识库不存在');
    }

    if (settingResult.rows.length === 0) {
      recommendations.push('文章设置不存在');
    }

    if (aiConfigResult.rows.length === 0) {
      recommendations.push('没有活跃的AI配置，请先配置AI服务');
    } else {
      const config = aiConfigResult.rows[0];
      if (config.provider === 'ollama' && (!config.ollama_base_url || !config.ollama_model)) {
        recommendations.push('Ollama配置不完整');
      } else if (config.provider !== 'ollama' && !config.api_key) {
        recommendations.push(`${config.provider} API Key未设置`);
      }
    }

    if (task.error_message) {
      recommendations.push(`查看错误信息: ${task.error_message}`);
    }

    if (recommendations.length === 0) {
      console.log('  ✅ 配置看起来正常');
      if (task.status === 'failed' || (task.status === 'completed' && task.generated_count === 0)) {
        console.log('  💡 可以尝试重试任务: curl -X POST http://localhost:3000/api/article-generation/tasks/' + taskId + '/retry');
      }
    } else {
      recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }

    console.log('\n========================================\n');
  } catch (error) {
    console.error('诊断过程中出错:', error);
  } finally {
    await pool.end();
  }
}

// 获取命令行参数
const taskId = parseInt(process.argv[2]);

if (!taskId || isNaN(taskId)) {
  console.error('用法: node scripts/diagnose-task.js <taskId>');
  process.exit(1);
}

diagnoseTask(taskId);
