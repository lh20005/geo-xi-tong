/**
 * 全面诊断配额系统问题
 * 检查所有配额类型（存储、文章生成、发布等）的检查和记录流程
 */

import { pool } from '../db/database';
import { usageTrackingService } from '../services/UsageTrackingService';
import { storageQuotaService } from '../services/StorageQuotaService';
import { storageService } from '../services/StorageService';

async function diagnoseAllQuotaIssues() {
  console.log('=== 全面诊断配额系统 ===\n');

  try {
    // 选择一个测试用户
    const testUserResult = await pool.query(
      `SELECT id, username FROM users WHERE username IN ('testuser', 'testuser2', 'lzc2005') ORDER BY id LIMIT 1`
    );

    if (testUserResult.rows.length === 0) {
      console.log('❌ 没有找到测试用户');
      return;
    }

    const testUser = testUserResult.rows[0];
    console.log(`测试用户: ${testUser.username} (ID: ${testUser.id})\n`);

    // ========== 1. 检查用户订阅状态 ==========
    console.log('1️⃣  检查用户订阅状态');
    console.log('─'.repeat(60));
    
    const subscriptionResult = await pool.query(
      `SELECT 
        us.id,
        us.plan_id,
        p.name as plan_name,
        p.code as plan_code,
        us.status,
        us.start_date,
        us.end_date,
        us.end_date > CURRENT_TIMESTAMP as is_active
      FROM user_subscriptions us
      JOIN subscription_plans p ON us.plan_id = p.id
      WHERE us.user_id = $1
      ORDER BY us.end_date DESC
      LIMIT 1`,
      [testUser.id]
    );

    if (subscriptionResult.rows.length === 0) {
      console.log('❌ 用户没有订阅记录\n');
    } else {
      const sub = subscriptionResult.rows[0];
      console.log(`套餐: ${sub.plan_name} (${sub.plan_code})`);
      console.log(`状态: ${sub.status}`);
      console.log(`有效期: ${sub.start_date} 至 ${sub.end_date}`);
      console.log(`是否激活: ${sub.is_active ? '✅' : '❌'}\n`);
    }

    // ========== 2. 检查套餐功能配额 ==========
    console.log('2️⃣  检查套餐功能配额');
    console.log('─'.repeat(60));
    
    const planFeaturesResult = await pool.query(
      `SELECT 
        pf.feature_code,
        pf.feature_value,
        pf.feature_unit
      FROM user_subscriptions us
      JOIN plan_features pf ON us.plan_id = pf.plan_id
      WHERE us.user_id = $1 
        AND us.status = 'active'
        AND us.end_date > CURRENT_TIMESTAMP
      ORDER BY pf.feature_code`,
      [testUser.id]
    );

    if (planFeaturesResult.rows.length === 0) {
      console.log('❌ 没有找到套餐功能配额\n');
    } else {
      for (const feature of planFeaturesResult.rows) {
        const value = feature.feature_value === -1 ? '无限' : feature.feature_value;
        console.log(`  ${feature.feature_code}: ${value} ${feature.feature_unit || ''}`);
      }
      console.log();
    }

    // ========== 3. 检查功能配额使用情况 ==========
    console.log('3️⃣  检查功能配额使用情况');
    console.log('─'.repeat(60));
    
    const featureCodes = ['articles_per_month', 'publish_per_month', 'keyword_distillation', 'platform_accounts'];
    
    for (const featureCode of featureCodes) {
      try {
        const quota = await usageTrackingService.checkQuota(testUser.id, featureCode as any);
        console.log(`\n${featureCode}:`);
        console.log(`  有配额: ${quota.hasQuota ? '✅' : '❌'}`);
        console.log(`  当前使用: ${quota.currentUsage}`);
        console.log(`  配额限制: ${quota.quotaLimit === -1 ? '无限' : quota.quotaLimit}`);
        console.log(`  剩余: ${quota.remaining === -1 ? '无限' : quota.remaining}`);
        console.log(`  使用率: ${quota.percentage}%`);
      } catch (error: any) {
        console.log(`\n${featureCode}: ❌ 检查失败 - ${error.message}`);
      }
    }
    console.log();

    // ========== 4. 检查存储配额 ==========
    console.log('4️⃣  检查存储配额');
    console.log('─'.repeat(60));
    
    try {
      const storageUsage = await storageService.getUserStorageUsage(testUser.id, true);
      console.log(`总使用: ${formatBytes(storageUsage.totalStorageBytes)}`);
      console.log(`  - 图片: ${formatBytes(storageUsage.imageStorageBytes)} (${storageUsage.imageCount} 个)`);
      console.log(`  - 文档: ${formatBytes(storageUsage.documentStorageBytes)} (${storageUsage.documentCount} 个)`);
      console.log(`  - 文章: ${formatBytes(storageUsage.articleStorageBytes)} (${storageUsage.articleCount} 个)`);
      console.log(`配额: ${formatBytes(storageUsage.storageQuotaBytes)}`);
      console.log(`购买: ${formatBytes(storageUsage.purchasedStorageBytes)}`);
      console.log(`可用: ${formatBytes(storageUsage.availableBytes)}`);
      console.log(`使用率: ${storageUsage.usagePercentage}%\n`);
    } catch (error: any) {
      console.log(`❌ 检查失败 - ${error.message}\n`);
    }

    // ========== 5. 测试配额检查函数 ==========
    console.log('5️⃣  测试配额检查函数');
    console.log('─'.repeat(60));
    
    // 测试文章生成配额
    console.log('\n测试文章生成配额 (1篇):');
    try {
      const articleQuota = await usageTrackingService.checkQuota(testUser.id, 'articles_per_month');
      if (articleQuota.hasQuota && articleQuota.remaining > 0) {
        console.log('  ✅ 允许生成');
      } else {
        console.log('  ❌ 配额不足');
        console.log(`  原因: 当前使用 ${articleQuota.currentUsage}/${articleQuota.quotaLimit}`);
      }
    } catch (error: any) {
      console.log(`  ❌ 检查失败 - ${error.message}`);
    }

    // 测试存储配额
    console.log('\n测试存储配额 (上传 1MB 文件):');
    try {
      const testFileSize = 1024 * 1024; // 1MB
      const storageCheck = await storageQuotaService.checkQuota(testUser.id, testFileSize);
      if (storageCheck.allowed) {
        console.log('  ✅ 允许上传');
      } else {
        console.log('  ❌ 空间不足');
        console.log(`  原因: ${storageCheck.reason}`);
      }
    } catch (error: any) {
      console.log(`  ❌ 检查失败 - ${error.message}`);
    }

    // ========== 6. 检查 user_usage 表 ==========
    console.log('\n6️⃣  检查 user_usage 表');
    console.log('─'.repeat(60));
    
    const userUsageResult = await pool.query(
      `SELECT 
        feature_code,
        usage_count,
        period_start,
        period_end,
        period_end > CURRENT_TIMESTAMP as is_valid,
        last_reset_at
      FROM user_usage
      WHERE user_id = $1
      ORDER BY feature_code`,
      [testUser.id]
    );

    if (userUsageResult.rows.length === 0) {
      console.log('⚠️  没有使用记录\n');
    } else {
      for (const usage of userUsageResult.rows) {
        console.log(`\n${usage.feature_code}:`);
        console.log(`  使用量: ${usage.usage_count}`);
        console.log(`  周期: ${usage.period_start} 至 ${usage.period_end}`);
        console.log(`  有效: ${usage.is_valid ? '✅' : '❌ (已过期)'}`);
        console.log(`  上次重置: ${usage.last_reset_at}`);
      }
      console.log();
    }

    // ========== 7. 检查最近的使用记录 ==========
    console.log('7️⃣  检查最近的使用记录');
    console.log('─'.repeat(60));
    
    const recentUsageResult = await pool.query(
      `SELECT 
        feature_code,
        resource_type,
        resource_id,
        amount,
        created_at
      FROM usage_records
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 10`,
      [testUser.id]
    );

    if (recentUsageResult.rows.length === 0) {
      console.log('⚠️  没有使用记录\n');
    } else {
      for (const record of recentUsageResult.rows) {
        console.log(`\n${record.created_at}:`);
        console.log(`  功能: ${record.feature_code}`);
        console.log(`  资源: ${record.resource_type || 'N/A'} #${record.resource_id || 'N/A'}`);
        console.log(`  数量: ${record.amount}`);
      }
      console.log();
    }

    // ========== 8. 检查配额检查函数的原始输出 ==========
    console.log('8️⃣  检查配额检查函数的原始输出');
    console.log('─'.repeat(60));
    
    const rawCheckResult = await pool.query(
      `SELECT * FROM check_user_quota($1, $2)`,
      [testUser.id, 'articles_per_month']
    );

    if (rawCheckResult.rows.length > 0) {
      const row = rawCheckResult.rows[0];
      console.log('\narticles_per_month (原始数据库输出):');
      console.log(`  has_quota: ${row.has_quota} (类型: ${typeof row.has_quota})`);
      console.log(`  current_usage: ${row.current_usage} (类型: ${typeof row.current_usage})`);
      console.log(`  quota_limit: ${row.quota_limit} (类型: ${typeof row.quota_limit})`);
      console.log(`  remaining: ${row.remaining} (类型: ${typeof row.remaining})`);
      console.log(`  percentage: ${row.percentage} (类型: ${typeof row.percentage})`);
    }

    // ========== 9. 诊断潜在问题 ==========
    console.log('\n9️⃣  诊断潜在问题');
    console.log('─'.repeat(60));
    
    const issues: string[] = [];

    // 检查是否有过期的 user_usage 记录
    const expiredUsageResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM user_usage
       WHERE user_id = $1 AND period_end < CURRENT_TIMESTAMP`,
      [testUser.id]
    );
    
    if (parseInt(expiredUsageResult.rows[0].count) > 0) {
      issues.push(`⚠️  有 ${expiredUsageResult.rows[0].count} 条过期的使用记录`);
    }

    // 检查是否有订阅但没有配额记录
    if (subscriptionResult.rows.length > 0 && planFeaturesResult.rows.length === 0) {
      issues.push('❌ 有订阅但没有功能配额记录');
    }

    // 检查存储使用是否一致
    const storageConsistencyResult = await pool.query(
      `SELECT 
        user_id,
        image_storage_bytes + document_storage_bytes + article_storage_bytes as calculated,
        total_storage_bytes as stored
      FROM user_storage_usage
      WHERE user_id = $1
        AND (image_storage_bytes + document_storage_bytes + article_storage_bytes) != total_storage_bytes`,
      [testUser.id]
    );

    if (storageConsistencyResult.rows.length > 0) {
      issues.push('❌ 存储使用量不一致');
    }

    if (issues.length === 0) {
      console.log('\n✅ 没有发现明显问题\n');
    } else {
      console.log('\n发现以下问题:\n');
      issues.forEach(issue => console.log(`  ${issue}`));
      console.log();
    }

  } catch (error) {
    console.error('诊断失败:', error);
  } finally {
    await pool.end();
  }
}

function formatBytes(bytes: number): string {
  if (bytes === -1) return '无限';
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

diagnoseAllQuotaIssues();
