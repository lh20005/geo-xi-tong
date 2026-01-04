import { pool } from '../db/database';
import { usageTrackingService } from '../services/UsageTrackingService';

/**
 * 自动化测试所有配额功能
 */

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function addResult(test: string, status: 'PASS' | 'FAIL', message: string, details?: any) {
  results.push({ test, status, message, details });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} ${test}: ${message}`);
  if (details) {
    console.log('   详情:', JSON.stringify(details, null, 2));
  }
}

async function testAllQuotaFunctions() {
  console.log('=== 配额系统自动化测试 ===\n');
  console.log('开始时间:', new Date().toISOString(), '\n');

  try {
    // 获取测试用户
    const username = process.argv[2] || 'lzc2005';
    console.log(`测试用户: ${username}\n`);

    const userResult = await pool.query(
      'SELECT id, username FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      console.log('❌ 用户不存在');
      return;
    }

    const userId = userResult.rows[0].id;
    console.log(`用户ID: ${userId}\n`);

    // 测试 1: 检查配额函数
    await testCheckQuotaFunction(userId);

    // 测试 2: 记录配额使用
    await testRecordUsageFunction(userId);

    // 测试 3: 配额检查逻辑
    await testQuotaCheckLogic(userId);

    // 测试 4: 配额重置逻辑
    await testQuotaResetLogic(userId);

    // 测试 5: 配额数据一致性
    await testQuotaDataConsistency(userId);

    // 生成报告
    generateReport();

  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await pool.end();
  }
}

/**
 * 测试 1: 检查配额函数
 */
async function testCheckQuotaFunction(userId: number) {
  console.log('\n📋 测试 1: 检查配额函数\n');

  const features = [
    'articles_per_month',
    'publish_per_month',
    'keyword_distillation',
    'platform_accounts'
  ];

  for (const featureCode of features) {
    try {
      const quota = await usageTrackingService.checkQuota(userId, featureCode as any);
      
      if (quota && typeof quota.hasQuota === 'boolean') {
        addResult(
          `checkQuota(${featureCode})`,
          'PASS',
          '函数返回正确',
          {
            hasQuota: quota.hasQuota,
            quotaLimit: quota.quotaLimit,
            currentUsage: quota.currentUsage,
            remaining: quota.remaining
          }
        );
      } else {
        addResult(
          `checkQuota(${featureCode})`,
          'FAIL',
          '函数返回格式错误',
          quota
        );
      }
    } catch (error: any) {
      addResult(
        `checkQuota(${featureCode})`,
        'FAIL',
        error.message
      );
    }
  }
}

/**
 * 测试 2: 记录配额使用
 */
async function testRecordUsageFunction(userId: number) {
  console.log('\n📋 测试 2: 记录配额使用\n');

  const testFeature = 'articles_per_month';

  try {
    // 获取当前使用量
    const beforeQuota = await usageTrackingService.checkQuota(userId, testFeature as any);
    const beforeUsage = beforeQuota.currentUsage;

    // 记录使用
    await usageTrackingService.recordUsage(
      userId,
      testFeature as any,
      'test',
      999999,
      1
    );

    // 获取更新后的使用量
    const afterQuota = await usageTrackingService.checkQuota(userId, testFeature as any);
    const afterUsage = afterQuota.currentUsage;

    if (afterUsage === beforeUsage + 1) {
      addResult(
        'recordUsage',
        'PASS',
        '配额记录成功',
        {
          before: beforeUsage,
          after: afterUsage,
          diff: afterUsage - beforeUsage
        }
      );

      // 回滚测试数据
      await usageTrackingService.recordUsage(
        userId,
        testFeature as any,
        'test',
        999999,
        -1
      );
    } else {
      addResult(
        'recordUsage',
        'FAIL',
        '配额记录失败',
        {
          before: beforeUsage,
          after: afterUsage,
          expected: beforeUsage + 1
        }
      );
    }
  } catch (error: any) {
    addResult('recordUsage', 'FAIL', error.message);
  }
}

/**
 * 测试 3: 配额检查逻辑
 */
async function testQuotaCheckLogic(userId: number) {
  console.log('\n📋 测试 3: 配额检查逻辑\n');

  try {
    // 测试有配额的情况
    const quota = await usageTrackingService.checkQuota(userId, 'articles_per_month' as any);
    
    if (quota.hasQuota && quota.remaining > 0) {
      addResult(
        '配额检查 - 有配额',
        'PASS',
        '正确识别有配额',
        { remaining: quota.remaining }
      );
    } else if (!quota.hasQuota && quota.remaining === 0) {
      addResult(
        '配额检查 - 无配额',
        'PASS',
        '正确识别无配额',
        { remaining: quota.remaining }
      );
    } else {
      addResult(
        '配额检查逻辑',
        'FAIL',
        '配额检查逻辑不一致',
        quota
      );
    }

    // 测试配额计算
    const expectedRemaining = quota.quotaLimit - quota.currentUsage;
    if (quota.remaining === expectedRemaining) {
      addResult(
        '配额计算',
        'PASS',
        '剩余配额计算正确',
        {
          quotaLimit: quota.quotaLimit,
          currentUsage: quota.currentUsage,
          remaining: quota.remaining,
          expected: expectedRemaining
        }
      );
    } else {
      addResult(
        '配额计算',
        'FAIL',
        '剩余配额计算错误',
        {
          remaining: quota.remaining,
          expected: expectedRemaining
        }
      );
    }
  } catch (error: any) {
    addResult('配额检查逻辑', 'FAIL', error.message);
  }
}

/**
 * 测试 4: 配额重置逻辑
 */
async function testQuotaResetLogic(userId: number) {
  console.log('\n📋 测试 4: 配额重置逻辑\n');

  try {
    // 检查配额周期
    const usageResult = await pool.query(
      `SELECT 
        feature_code,
        period_start,
        period_end,
        (period_end - period_start) as period_interval
      FROM user_usage
      WHERE user_id = $1 
        AND feature_code IN ('articles_per_month', 'publish_per_month', 'keyword_distillation')`,
      [userId]
    );

    let allCorrect = true;
    for (const row of usageResult.rows) {
      const periodStart = new Date(row.period_start);
      const periodEnd = new Date(row.period_end);
      const periodDays = Math.round((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
      
      // 月度配额应该是 28-31 天
      if (periodDays >= 28 && periodDays <= 31) {
        addResult(
          `配额周期 - ${row.feature_code}`,
          'PASS',
          '周期正确（月度）',
          {
            periodStart: row.period_start,
            periodEnd: row.period_end,
            days: periodDays
          }
        );
      } else {
        addResult(
          `配额周期 - ${row.feature_code}`,
          'FAIL',
          '周期错误',
          {
            periodStart: row.period_start,
            periodEnd: row.period_end,
            days: periodDays,
            expected: '28-31 天'
          }
        );
        allCorrect = false;
      }
    }

    if (allCorrect && usageResult.rows.length > 0) {
      addResult(
        '配额重置逻辑',
        'PASS',
        '所有配额周期正确'
      );
    }
  } catch (error: any) {
    addResult('配额重置逻辑', 'FAIL', error.message);
  }
}

/**
 * 测试 5: 配额数据一致性
 */
async function testQuotaDataConsistency(userId: number) {
  console.log('\n📋 测试 5: 配额数据一致性\n');

  try {
    // 检查 user_usage 和 usage_records 的一致性
    const consistencyResult = await pool.query(`
      SELECT 
        uu.feature_code,
        uu.usage_count as recorded_count,
        COALESCE(SUM(ur.amount), 0) as actual_count,
        uu.usage_count = COALESCE(SUM(ur.amount), 0) as is_consistent
      FROM user_usage uu
      LEFT JOIN usage_records ur ON ur.user_id = uu.user_id 
        AND ur.feature_code = uu.feature_code
        AND ur.created_at >= uu.period_start
        AND ur.created_at < uu.period_end
      WHERE uu.user_id = $1 
        AND uu.feature_code IN ('articles_per_month', 'publish_per_month', 'keyword_distillation')
        AND uu.period_end > CURRENT_TIMESTAMP
      GROUP BY uu.feature_code, uu.usage_count
    `, [userId]);

    let allConsistent = true;
    for (const row of consistencyResult.rows) {
      if (row.is_consistent) {
        addResult(
          `数据一致性 - ${row.feature_code}`,
          'PASS',
          '使用量一致',
          {
            recorded: row.recorded_count,
            actual: row.actual_count
          }
        );
      } else {
        addResult(
          `数据一致性 - ${row.feature_code}`,
          'FAIL',
          '使用量不一致',
          {
            recorded: row.recorded_count,
            actual: row.actual_count
          }
        );
        allConsistent = false;
      }
    }

    if (allConsistent && consistencyResult.rows.length > 0) {
      addResult(
        '配额数据一致性',
        'PASS',
        '所有数据一致'
      );
    }
  } catch (error: any) {
    addResult('配额数据一致性', 'FAIL', error.message);
  }
}

/**
 * 生成测试报告
 */
function generateReport() {
  console.log('\n\n=== 测试报告 ===\n');

  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;

  console.log(`总计: ${total} 项测试`);
  console.log(`✅ 通过: ${passCount}`);
  console.log(`❌ 失败: ${failCount}`);
  console.log(`通过率: ${((passCount / total) * 100).toFixed(1)}%\n`);

  if (failCount > 0) {
    console.log('失败的测试:');
    results.filter(r => r.status === 'FAIL').forEach((result, index) => {
      console.log(`${index + 1}. ${result.test}: ${result.message}`);
    });
    console.log('');
  }

  // 总结
  if (failCount === 0) {
    console.log('🎉 所有测试通过！配额系统运行正常。');
  } else {
    console.log('⚠️  部分测试失败，请检查配额系统。');
  }

  // 保存报告
  const fs = require('fs');
  const path = require('path');
  const reportPath = path.join(__dirname, '../../..', '配额系统测试报告.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: { total, pass: passCount, fail: failCount },
    results
  }, null, 2));
  
  console.log(`\n📄 详细报告已保存到: 配额系统测试报告.json`);
}

testAllQuotaFunctions();
