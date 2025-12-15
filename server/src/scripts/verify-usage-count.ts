/**
 * 验证蒸馏结果usage_count的准确性
 * 
 * 此脚本比对每个蒸馏结果的usage_count字段与实际使用记录数量
 * 如果发现不一致，报告详细信息
 */

import { pool } from '../db/database';

interface VerificationResult {
  distillationId: number;
  keyword: string;
  usageCount: number;
  actualCount: number;
  difference: number;
  consistent: boolean;
}

async function verifyUsageCount(): Promise<void> {
  console.log('开始验证蒸馏结果usage_count的准确性...\n');
  
  try {
    // 查询所有蒸馏结果及其usage_count
    const distillationsResult = await pool.query(
      `SELECT id, keyword, usage_count 
       FROM distillations 
       ORDER BY id ASC`
    );
    
    const results: VerificationResult[] = [];
    let inconsistentCount = 0;
    
    for (const row of distillationsResult.rows) {
      const distillationId = row.id;
      const keyword = row.keyword;
      const usageCount = row.usage_count || 0;
      
      // 查询实际使用记录数量
      const actualResult = await pool.query(
        `SELECT COUNT(*) as count 
         FROM distillation_usage 
         WHERE distillation_id = $1`,
        [distillationId]
      );
      
      const actualCount = parseInt(actualResult.rows[0].count);
      const difference = usageCount - actualCount;
      const consistent = difference === 0;
      
      if (!consistent) {
        inconsistentCount++;
      }
      
      results.push({
        distillationId,
        keyword,
        usageCount,
        actualCount,
        difference,
        consistent
      });
    }
    
    // 输出结果
    console.log('验证结果：\n');
    console.log('ID\t关键词\t\t\tusage_count\t实际使用\t差异\t状态');
    console.log('─'.repeat(80));
    
    for (const result of results) {
      const status = result.consistent ? '✓ 一致' : '✗ 不一致';
      const keywordDisplay = result.keyword.length > 15 
        ? result.keyword.substring(0, 12) + '...' 
        : result.keyword.padEnd(15);
      
      console.log(
        `${result.distillationId}\t${keywordDisplay}\t${result.usageCount}\t\t${result.actualCount}\t\t${result.difference > 0 ? '+' : ''}${result.difference}\t${status}`
      );
    }
    
    console.log('─'.repeat(80));
    console.log(`\n总计: ${results.length} 个蒸馏结果`);
    console.log(`一致: ${results.length - inconsistentCount} 个`);
    console.log(`不一致: ${inconsistentCount} 个`);
    
    if (inconsistentCount > 0) {
      console.log('\n⚠️  发现数据不一致！建议运行修复脚本：');
      console.log('   npm run fix-usage-count');
    } else {
      console.log('\n✓ 所有数据一致！');
    }
    
  } catch (error: any) {
    console.error('验证过程中发生错误:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// 运行验证
verifyUsageCount().catch(error => {
  console.error('验证失败:', error);
  process.exit(1);
});
