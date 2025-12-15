/**
 * 诊断智能选择问题
 * 
 * 检查：
 * 1. 数据库中是否有selected_distillation_ids字段
 * 2. 最近的任务是否正确保存了selected_distillation_ids
 * 3. 生成的文章是否使用了不同的蒸馏结果
 */

import { pool } from '../db/database';

async function diagnoseIssue(): Promise<void> {
  console.log('开始诊断智能选择问题...\n');
  
  try {
    // 1. 检查表结构
    console.log('1. 检查generation_tasks表结构：');
    const tableInfo = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'generation_tasks'
      ORDER BY ordinal_position
    `);
    
    console.log('\n字段列表：');
    for (const col of tableInfo.rows) {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    }
    
    const hasSelectedIds = tableInfo.rows.some((col: any) => col.column_name === 'selected_distillation_ids');
    if (!hasSelectedIds) {
      console.log('\n❌ 错误：generation_tasks表中没有selected_distillation_ids字段！');
      console.log('   请运行迁移：npm run db:migrate:smart-selection');
      return;
    } else {
      console.log('\n✓ selected_distillation_ids字段存在');
    }
    
    // 2. 检查最近的任务
    console.log('\n2. 检查最近的5个任务：');
    const tasksResult = await pool.query(`
      SELECT 
        id, 
        distillation_id,
        selected_distillation_ids, 
        requested_count, 
        generated_count, 
        status,
        created_at
      FROM generation_tasks 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log('\nID\t状态\t\t请求\t生成\tselected_distillation_ids');
    console.log('─'.repeat(80));
    
    for (const task of tasksResult.rows) {
      const statusDisplay = task.status.padEnd(10);
      const idsDisplay = task.selected_distillation_ids || 'NULL';
      console.log(`${task.id}\t${statusDisplay}\t${task.requested_count}\t${task.generated_count}\t${idsDisplay}`);
    }
    
    // 3. 检查最近任务的详细信息
    if (tasksResult.rows.length > 0) {
      const latestTask = tasksResult.rows[0];
      console.log(`\n3. 检查最近任务 (ID: ${latestTask.id}) 的详细信息：`);
      
      console.log(`\n任务配置：`);
      console.log(`  - distillation_id: ${latestTask.distillation_id}`);
      console.log(`  - selected_distillation_ids: ${latestTask.selected_distillation_ids || 'NULL'}`);
      console.log(`  - 请求数量: ${latestTask.requested_count}`);
      console.log(`  - 实际生成: ${latestTask.generated_count}`);
      console.log(`  - 状态: ${latestTask.status}`);
      
      // 检查生成的文章
      const articlesResult = await pool.query(`
        SELECT id, title, keyword, distillation_id, created_at
        FROM articles 
        WHERE task_id = $1 
        ORDER BY id ASC
      `, [latestTask.id]);
      
      console.log(`\n生成的文章 (${articlesResult.rows.length}篇)：`);
      console.log('\n文章ID\t蒸馏ID\t关键词');
      console.log('─'.repeat(60));
      
      const usedDistillationIds = new Set<number>();
      for (const article of articlesResult.rows) {
        usedDistillationIds.add(article.distillation_id);
        const keywordDisplay = article.keyword.length > 30 
          ? article.keyword.substring(0, 27) + '...' 
          : article.keyword;
        console.log(`${article.id}\t${article.distillation_id}\t${keywordDisplay}`);
      }
      
      console.log(`\n分析：`);
      console.log(`  - 使用了 ${usedDistillationIds.size} 个不同的蒸馏结果`);
      console.log(`  - 生成了 ${articlesResult.rows.length} 篇文章`);
      
      if (usedDistillationIds.size === 1 && articlesResult.rows.length > 1) {
        console.log(`\n❌ 问题确认：所有文章都使用了同一个蒸馏结果 (ID: ${Array.from(usedDistillationIds)[0]})`);
        
        // 检查是否是"英国留学机构哪家好"
        const distResult = await pool.query(
          'SELECT keyword FROM distillations WHERE id = $1',
          [Array.from(usedDistillationIds)[0]]
        );
        if (distResult.rows.length > 0) {
          console.log(`   关键词: "${distResult.rows[0].keyword}"`);
        }
        
        // 检查selected_distillation_ids
        if (latestTask.selected_distillation_ids) {
          try {
            const selectedIds = JSON.parse(latestTask.selected_distillation_ids);
            console.log(`\n   但是selected_distillation_ids包含: [${selectedIds.join(', ')}]`);
            console.log(`   这说明选择逻辑正常，但执行逻辑有问题！`);
          } catch (e) {
            console.log(`\n   selected_distillation_ids解析失败: ${e}`);
          }
        } else {
          console.log(`\n   selected_distillation_ids为NULL，使用了旧逻辑`);
        }
      } else if (usedDistillationIds.size === articlesResult.rows.length) {
        console.log(`\n✓ 正常：每篇文章使用了不同的蒸馏结果`);
      } else {
        console.log(`\n⚠️  部分重复：有些蒸馏结果被重复使用`);
      }
    }
    
    // 4. 检查所有蒸馏结果的usage_count
    console.log('\n4. 检查蒸馏结果的usage_count：');
    const distillationsResult = await pool.query(`
      SELECT 
        d.id,
        d.keyword,
        d.usage_count,
        COUNT(du.id) as actual_usage
      FROM distillations d
      LEFT JOIN distillation_usage du ON d.id = du.distillation_id
      GROUP BY d.id, d.keyword, d.usage_count
      ORDER BY d.usage_count ASC, d.created_at ASC
      LIMIT 10
    `);
    
    console.log('\nID\t关键词\t\t\t\tusage_count\t实际使用\t状态');
    console.log('─'.repeat(80));
    
    for (const dist of distillationsResult.rows) {
      const keywordDisplay = dist.keyword.length > 25 
        ? dist.keyword.substring(0, 22) + '...' 
        : dist.keyword.padEnd(25);
      const usageCount = dist.usage_count || 0;
      const actualUsage = parseInt(dist.actual_usage);
      const status = usageCount === actualUsage ? '✓' : '✗';
      console.log(`${dist.id}\t${keywordDisplay}\t${usageCount}\t\t${actualUsage}\t\t${status}`);
    }
    
    console.log('\n诊断完成！');
    
  } catch (error: any) {
    console.error('诊断过程中发生错误:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    await pool.end();
  }
}

// 运行诊断
diagnoseIssue().catch(error => {
  console.error('诊断失败:', error);
  process.exit(1);
});
