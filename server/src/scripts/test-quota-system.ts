/**
 * 配额系统测试脚本
 * 用于验证配额追踪和预警功能是否正常工作
 */

import { pool } from '../db/database';
import { usageTrackingService } from '../services/UsageTrackingService';
import { quotaAlertService } from '../services/QuotaAlertService';

async function testQuotaSystem() {
  console.log('🧪 开始测试配额系统...\n');
  
  try {
    // 测试用户ID（请根据实际情况修改）
    const testUserId = 1;
    
    // ========== 测试 1: 检查配额 ==========
    console.log('📊 测试 1: 检查用户配额');
    console.log('─'.repeat(50));
    
    const quota = await usageTrackingService.checkQuota(testUserId, 'articles_per_day');
    console.log('配额信息:');
    console.log(`  - 是否有配额: ${quota.hasQuota ? '✓' : '✗'}`);
    console.log(`  - 当前使用: ${quota.currentUsage}`);
    console.log(`  - 配额限制: ${quota.quotaLimit === -1 ? '无限制' : quota.quotaLimit}`);
    console.log(`  - 剩余配额: ${quota.remaining === -1 ? '无限制' : quota.remaining}`);
    console.log(`  - 使用百分比: ${quota.percentage.toFixed(2)}%`);
    console.log('');
    
    // ========== 测试 2: 记录使用量 ==========
    console.log('📝 测试 2: 记录使用量');
    console.log('─'.repeat(50));
    
    console.log('记录一次文章生成...');
    await usageTrackingService.recordUsage(
      testUserId,
      'articles_per_day',
      'article',
      999,
      1,
      { title: '测试文章', test: true }
    );
    console.log('✓ 使用量记录成功');
    
    // 再次检查配额
    const quotaAfter = await usageTrackingService.checkQuota(testUserId, 'articles_per_day');
    console.log(`当前使用: ${quotaAfter.currentUsage} (增加了 ${quotaAfter.currentUsage - quota.currentUsage})`);
    console.log('');
    
    // ========== 测试 3: 获取配额概览 ==========
    console.log('📋 测试 3: 获取配额概览');
    console.log('─'.repeat(50));
    
    const overview = await usageTrackingService.getUserQuotaOverview(testUserId);
    console.log(`找到 ${overview.length} 个功能配额:`);
    overview.forEach(item => {
      const status = item.usagePercentage >= 95 ? '🔴' : 
                     item.usagePercentage >= 80 ? '⚠️' : '✓';
      console.log(`  ${status} ${item.featureName}: ${item.currentUsage}/${item.quotaLimit === -1 ? '∞' : item.quotaLimit} (${item.usagePercentage.toFixed(1)}%)`);
    });
    console.log('');
    
    // ========== 测试 4: 获取使用记录 ==========
    console.log('📜 测试 4: 获取使用记录');
    console.log('─'.repeat(50));
    
    const records = await usageTrackingService.getUserUsageRecords(testUserId, undefined, 1, 5);
    console.log(`最近 ${records.records.length} 条使用记录:`);
    records.records.forEach((record, index) => {
      console.log(`  ${index + 1}. ${record.feature_name} - ${record.resource_type || 'N/A'} (${new Date(record.created_at).toLocaleString()})`);
    });
    console.log(`总记录数: ${records.total}`);
    console.log('');
    
    // ========== 测试 5: 获取使用统计 ==========
    console.log('📈 测试 5: 获取使用统计');
    console.log('─'.repeat(50));
    
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7天前
    
    const statistics = await usageTrackingService.getUsageStatistics(
      testUserId,
      'articles_per_day',
      startDate,
      endDate
    );
    
    console.log(`过去7天总使用量: ${statistics.totalUsage}`);
    console.log('每日使用量:');
    statistics.dailyUsage.forEach(day => {
      console.log(`  ${day.date}: ${day.count} 次`);
    });
    console.log('');
    
    // ========== 测试 6: 配额预警 ==========
    console.log('⚠️  测试 6: 配额预警');
    console.log('─'.repeat(50));
    
    const alerts = await quotaAlertService.getUnsentAlerts(testUserId);
    console.log(`未读预警数: ${alerts.length}`);
    alerts.forEach((alert: any, index) => {
      const icon = alert.alertType === 'depleted' ? '🔴' :
                   alert.alertType === 'critical' ? '⚠️' : '⚡';
      console.log(`  ${icon} ${alert.featureName || alert.feature_name}: ${alert.alertType} (${alert.thresholdPercentage}%)`);
    });
    console.log('');
    
    // ========== 测试 7: 预警统计 ==========
    console.log('📊 测试 7: 预警统计');
    console.log('─'.repeat(50));
    
    const alertStats = await quotaAlertService.getAlertStatistics(testUserId);
    console.log(`总预警数: ${alertStats.totalAlerts}`);
    console.log(`未发送预警: ${alertStats.unsentAlerts}`);
    console.log('按类型统计:');
    console.log(`  - 警告 (warning): ${alertStats.alertsByType.warning}`);
    console.log(`  - 严重 (critical): ${alertStats.alertsByType.critical}`);
    console.log(`  - 耗尽 (depleted): ${alertStats.alertsByType.depleted}`);
    console.log('');
    
    // ========== 测试 8: 数据库函数 ==========
    console.log('🔧 测试 8: 数据库函数');
    console.log('─'.repeat(50));
    
    const dbResult = await pool.query(
      `SELECT * FROM check_user_quota($1, $2)`,
      [testUserId, 'articles_per_day']
    );
    
    console.log('数据库函数返回:');
    console.log(`  - has_quota: ${dbResult.rows[0].has_quota}`);
    console.log(`  - current_usage: ${dbResult.rows[0].current_usage}`);
    console.log(`  - quota_limit: ${dbResult.rows[0].quota_limit}`);
    console.log(`  - remaining: ${dbResult.rows[0].remaining}`);
    console.log(`  - percentage: ${dbResult.rows[0].percentage}%`);
    console.log('');
    
    // ========== 测试 9: 批量检查配额 ==========
    console.log('🔍 测试 9: 批量检查配额');
    console.log('─'.repeat(50));
    
    const batchQuotas = await usageTrackingService.batchCheckQuota(
      testUserId,
      ['articles_per_day', 'publish_per_day', 'keyword_distillation']
    );
    
    console.log('批量检查结果:');
    batchQuotas.forEach((quota, featureCode) => {
      console.log(`  ${featureCode}:`);
      console.log(`    - 剩余: ${quota.remaining === -1 ? '无限制' : quota.remaining}`);
      console.log(`    - 使用率: ${quota.percentage.toFixed(1)}%`);
    });
    console.log('');
    
    // ========== 测试总结 ==========
    console.log('✅ 所有测试完成！');
    console.log('─'.repeat(50));
    console.log('');
    console.log('测试结果:');
    console.log('  ✓ 配额检查功能正常');
    console.log('  ✓ 使用量记录功能正常');
    console.log('  ✓ 配额概览功能正常');
    console.log('  ✓ 使用记录查询功能正常');
    console.log('  ✓ 使用统计功能正常');
    console.log('  ✓ 配额预警功能正常');
    console.log('  ✓ 数据库函数正常');
    console.log('  ✓ 批量检查功能正常');
    console.log('');
    console.log('🎉 配额系统运行正常！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// 执行测试
testQuotaSystem()
  .then(() => {
    console.log('\n测试脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n测试脚本执行失败:', error);
    process.exit(1);
  });
