/**
 * 修复蒸馏结果usage_count的不一致问题
 * 
 * 此脚本重新计算所有蒸馏结果的usage_count，使其等于实际使用记录数量
 */

import { pool } from '../db/database';

interface FixResult {
  distillationId: number;
  keyword: string;
  oldCount: number;
  newCount: number;
  fixed: boolean;
}

async function fixUsageCount(): Promise<void> {
  console.log('开始修复蒸馏结果usage_count...\n');
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    console.log('事务开始\n');
    
    // 查询所有蒸馏结果
    const distillationsResult = await client.query(
      `SELECT id, keyword, usage_count 
       FROM distillations 
       ORDER BY id ASC`
    );
    
    const results: FixResult[] = [];
    let fixedCount = 0;
    
    for (const row of distillationsResult.rows) {
      const distillationId = row.id;
      const keyword = row.keyword;
      const oldCount = row.usage_count || 0;
      
      // 查询实际使用记录数量
      const actualResult = await client.query(
        `SELECT COUNT(*) as count 
         FROM distillation_usage 
         WHERE distillation_id = $1`,
        [distillationId]
      );
      
      const newCount = parseInt(actualResult.rows[0].count);
      const needsFix = oldCount !== newCount;
      
      if (needsFix) {
        // 更新usage_count
        await client.query(
          `UPDATE distillations 
           SET usage_count = $1 
           WHERE id = $2`,
          [newCount, distillationId]
        );
        
        fixedCount++;
        console.log(`✓ 修复 ID=${distillationId}, 关键词="${keyword}": ${oldCount} → ${newCount}`);
      }
      
      results.push({
        distillationId,
        keyword,
        oldCount,
        newCount,
        fixed: needsFix
      });
    }
    
    await client.query('COMMIT');
    console.log('\n事务提交成功\n');
    
    // 输出摘要
    console.log('修复摘要：');
    console.log('─'.repeat(80));
    console.log(`总计: ${results.length} 个蒸馏结果`);
    console.log(`已修复: ${fixedCount} 个`);
    console.log(`无需修复: ${results.length - fixedCount} 个`);
    
    if (fixedCount > 0) {
      console.log('\n✓ 修复完成！所有usage_count已更新为实际使用记录数量。');
    } else {
      console.log('\n✓ 所有数据已经一致，无需修复。');
    }
    
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('\n✗ 修复失败，事务已回滚:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// 运行修复
fixUsageCount().catch(error => {
  console.error('修复失败:', error);
  process.exit(1);
});
