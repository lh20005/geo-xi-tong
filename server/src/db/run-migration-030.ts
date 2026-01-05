import { pool } from './database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('开始执行迁移 030: 修复配额时效性问题...\n');
    
    // 读取迁移文件
    const migrationPath = path.join(__dirname, 'migrations', '030_fix_quota_expiration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // 执行迁移
    await client.query(migrationSQL);
    
    console.log('\n✅ 迁移 030 执行成功！');
    console.log('\n变更摘要:');
    console.log('1. ✅ 移除了永久配额概念');
    console.log('2. ✅ 所有配额现在都与订阅周期绑定');
    console.log('3. ✅ 订阅到期后配额自动失效');
    console.log('4. ✅ 更新了配额检查和记录函数');
    console.log('5. ✅ 添加了订阅到期和续费处理函数');
    console.log('6. ✅ 清理了现有的永久配额记录');
    
    // 验证迁移结果
    console.log('\n验证迁移结果...');
    
    // 检查是否还有永久配额
    const permanentQuotasResult = await client.query(`
      SELECT COUNT(*) as count
      FROM user_usage
      WHERE period_end > '2099-01-01'::TIMESTAMP
    `);
    
    const permanentCount = parseInt(permanentQuotasResult.rows[0].count);
    if (permanentCount > 0) {
      console.log(`⚠️  警告: 仍有 ${permanentCount} 条永久配额记录`);
    } else {
      console.log('✅ 所有永久配额已清理');
    }
    
    // 检查过期订阅
    const expiredSubsResult = await client.query(`
      SELECT COUNT(*) as count
      FROM user_subscriptions
      WHERE status = 'active' AND end_date <= CURRENT_TIMESTAMP
    `);
    
    const expiredCount = parseInt(expiredSubsResult.rows[0].count);
    if (expiredCount > 0) {
      console.log(`⚠️  警告: 仍有 ${expiredCount} 个未处理的过期订阅`);
    } else {
      console.log('✅ 所有过期订阅已处理');
    }
    
    // 显示配额统计
    const quotaStatsResult = await client.query(`
      SELECT 
        feature_code,
        COUNT(*) as user_count,
        MIN(period_end) as earliest_end,
        MAX(period_end) as latest_end
      FROM user_usage
      WHERE period_end > CURRENT_TIMESTAMP
      GROUP BY feature_code
      ORDER BY feature_code
    `);
    
    console.log('\n当前配额统计:');
    quotaStatsResult.rows.forEach(row => {
      console.log(`  ${row.feature_code}: ${row.user_count} 个用户`);
    });
    
  } catch (error) {
    console.error('❌ 迁移执行失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// 执行迁移
runMigration().catch(error => {
  console.error('迁移失败:', error);
  process.exit(1);
});
