/**
 * 快速诊断配额问题
 */

import { pool } from '../db/database';
import { usageTrackingService } from '../services/UsageTrackingService';
import { storageQuotaService } from '../services/StorageQuotaService';

async function quickDiagnose() {
  console.log('=== 快速诊断配额问题 ===\n');

  try {
    // 测试用户
    const testUserId = 437; // testuser
    console.log(`测试用户 ID: ${testUserId}\n`);

    // 1. 检查订阅
    console.log('1. 检查订阅状态:');
    const subResult = await pool.query(
      `SELECT 
        us.id,
        us.plan_id,
        us.status,
        us.end_date,
        us.end_date > CURRENT_TIMESTAMP as is_active
      FROM user_subscriptions us
      WHERE us.user_id = $1
      ORDER BY us.end_date DESC
      LIMIT 1`,
      [testUserId]
    );

    if (subResult.rows.length === 0) {
      console.log('  ❌ 没有订阅\n');
    } else {
      const sub = subResult.rows[0];
      console.log(`  套餐ID: ${sub.plan_id}`);
      console.log(`  状态: ${sub.status}`);
      console.log(`  激活: ${sub.is_active ? '✅' : '❌'}\n`);
    }

    // 2. 测试文章生成配额
    console.log('2. 测试文章生成配额:');
    try {
      const quota = await usageTrackingService.checkQuota(testUserId, 'articles_per_month');
      console.log(`  有配额: ${quota.hasQuota ? '✅' : '❌'}`);
      console.log(`  当前使用: ${quota.currentUsage}`);
      console.log(`  配额限制: ${quota.quotaLimit}`);
      console.log(`  剩余: ${quota.remaining}`);
      
      if (!quota.hasQuota || quota.remaining <= 0) {
        console.log(`  ⚠️  配额不足，无法生成文章\n`);
      } else {
        console.log(`  ✅ 可以生成文章\n`);
      }
    } catch (error: any) {
      console.log(`  ❌ 检查失败: ${error.message}\n`);
    }

    // 3. 测试存储配额
    console.log('3. 测试存储配额 (上传 1MB):');
    try {
      const testSize = 1024 * 1024; // 1MB
      const check = await storageQuotaService.checkQuota(testUserId, testSize);
      console.log(`  允许上传: ${check.allowed ? '✅' : '❌'}`);
      console.log(`  当前使用: ${formatBytes(check.currentUsageBytes)}`);
      console.log(`  配额: ${formatBytes(check.quotaBytes)}`);
      console.log(`  可用: ${formatBytes(check.availableBytes)}`);
      
      if (!check.allowed) {
        console.log(`  ⚠️  ${check.reason}\n`);
      } else {
        console.log(`  ✅ 可以上传\n`);
      }
    } catch (error: any) {
      console.log(`  ❌ 检查失败: ${error.message}\n`);
    }

    // 4. 检查数据库函数
    console.log('4. 测试数据库配额函数:');
    try {
      const dbResult = await pool.query(
        `SELECT * FROM check_user_quota($1, $2)`,
        [testUserId, 'articles_per_month']
      );
      
      if (dbResult.rows.length > 0) {
        const row = dbResult.rows[0];
        console.log(`  has_quota: ${row.has_quota}`);
        console.log(`  current_usage: ${row.current_usage}`);
        console.log(`  quota_limit: ${row.quota_limit}`);
        console.log(`  remaining: ${row.remaining}\n`);
      } else {
        console.log(`  ❌ 函数没有返回结果\n`);
      }
    } catch (error: any) {
      console.log(`  ❌ 函数调用失败: ${error.message}\n`);
    }

    // 5. 检查 user_usage 表
    console.log('5. 检查 user_usage 表:');
    const usageResult = await pool.query(
      `SELECT 
        feature_code,
        usage_count,
        period_end > CURRENT_TIMESTAMP as is_valid
      FROM user_usage
      WHERE user_id = $1`,
      [testUserId]
    );

    if (usageResult.rows.length === 0) {
      console.log('  ⚠️  没有使用记录\n');
    } else {
      usageResult.rows.forEach(row => {
        console.log(`  ${row.feature_code}: ${row.usage_count} (${row.is_valid ? '有效' : '已过期'})`);
      });
      console.log();
    }

    // 6. 检查 plan_features
    console.log('6. 检查套餐功能配额:');
    const featuresResult = await pool.query(
      `SELECT 
        pf.feature_code,
        pf.feature_value
      FROM user_subscriptions us
      JOIN plan_features pf ON us.plan_id = pf.plan_id
      WHERE us.user_id = $1 
        AND us.status = 'active'
        AND us.end_date > CURRENT_TIMESTAMP`,
      [testUserId]
    );

    if (featuresResult.rows.length === 0) {
      console.log('  ❌ 没有功能配额配置\n');
    } else {
      featuresResult.rows.forEach(row => {
        const value = row.feature_value === -1 ? '无限' : row.feature_value;
        console.log(`  ${row.feature_code}: ${value}`);
      });
      console.log();
    }

    console.log('✅ 诊断完成');

  } catch (error) {
    console.error('❌ 诊断失败:', error);
  } finally {
    await pool.end();
    process.exit(0);
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

quickDiagnose();
