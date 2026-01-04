/**
 * 验证配额修复
 * 快速检查配额系统是否正常工作
 */

import { pool } from '../db/database';

async function verifyQuotaFix() {
  console.log('=== 验证配额修复 ===\n');

  try {
    // 1. 检查迁移 021 是否执行
    console.log('1. 检查迁移状态:');
    const migrationResult = await pool.query(
      `SELECT * FROM schema_migrations WHERE version = '021'`
    );
    
    if (migrationResult.rows.length > 0) {
      console.log('  ✅ 迁移 021 已执行');
      console.log(`     执行时间: ${migrationResult.rows[0].executed_at}\n`);
    } else {
      console.log('  ❌ 迁移 021 未执行\n');
    }

    // 2. 检查 user_usage 表中的记录
    console.log('2. 检查 user_usage 表:');
    const usageResult = await pool.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN period_end > CURRENT_TIMESTAMP THEN 1 END) as valid,
        COUNT(CASE WHEN period_end <= CURRENT_TIMESTAMP THEN 1 END) as expired
       FROM user_usage`
    );
    
    const stats = usageResult.rows[0];
    console.log(`  总记录数: ${stats.total}`);
    console.log(`  有效记录: ${stats.valid}`);
    console.log(`  过期记录: ${stats.expired}`);
    
    if (parseInt(stats.expired) > 0) {
      console.log('  ⚠️  存在过期记录，建议清理\n');
    } else {
      console.log('  ✅ 没有过期记录\n');
    }

    // 3. 检查功能配额类型
    console.log('3. 检查功能配额类型:');
    const featureResult = await pool.query(
      `SELECT DISTINCT feature_code, COUNT(*) as user_count
       FROM user_usage
       WHERE period_end > CURRENT_TIMESTAMP
       GROUP BY feature_code
       ORDER BY feature_code`
    );
    
    if (featureResult.rows.length === 0) {
      console.log('  ⚠️  没有配额记录\n');
    } else {
      featureResult.rows.forEach(row => {
        console.log(`  ${row.feature_code}: ${row.user_count} 个用户`);
      });
      console.log();
    }

    // 4. 检查存储使用一致性
    console.log('4. 检查存储使用一致性:');
    const storageResult = await pool.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN (image_storage_bytes + document_storage_bytes + article_storage_bytes) = total_storage_bytes THEN 1 END) as consistent
       FROM user_storage_usage`
    );
    
    const storage = storageResult.rows[0];
    console.log(`  总用户数: ${storage.total}`);
    console.log(`  一致记录: ${storage.consistent}`);
    
    if (storage.total === storage.consistent) {
      console.log('  ✅ 所有存储记录一致\n');
    } else {
      console.log(`  ⚠️  有 ${parseInt(storage.total) - parseInt(storage.consistent)} 个用户的存储记录不一致\n`);
    }

    // 5. 测试配额检查函数
    console.log('5. 测试配额检查函数:');
    const testResult = await pool.query(
      `SELECT * FROM check_user_quota(1, 'articles_per_month')`
    );
    
    if (testResult.rows.length > 0) {
      const quota = testResult.rows[0];
      console.log('  ✅ 函数正常工作');
      console.log(`     has_quota: ${quota.has_quota}`);
      console.log(`     current_usage: ${quota.current_usage}`);
      console.log(`     quota_limit: ${quota.quota_limit}`);
      console.log(`     remaining: ${quota.remaining}\n`);
    } else {
      console.log('  ❌ 函数返回空结果\n');
    }

    // 6. 总结
    console.log('6. 修复验证总结:');
    const allGood = 
      migrationResult.rows.length > 0 &&
      parseInt(stats.expired) === 0 &&
      featureResult.rows.length > 0 &&
      storage.total === storage.consistent &&
      testResult.rows.length > 0;
    
    if (allGood) {
      console.log('  🎉 所有检查通过，配额系统修复成功！\n');
    } else {
      console.log('  ⚠️  部分检查未通过，请查看上述详情\n');
    }

  } catch (error) {
    console.error('❌ 验证失败:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

verifyQuotaFix();
