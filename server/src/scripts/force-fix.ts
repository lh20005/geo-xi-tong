/**
 * 强制修复智能选择问题
 * 
 * 此脚本将：
 * 1. 检查并添加selected_distillation_ids字段（如果不存在）
 * 2. 为所有现有任务初始化selected_distillation_ids
 * 3. 修复所有usage_count
 */

import { pool } from '../db/database';

async function forceFix(): Promise<void> {
  console.log('开始强制修复...\n');
  
  const client = await pool.connect();
  
  try {
    // 1. 检查selected_distillation_ids字段是否存在
    console.log('1. 检查selected_distillation_ids字段...');
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'generation_tasks' 
      AND column_name = 'selected_distillation_ids'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('   字段不存在，正在添加...');
      await client.query(`
        ALTER TABLE generation_tasks 
        ADD COLUMN selected_distillation_ids TEXT
      `);
      console.log('   ✓ 字段已添加');
    } else {
      console.log('   ✓ 字段已存在');
    }
    
    // 2. 为所有现有任务初始化selected_distillation_ids
    console.log('\n2. 初始化现有任务的selected_distillation_ids...');
    
    const tasksResult = await client.query(`
      SELECT id, distillation_id, selected_distillation_ids, requested_count
      FROM generation_tasks
      WHERE selected_distillation_ids IS NULL
    `);
    
    console.log(`   找到 ${tasksResult.rows.length} 个需要初始化的任务`);
    
    for (const task of tasksResult.rows) {
      // 为每个任务选择蒸馏结果
      const selectResult = await client.query(`
        SELECT d.id
        FROM distillations d
        INNER JOIN topics t ON d.id = t.distillation_id
        GROUP BY d.id, d.usage_count, d.created_at
        HAVING COUNT(t.id) > 0
        ORDER BY d.usage_count ASC, d.created_at ASC
        LIMIT $1
      `, [task.requested_count]);
      
      if (selectResult.rows.length > 0) {
        const selectedIds = selectResult.rows.map((row: any) => row.id);
        const selectedIdsJson = JSON.stringify(selectedIds);
        
        await client.query(`
          UPDATE generation_tasks
          SET selected_distillation_ids = $1
          WHERE id = $2
        `, [selectedIdsJson, task.id]);
        
        console.log(`   ✓ 任务 ${task.id}: 初始化为 ${selectedIdsJson}`);
      } else {
        // 如果没有足够的蒸馏结果，使用distillation_id
        const fallbackIds = JSON.stringify([task.distillation_id]);
        await client.query(`
          UPDATE generation_tasks
          SET selected_distillation_ids = $1
          WHERE id = $2
        `, [fallbackIds, task.id]);
        
        console.log(`   ✓ 任务 ${task.id}: 使用后备方案 ${fallbackIds}`);
      }
    }
    
    // 3. 修复所有usage_count
    console.log('\n3. 修复usage_count...');
    
    const distillationsResult = await client.query(`
      SELECT id, keyword, usage_count
      FROM distillations
      ORDER BY id ASC
    `);
    
    let fixedCount = 0;
    
    for (const dist of distillationsResult.rows) {
      const actualResult = await client.query(`
        SELECT COUNT(*) as count
        FROM distillation_usage
        WHERE distillation_id = $1
      `, [dist.id]);
      
      const actualCount = parseInt(actualResult.rows[0].count);
      const currentCount = dist.usage_count || 0;
      
      if (actualCount !== currentCount) {
        await client.query(`
          UPDATE distillations
          SET usage_count = $1
          WHERE id = $2
        `, [actualCount, dist.id]);
        
        console.log(`   ✓ 蒸馏结果 ${dist.id} (${dist.keyword}): ${currentCount} → ${actualCount}`);
        fixedCount++;
      }
    }
    
    console.log(`   修复了 ${fixedCount} 个蒸馏结果的usage_count`);
    
    // 4. 验证修复结果
    console.log('\n4. 验证修复结果...');
    
    const verifyTasks = await client.query(`
      SELECT COUNT(*) as count
      FROM generation_tasks
      WHERE selected_distillation_ids IS NULL
    `);
    
    const nullCount = parseInt(verifyTasks.rows[0].count);
    if (nullCount === 0) {
      console.log('   ✓ 所有任务都有selected_distillation_ids');
    } else {
      console.log(`   ✗ 仍有 ${nullCount} 个任务的selected_distillation_ids为NULL`);
    }
    
    const verifyUsage = await client.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN d.usage_count = COALESCE(du.count, 0) THEN 1 ELSE 0 END) as consistent
      FROM distillations d
      LEFT JOIN (
        SELECT distillation_id, COUNT(*) as count
        FROM distillation_usage
        GROUP BY distillation_id
      ) du ON d.id = du.distillation_id
    `);
    
    const total = parseInt(verifyUsage.rows[0].total);
    const consistent = parseInt(verifyUsage.rows[0].consistent);
    
    console.log(`   usage_count一致性: ${consistent}/${total}`);
    
    if (consistent === total) {
      console.log('   ✓ 所有usage_count都一致');
    } else {
      console.log(`   ✗ 有 ${total - consistent} 个蒸馏结果的usage_count不一致`);
    }
    
    console.log('\n✓ 强制修复完成！');
    console.log('\n下一步：');
    console.log('1. 重启服务器：npm run dev');
    console.log('2. 创建新任务测试');
    console.log('3. 运行诊断：npm run diagnose-issue');
    
  } catch (error: any) {
    console.error('\n✗ 修复失败:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// 运行修复
forceFix().catch(error => {
  console.error('修复失败:', error);
  process.exit(1);
});
