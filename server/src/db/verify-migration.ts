/**
 * 验证数据库迁移脚本
 * 
 * 检查：
 * 1. usage_count字段是否存在
 * 2. distillation_usage表是否存在
 * 3. 所有索引是否创建
 * 4. 数据一致性检查
 */

import { pool } from './database';

interface VerificationResult {
  success: boolean;
  message: string;
  details?: any;
}

async function verifyMigration(): Promise<void> {
  console.log('开始验证数据库迁移...\n');

  const results: VerificationResult[] = [];

  try {
    // 1. 验证usage_count字段存在
    console.log('1. 检查usage_count字段...');
    const columnCheck = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'distillations' AND column_name = 'usage_count'
    `);

    if (columnCheck.rows.length > 0) {
      results.push({
        success: true,
        message: '✓ usage_count字段存在',
        details: columnCheck.rows[0]
      });
      console.log('  ✓ usage_count字段存在');
      console.log(`    类型: ${columnCheck.rows[0].data_type}`);
      console.log(`    默认值: ${columnCheck.rows[0].column_default}`);
    } else {
      results.push({
        success: false,
        message: '✗ usage_count字段不存在'
      });
      console.log('  ✗ usage_count字段不存在');
    }

    // 2. 验证distillation_usage表存在
    console.log('\n2. 检查distillation_usage表...');
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables
      WHERE table_name = 'distillation_usage'
    `);

    if (tableCheck.rows.length > 0) {
      results.push({
        success: true,
        message: '✓ distillation_usage表存在'
      });
      console.log('  ✓ distillation_usage表存在');

      // 检查表结构
      const columnsCheck = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'distillation_usage'
        ORDER BY ordinal_position
      `);
      console.log('  表结构:');
      columnsCheck.rows.forEach(col => {
        console.log(`    - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'})`);
      });
    } else {
      results.push({
        success: false,
        message: '✗ distillation_usage表不存在'
      });
      console.log('  ✗ distillation_usage表不存在');
    }

    // 3. 验证索引存在
    console.log('\n3. 检查索引...');
    const expectedIndexes = [
      'idx_distillations_usage_count',
      'idx_distillation_usage_distillation',
      'idx_distillation_usage_task',
      'idx_distillation_usage_article',
      'idx_distillation_usage_used_at'
    ];

    const indexCheck = await pool.query(`
      SELECT indexname 
      FROM pg_indexes
      WHERE tablename IN ('distillations', 'distillation_usage')
      AND indexname LIKE 'idx_%'
    `);

    const existingIndexes = indexCheck.rows.map(row => row.indexname);
    
    expectedIndexes.forEach(indexName => {
      if (existingIndexes.includes(indexName)) {
        results.push({
          success: true,
          message: `✓ 索引 ${indexName} 存在`
        });
        console.log(`  ✓ ${indexName}`);
      } else {
        results.push({
          success: false,
          message: `✗ 索引 ${indexName} 不存在`
        });
        console.log(`  ✗ ${indexName}`);
      }
    });

    // 4. 验证约束
    console.log('\n4. 检查约束...');
    const constraintCheck = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'distillation_usage'
      AND constraint_type IN ('UNIQUE', 'FOREIGN KEY')
    `);

    console.log('  约束列表:');
    constraintCheck.rows.forEach(constraint => {
      console.log(`    - ${constraint.constraint_name}: ${constraint.constraint_type}`);
    });

    // 检查unique_article_usage约束
    const uniqueConstraint = constraintCheck.rows.find(
      c => c.constraint_name === 'unique_article_usage'
    );
    if (uniqueConstraint) {
      results.push({
        success: true,
        message: '✓ unique_article_usage约束存在'
      });
      console.log('  ✓ unique_article_usage约束存在');
    } else {
      results.push({
        success: false,
        message: '✗ unique_article_usage约束不存在'
      });
      console.log('  ✗ unique_article_usage约束不存在');
    }

    // 5. 验证数据一致性
    console.log('\n5. 检查数据一致性...');
    const consistencyCheck = await pool.query(`
      SELECT 
        d.id,
        d.keyword,
        d.usage_count,
        COUNT(a.id) as actual_count
      FROM distillations d
      LEFT JOIN articles a ON d.id = a.distillation_id
      GROUP BY d.id, d.keyword, d.usage_count
      HAVING d.usage_count != COUNT(a.id)
    `);

    if (consistencyCheck.rows.length === 0) {
      results.push({
        success: true,
        message: '✓ 数据一致性检查通过'
      });
      console.log('  ✓ 所有蒸馏结果的usage_count与实际文章数量一致');
    } else {
      results.push({
        success: false,
        message: '✗ 发现数据不一致',
        details: consistencyCheck.rows
      });
      console.log('  ✗ 发现数据不一致:');
      consistencyCheck.rows.forEach(row => {
        console.log(`    - 蒸馏结果 ${row.id} (${row.keyword}): usage_count=${row.usage_count}, 实际文章数=${row.actual_count}`);
      });
    }

    // 6. 统计信息
    console.log('\n6. 统计信息...');
    const statsCheck = await pool.query(`
      SELECT 
        COUNT(*) as total_distillations,
        SUM(usage_count) as total_usage,
        AVG(usage_count) as avg_usage,
        MAX(usage_count) as max_usage,
        MIN(usage_count) as min_usage
      FROM distillations
    `);

    if (statsCheck.rows.length > 0) {
      const stats = statsCheck.rows[0];
      console.log(`  总蒸馏结果数: ${stats.total_distillations}`);
      console.log(`  总使用次数: ${stats.total_usage}`);
      console.log(`  平均使用次数: ${parseFloat(stats.avg_usage).toFixed(2)}`);
      console.log(`  最大使用次数: ${stats.max_usage}`);
      console.log(`  最小使用次数: ${stats.min_usage}`);
    }

    const usageRecordsCheck = await pool.query('SELECT COUNT(*) as count FROM distillation_usage');
    console.log(`  使用记录总数: ${usageRecordsCheck.rows[0].count}`);

    // 总结
    console.log('\n' + '='.repeat(50));
    console.log('验证结果总结:');
    console.log('='.repeat(50));

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`✓ 成功: ${successCount}`);
    console.log(`✗ 失败: ${failCount}`);

    if (failCount === 0) {
      console.log('\n✓ 所有检查通过！数据库迁移成功。');
    } else {
      console.log('\n✗ 部分检查失败，请检查上述错误信息。');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n验证过程中发生错误:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// 运行验证
verifyMigration().catch(error => {
  console.error('验证失败:', error);
  process.exit(1);
});
