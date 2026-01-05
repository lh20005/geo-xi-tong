/**
 * 测试使用统计修复
 */

import { pool } from '../db/database';
import { SubscriptionService } from '../services/SubscriptionService';

async function testUsageStatsFix() {
  try {
    console.log('='.repeat(80));
    console.log('测试使用统计修复');
    console.log('='.repeat(80));

    // 获取测试用户
    const userResult = await pool.query(
      `SELECT id, username FROM users WHERE username = 'lzc2005'`
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ 用户不存在');
      return;
    }
    
    const user = userResult.rows[0];
    console.log(`\n✅ 测试用户: ${user.username} (ID: ${user.id})`);
    
    // 测试 getUserUsageStats
    console.log('\n测试 getUserUsageStats:');
    console.log('-'.repeat(80));
    
    const subscriptionService = new SubscriptionService();
    
    try {
      const stats = await subscriptionService.getUserUsageStats(user.id);
      
      console.log(`\n✅ 成功获取使用统计 (${stats.length} 项):\n`);
      
      stats.forEach(stat => {
        console.log(`📊 ${stat.feature_name}:`);
        console.log(`   - 功能代码: ${stat.feature_code}`);
        console.log(`   - 已使用: ${stat.used} ${stat.unit}`);
        console.log(`   - 配额: ${stat.limit === -1 ? '无限制' : `${stat.limit} ${stat.unit}`}`);
        console.log(`   - 剩余: ${stat.remaining === -1 ? '无限制' : `${stat.remaining} ${stat.unit}`}`);
        console.log(`   - 使用率: ${stat.percentage.toFixed(1)}%`);
        console.log(`   - 重置时间: ${stat.reset_time || '未设置'}`);
        console.log('');
      });
      
      console.log('✅ 测试成功！API 应该可以正常工作了');
      
    } catch (error: any) {
      console.log('\n❌ 测试失败:', error.message);
      console.log('错误堆栈:', error.stack);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('测试完成');
    console.log('='.repeat(80));
    
  } catch (error: any) {
    console.error('❌ 测试过程出错:', error.message);
    console.error('错误堆栈:', error.stack);
  } finally {
    await pool.end();
  }
}

testUsageStatsFix();
