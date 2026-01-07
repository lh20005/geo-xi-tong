/**
 * 配额系统全面测试脚本
 * 
 * 测试场景：
 * 1. 配额消耗测试 - 验证三种配额（文章生成、关键词蒸馏、发布）的消耗记录
 * 2. 删除不恢复测试 - 验证删除数据后配额不会被恢复
 * 3. 配额同步测试 - 验证 user_usage 和 usage_records 的一致性
 * 4. 配额检查测试 - 验证配额检查函数的正确性
 * 5. 配额限制测试 - 验证超出配额时的拒绝逻辑
 */

import { pool } from '../db/database';
import { usageTrackingService } from '../services/UsageTrackingService';
import { subscriptionService } from '../services/SubscriptionService';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  details?: any;
}

const testResults: TestResult[] = [];
let testUserId: number | null = null;
let testSubscriptionId: number | null = null;

function addResult(name: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, details?: any) {
  testResults.push({ name, status, message, details });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} ${name}: ${message}`);
  if (details && status === 'FAIL') {
    console.log(`   详情: ${JSON.stringify(details, null, 2)}`);
  }
}

async function setupTestUser(): Promise<boolean> {
  console.log('\n📋 设置测试环境...\n');
  
  try {
    // 创建测试用户
    const username = `quota_test_${Date.now()}`;
    // invitation_code 限制为 6 个字符
    const invitationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const userResult = await pool.query(
      `INSERT INTO users (username, password_hash, role, invitation_code) 
       VALUES ($1, 'test_hash', 'user', $2) 
       RETURNING id`,
      [username, invitationCode]
    );
    testUserId = userResult.rows[0].id;
    console.log(`   创建测试用户: ${username} (ID: ${testUserId})`);

    // 获取专业版套餐
    const planResult = await pool.query(
      `SELECT id FROM subscription_plans WHERE plan_code = 'professional' LIMIT 1`
    );
    
    if (planResult.rows.length === 0) {
      // 如果没有专业版，使用免费版
      const freePlanResult = await pool.query(
        `SELECT id FROM subscription_plans WHERE plan_code = 'free' LIMIT 1`
      );
      if (freePlanResult.rows.length === 0) {
        console.log('   ⚠️ 没有找到可用的套餐');
        return false;
      }
    }
    
    const planId = planResult.rows[0]?.id || 1;

    // 创建订阅
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);
    
    const subscriptionResult = await pool.query(
      `INSERT INTO user_subscriptions (user_id, plan_id, status, start_date, end_date)
       VALUES ($1, $2, 'active', $3, $4)
       RETURNING id`,
      [testUserId, planId, startDate, endDate]
    );
    testSubscriptionId = subscriptionResult.rows[0].id;
    console.log(`   创建测试订阅: ID ${testSubscriptionId}`);

    return true;
  } catch (error: any) {
    console.error('   设置测试环境失败:', error.message);
    return false;
  }
}

async function cleanupTestUser(): Promise<void> {
  console.log('\n🧹 清理测试环境...\n');
  
  if (testUserId) {
    try {
      // 删除测试数据（级联删除会处理关联数据）
      await pool.query('DELETE FROM usage_records WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM user_usage WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM articles WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM distillations WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM publishing_tasks WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM user_subscriptions WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
      console.log(`   已清理测试用户 ID: ${testUserId}`);
    } catch (error: any) {
      console.error('   清理失败:', error.message);
    }
  }
}

/**
 * 测试1: 配额消耗记录
 */
async function testQuotaConsumption(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('测试1: 配额消耗记录');
  console.log('='.repeat(80) + '\n');

  if (!testUserId) {
    addResult('配额消耗测试', 'SKIP', '测试用户未创建');
    return;
  }

  // 测试文章生成配额消耗
  try {
    const beforeQuota = await usageTrackingService.checkQuota(testUserId, 'articles_per_month');
    
    // 模拟记录配额使用
    await usageTrackingService.recordUsage(
      testUserId,
      'articles_per_month',
      'article',
      99999, // 模拟文章ID
      1,
      { title: '测试文章', test: true }
    );
    
    const afterQuota = await usageTrackingService.checkQuota(testUserId, 'articles_per_month');
    
    if (afterQuota.currentUsage === beforeQuota.currentUsage + 1) {
      addResult('文章生成配额消耗', 'PASS', 
        `配额正确增加: ${beforeQuota.currentUsage} -> ${afterQuota.currentUsage}`);
    } else {
      addResult('文章生成配额消耗', 'FAIL', 
        `配额未正确增加`, 
        { before: beforeQuota.currentUsage, after: afterQuota.currentUsage });
    }
  } catch (error: any) {
    addResult('文章生成配额消耗', 'FAIL', error.message);
  }

  // 测试关键词蒸馏配额消耗
  try {
    const beforeQuota = await usageTrackingService.checkQuota(testUserId, 'keyword_distillation');
    
    await usageTrackingService.recordUsage(
      testUserId,
      'keyword_distillation',
      'distillation',
      99999,
      1,
      { keyword: '测试关键词', test: true }
    );
    
    const afterQuota = await usageTrackingService.checkQuota(testUserId, 'keyword_distillation');
    
    if (afterQuota.currentUsage === beforeQuota.currentUsage + 1) {
      addResult('关键词蒸馏配额消耗', 'PASS', 
        `配额正确增加: ${beforeQuota.currentUsage} -> ${afterQuota.currentUsage}`);
    } else {
      addResult('关键词蒸馏配额消耗', 'FAIL', 
        `配额未正确增加`, 
        { before: beforeQuota.currentUsage, after: afterQuota.currentUsage });
    }
  } catch (error: any) {
    addResult('关键词蒸馏配额消耗', 'FAIL', error.message);
  }

  // 测试发布配额消耗
  try {
    const beforeQuota = await usageTrackingService.checkQuota(testUserId, 'publish_per_month');
    
    await usageTrackingService.recordUsage(
      testUserId,
      'publish_per_month',
      'publish',
      99999,
      1,
      { platform: '测试平台', test: true }
    );
    
    const afterQuota = await usageTrackingService.checkQuota(testUserId, 'publish_per_month');
    
    if (afterQuota.currentUsage === beforeQuota.currentUsage + 1) {
      addResult('发布配额消耗', 'PASS', 
        `配额正确增加: ${beforeQuota.currentUsage} -> ${afterQuota.currentUsage}`);
    } else {
      addResult('发布配额消耗', 'FAIL', 
        `配额未正确增加`, 
        { before: beforeQuota.currentUsage, after: afterQuota.currentUsage });
    }
  } catch (error: any) {
    addResult('发布配额消耗', 'FAIL', error.message);
  }
}

/**
 * 测试2: 删除数据不恢复配额
 */
async function testDeleteNoRestore(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('测试2: 删除数据不恢复配额');
  console.log('='.repeat(80) + '\n');

  if (!testUserId) {
    addResult('删除不恢复测试', 'SKIP', '测试用户未创建');
    return;
  }

  // 测试删除文章不恢复配额
  try {
    // 先创建一篇测试文章
    const articleResult = await pool.query(
      `INSERT INTO articles (title, keyword, content, provider, user_id)
       VALUES ('测试文章', '测试关键词', '测试内容', 'test', $1)
       RETURNING id`,
      [testUserId]
    );
    const articleId = articleResult.rows[0].id;
    
    // 记录配额使用
    await usageTrackingService.recordUsage(
      testUserId,
      'articles_per_month',
      'article',
      articleId,
      1
    );
    
    const beforeDelete = await usageTrackingService.checkQuota(testUserId, 'articles_per_month');
    
    // 删除文章
    await pool.query('DELETE FROM articles WHERE id = $1', [articleId]);
    
    const afterDelete = await usageTrackingService.checkQuota(testUserId, 'articles_per_month');
    
    if (afterDelete.currentUsage === beforeDelete.currentUsage) {
      addResult('删除文章不恢复配额', 'PASS', 
        `配额保持不变: ${afterDelete.currentUsage}`);
    } else {
      addResult('删除文章不恢复配额', 'FAIL', 
        `配额被错误恢复`, 
        { before: beforeDelete.currentUsage, after: afterDelete.currentUsage });
    }
  } catch (error: any) {
    addResult('删除文章不恢复配额', 'FAIL', error.message);
  }

  // 测试删除蒸馏记录不恢复配额
  try {
    // 先创建一条测试蒸馏记录 (provider 必须是 deepseek, gemini, ollama 之一)
    const distillationResult = await pool.query(
      `INSERT INTO distillations (keyword, provider, user_id)
       VALUES ('测试关键词', 'deepseek', $1)
       RETURNING id`,
      [testUserId]
    );
    const distillationId = distillationResult.rows[0].id;
    
    // 记录配额使用
    await usageTrackingService.recordUsage(
      testUserId,
      'keyword_distillation',
      'distillation',
      distillationId,
      1
    );
    
    const beforeDelete = await usageTrackingService.checkQuota(testUserId, 'keyword_distillation');
    
    // 删除蒸馏记录
    await pool.query('DELETE FROM distillations WHERE id = $1', [distillationId]);
    
    const afterDelete = await usageTrackingService.checkQuota(testUserId, 'keyword_distillation');
    
    if (afterDelete.currentUsage === beforeDelete.currentUsage) {
      addResult('删除蒸馏不恢复配额', 'PASS', 
        `配额保持不变: ${afterDelete.currentUsage}`);
    } else {
      addResult('删除蒸馏不恢复配额', 'FAIL', 
        `配额被错误恢复`, 
        { before: beforeDelete.currentUsage, after: afterDelete.currentUsage });
    }
  } catch (error: any) {
    addResult('删除蒸馏不恢复配额', 'FAIL', error.message);
  }
}

/**
 * 测试3: 配额数据一致性
 */
async function testQuotaConsistency(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('测试3: 配额数据一致性');
  console.log('='.repeat(80) + '\n');

  if (!testUserId) {
    addResult('配额一致性测试', 'SKIP', '测试用户未创建');
    return;
  }

  const featureCodes = ['articles_per_month', 'publish_per_month', 'keyword_distillation'];

  for (const featureCode of featureCodes) {
    try {
      // 获取 user_usage 中的使用量
      const usageResult = await pool.query(
        `SELECT COALESCE(usage_count, 0) as usage_count
         FROM user_usage
         WHERE user_id = $1 AND feature_code = $2
           AND period_start::date <= CURRENT_DATE
           AND period_end::date >= CURRENT_DATE
         ORDER BY period_start DESC
         LIMIT 1`,
        [testUserId, featureCode]
      );
      const userUsageCount = usageResult.rows[0]?.usage_count || 0;

      // 获取 usage_records 中的总和
      const recordsResult = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM usage_records
         WHERE user_id = $1 AND feature_code = $2
           AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
        [testUserId, featureCode]
      );
      const recordsTotal = parseInt(recordsResult.rows[0]?.total || '0');

      if (userUsageCount === recordsTotal) {
        addResult(`${featureCode} 数据一致性`, 'PASS', 
          `user_usage (${userUsageCount}) = usage_records (${recordsTotal})`);
      } else {
        addResult(`${featureCode} 数据一致性`, 'FAIL', 
          `数据不一致`, 
          { userUsageCount, recordsTotal });
      }
    } catch (error: any) {
      addResult(`${featureCode} 数据一致性`, 'FAIL', error.message);
    }
  }
}

/**
 * 测试4: 配额检查函数
 */
async function testQuotaCheck(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('测试4: 配额检查函数');
  console.log('='.repeat(80) + '\n');

  if (!testUserId) {
    addResult('配额检查测试', 'SKIP', '测试用户未创建');
    return;
  }

  // 测试 checkQuota 函数
  try {
    const quota = await usageTrackingService.checkQuota(testUserId, 'articles_per_month');
    
    if (typeof quota.hasQuota === 'boolean' &&
        typeof quota.currentUsage === 'number' &&
        typeof quota.quotaLimit === 'number' &&
        typeof quota.remaining === 'number' &&
        typeof quota.percentage === 'number') {
      addResult('checkQuota 返回格式', 'PASS', 
        `返回格式正确: hasQuota=${quota.hasQuota}, usage=${quota.currentUsage}/${quota.quotaLimit}`);
    } else {
      addResult('checkQuota 返回格式', 'FAIL', 
        '返回格式不正确', quota);
    }
  } catch (error: any) {
    addResult('checkQuota 返回格式', 'FAIL', error.message);
  }

  // 测试数据库函数 check_user_quota
  try {
    const result = await pool.query(
      `SELECT * FROM check_user_quota($1, $2)`,
      [testUserId, 'articles_per_month']
    );
    
    if (result.rows.length > 0) {
      const row = result.rows[0];
      if ('has_quota' in row && 'current_usage' in row && 'quota_limit' in row) {
        addResult('check_user_quota 数据库函数', 'PASS', 
          `函数正常工作: has_quota=${row.has_quota}, usage=${row.current_usage}/${row.quota_limit}`);
      } else {
        addResult('check_user_quota 数据库函数', 'FAIL', 
          '返回字段不完整', row);
      }
    } else {
      addResult('check_user_quota 数据库函数', 'FAIL', '没有返回结果');
    }
  } catch (error: any) {
    addResult('check_user_quota 数据库函数', 'FAIL', error.message);
  }
}

/**
 * 测试5: 配额限制
 */
async function testQuotaLimit(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('测试5: 配额限制');
  console.log('='.repeat(80) + '\n');

  if (!testUserId) {
    addResult('配额限制测试', 'SKIP', '测试用户未创建');
    return;
  }

  // 测试 canUserPerformAction
  try {
    const canPerform = await subscriptionService.canUserPerformAction(testUserId, 'articles_per_month');
    
    if (typeof canPerform === 'boolean') {
      addResult('canUserPerformAction', 'PASS', 
        `函数正常工作: canPerform=${canPerform}`);
    } else {
      addResult('canUserPerformAction', 'FAIL', 
        '返回类型不正确', { canPerform });
    }
  } catch (error: any) {
    addResult('canUserPerformAction', 'FAIL', error.message);
  }

  // 测试配额耗尽场景
  try {
    // 获取当前配额
    const quota = await usageTrackingService.checkQuota(testUserId, 'articles_per_month');
    
    if (quota.quotaLimit > 0 && quota.quotaLimit !== -1) {
      // 模拟消耗所有配额
      const remaining = quota.remaining;
      if (remaining > 0) {
        // 记录足够的使用量使配额耗尽
        await usageTrackingService.recordUsage(
          testUserId,
          'articles_per_month',
          'article',
          99998,
          remaining
        );
      }
      
      const afterQuota = await usageTrackingService.checkQuota(testUserId, 'articles_per_month');
      
      if (!afterQuota.hasQuota || afterQuota.remaining <= 0) {
        addResult('配额耗尽检测', 'PASS', 
          `配额耗尽后正确返回: hasQuota=${afterQuota.hasQuota}, remaining=${afterQuota.remaining}`);
      } else {
        addResult('配额耗尽检测', 'FAIL', 
          '配额耗尽后仍显示有配额', afterQuota);
      }
    } else {
      addResult('配额耗尽检测', 'SKIP', 
        `配额为无限制或为0: limit=${quota.quotaLimit}`);
    }
  } catch (error: any) {
    addResult('配额耗尽检测', 'FAIL', error.message);
  }
}

/**
 * 测试6: 使用统计 API
 */
async function testUsageStatsAPI(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('测试6: 使用统计 API');
  console.log('='.repeat(80) + '\n');

  if (!testUserId) {
    addResult('使用统计 API 测试', 'SKIP', '测试用户未创建');
    return;
  }

  // 测试 getUserUsageStats
  try {
    const stats = await subscriptionService.getUserUsageStats(testUserId);
    
    if (Array.isArray(stats)) {
      const hasRequiredFields = stats.every(stat => 
        'feature_code' in stat &&
        'feature_name' in stat &&
        'used' in stat &&
        'limit' in stat &&
        'percentage' in stat
      );
      
      if (hasRequiredFields || stats.length === 0) {
        addResult('getUserUsageStats', 'PASS', 
          `返回 ${stats.length} 项使用统计`);
        
        // 打印详细统计
        for (const stat of stats) {
          console.log(`   - ${stat.feature_name}: ${stat.used}/${stat.limit} (${stat.percentage.toFixed(1)}%)`);
        }
      } else {
        addResult('getUserUsageStats', 'FAIL', 
          '返回字段不完整', stats[0]);
      }
    } else {
      addResult('getUserUsageStats', 'FAIL', 
        '返回类型不是数组', { type: typeof stats });
    }
  } catch (error: any) {
    addResult('getUserUsageStats', 'FAIL', error.message);
  }

  // 测试 getUserQuotaOverview
  try {
    const overview = await usageTrackingService.getUserQuotaOverview(testUserId);
    
    if (Array.isArray(overview)) {
      addResult('getUserQuotaOverview', 'PASS', 
        `返回 ${overview.length} 项配额概览`);
    } else {
      addResult('getUserQuotaOverview', 'FAIL', 
        '返回类型不是数组', { type: typeof overview });
    }
  } catch (error: any) {
    addResult('getUserQuotaOverview', 'FAIL', error.message);
  }
}

/**
 * 测试7: 批量配额消耗
 */
async function testBatchQuotaConsumption(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('测试7: 批量配额消耗');
  console.log('='.repeat(80) + '\n');

  if (!testUserId) {
    addResult('批量配额消耗测试', 'SKIP', '测试用户未创建');
    return;
  }

  try {
    const beforeQuota = await usageTrackingService.checkQuota(testUserId, 'articles_per_month');
    
    // 批量记录配额使用（模拟批量生成文章）
    const batchSize = 5;
    await usageTrackingService.recordUsage(
      testUserId,
      'articles_per_month',
      'article',
      99997,
      batchSize,
      { batch: true, count: batchSize }
    );
    
    const afterQuota = await usageTrackingService.checkQuota(testUserId, 'articles_per_month');
    
    if (afterQuota.currentUsage === beforeQuota.currentUsage + batchSize) {
      addResult('批量配额消耗', 'PASS', 
        `批量消耗正确: ${beforeQuota.currentUsage} + ${batchSize} = ${afterQuota.currentUsage}`);
    } else {
      addResult('批量配额消耗', 'FAIL', 
        `批量消耗不正确`, 
        { before: beforeQuota.currentUsage, expected: beforeQuota.currentUsage + batchSize, actual: afterQuota.currentUsage });
    }
  } catch (error: any) {
    addResult('批量配额消耗', 'FAIL', error.message);
  }
}

/**
 * 主测试函数
 */
async function runAllTests(): Promise<void> {
  console.log('='.repeat(80));
  console.log('配额系统全面测试');
  console.log('='.repeat(80));
  console.log(`开始时间: ${new Date().toLocaleString('zh-CN')}`);

  try {
    // 设置测试环境
    const setupSuccess = await setupTestUser();
    
    if (setupSuccess) {
      // 运行所有测试
      await testQuotaConsumption();
      await testDeleteNoRestore();
      await testQuotaConsistency();
      await testQuotaCheck();
      await testQuotaLimit();
      await testUsageStatsAPI();
      await testBatchQuotaConsumption();
    } else {
      console.log('\n⚠️ 测试环境设置失败，跳过所有测试');
    }

    // 清理测试环境
    await cleanupTestUser();

    // 输出测试结果总结
    console.log('\n' + '='.repeat(80));
    console.log('测试结果总结');
    console.log('='.repeat(80));
    
    const passCount = testResults.filter(r => r.status === 'PASS').length;
    const failCount = testResults.filter(r => r.status === 'FAIL').length;
    const skipCount = testResults.filter(r => r.status === 'SKIP').length;
    
    console.log(`\n✅ 通过: ${passCount}`);
    console.log(`❌ 失败: ${failCount}`);
    console.log(`⏭️ 跳过: ${skipCount}`);
    console.log(`📊 总计: ${testResults.length}`);
    
    if (failCount === 0) {
      console.log('\n🎉 所有测试通过！配额系统工作正常。');
    } else {
      console.log('\n⚠️ 存在失败的测试，请检查上述详情。');
      
      console.log('\n失败的测试:');
      testResults.filter(r => r.status === 'FAIL').forEach(r => {
        console.log(`   - ${r.name}: ${r.message}`);
      });
    }

    console.log(`\n结束时间: ${new Date().toLocaleString('zh-CN')}`);

  } catch (error: any) {
    console.error('\n测试过程中发生错误:', error);
  } finally {
    await pool.end();
  }
}

// 运行测试
runAllTests();
