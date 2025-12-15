/**
 * 测试智能选择功能
 * 
 * 此脚本创建一个测试任务，验证：
 * 1. 是否选择了多个不同的蒸馏结果
 * 2. 每篇文章是否使用了不同的蒸馏结果
 * 3. usage_count是否正确更新
 */

import { pool } from '../db/database';

async function testSmartSelection(): Promise<void> {
  console.log('开始测试智能选择功能...\n');
  
  try {
    // 1. 查询当前所有蒸馏结果的usage_count
    console.log('1. 查询当前蒸馏结果状态：');
    const beforeResult = await pool.query(
      `SELECT id, keyword, usage_count 
       FROM distillations 
       ORDER BY usage_count ASC, created_at ASC 
       LIMIT 10`
    );
    
    console.log('\nID\t关键词\t\t\tusage_count');
    console.log('─'.repeat(60));
    for (const row of beforeResult.rows) {
      const keywordDisplay = row.keyword.length > 20 
        ? row.keyword.substring(0, 17) + '...' 
        : row.keyword.padEnd(20);
      console.log(`${row.id}\t${keywordDisplay}\t${row.usage_count || 0}`);
    }
    
    // 2. 查询最近的一个任务
    console.log('\n2. 查询最近的任务：');
    const taskResult = await pool.query(
      `SELECT id, selected_distillation_ids, requested_count, generated_count, status 
       FROM generation_tasks 
       ORDER BY created_at DESC 
       LIMIT 1`
    );
    
    if (taskResult.rows.length === 0) {
      console.log('没有找到任务');
      return;
    }
    
    const task = taskResult.rows[0];
    console.log(`\n任务ID: ${task.id}`);
    console.log(`状态: ${task.status}`);
    console.log(`请求数量: ${task.requested_count}`);
    console.log(`实际生成: ${task.generated_count}`);
    
    if (task.selected_distillation_ids) {
      const selectedIds = JSON.parse(task.selected_distillation_ids);
      console.log(`\n选择的蒸馏结果IDs: [${selectedIds.join(', ')}]`);
      
      // 查询每个蒸馏结果的详细信息
      console.log('\n选择的蒸馏结果详情：');
      console.log('ID\t关键词\t\t\t当前usage_count');
      console.log('─'.repeat(60));
      
      for (const id of selectedIds) {
        const distResult = await pool.query(
          'SELECT id, keyword, usage_count FROM distillations WHERE id = $1',
          [id]
        );
        
        if (distResult.rows.length > 0) {
          const dist = distResult.rows[0];
          const keywordDisplay = dist.keyword.length > 20 
            ? dist.keyword.substring(0, 17) + '...' 
            : dist.keyword.padEnd(20);
          console.log(`${dist.id}\t${keywordDisplay}\t${dist.usage_count || 0}`);
        }
      }
    }
    
    // 3. 查询该任务生成的文章
    console.log('\n3. 查询该任务生成的文章：');
    const articlesResult = await pool.query(
      `SELECT id, title, keyword, distillation_id 
       FROM articles 
       WHERE task_id = $1 
       ORDER BY id ASC`,
      [task.id]
    );
    
    console.log(`\n生成了 ${articlesResult.rows.length} 篇文章：`);
    console.log('\n文章ID\t蒸馏ID\t关键词\t\t\t标题');
    console.log('─'.repeat(80));
    
    const usedDistillationIds = new Set<number>();
    for (const article of articlesResult.rows) {
      usedDistillationIds.add(article.distillation_id);
      const keywordDisplay = article.keyword.length > 15 
        ? article.keyword.substring(0, 12) + '...' 
        : article.keyword.padEnd(15);
      const titleDisplay = article.title.length > 30 
        ? article.title.substring(0, 27) + '...' 
        : article.title;
      console.log(`${article.id}\t${article.distillation_id}\t${keywordDisplay}\t${titleDisplay}`);
    }
    
    // 4. 验证结果
    console.log('\n4. 验证结果：');
    console.log('─'.repeat(60));
    
    const uniqueDistillations = usedDistillationIds.size;
    const totalArticles = articlesResult.rows.length;
    
    console.log(`✓ 使用了 ${uniqueDistillations} 个不同的蒸馏结果`);
    console.log(`✓ 生成了 ${totalArticles} 篇文章`);
    
    if (uniqueDistillations === totalArticles) {
      console.log('✓ 每篇文章使用了不同的蒸馏结果 - 测试通过！');
    } else {
      console.log(`✗ 警告：有重复使用的蒸馏结果！`);
      console.log(`  预期: ${totalArticles} 个不同的蒸馏结果`);
      console.log(`  实际: ${uniqueDistillations} 个不同的蒸馏结果`);
    }
    
    // 5. 验证usage_count
    console.log('\n5. 验证usage_count更新：');
    for (const distId of usedDistillationIds) {
      const usageResult = await pool.query(
        `SELECT COUNT(*) as actual_count 
         FROM distillation_usage 
         WHERE distillation_id = $1`,
        [distId]
      );
      
      const distResult = await pool.query(
        'SELECT usage_count FROM distillations WHERE id = $1',
        [distId]
      );
      
      const actualCount = parseInt(usageResult.rows[0].actual_count);
      const recordedCount = distResult.rows[0]?.usage_count || 0;
      
      if (actualCount === recordedCount) {
        console.log(`✓ 蒸馏结果ID ${distId}: usage_count=${recordedCount}, 实际使用=${actualCount} - 一致`);
      } else {
        console.log(`✗ 蒸馏结果ID ${distId}: usage_count=${recordedCount}, 实际使用=${actualCount} - 不一致！`);
      }
    }
    
    console.log('\n测试完成！');
    
  } catch (error: any) {
    console.error('测试过程中发生错误:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// 运行测试
testSmartSelection().catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});
