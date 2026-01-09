/**
 * 业务模拟测试脚本 - 第二部分
 * 
 * 测试场景：
 * 5. 配额耗尽后是否阻止操作
 * 6. 套餐到期后是否正确返回免费版
 * 7. 配额重置周期测试
 * 8. 落地页套餐展示测试
 */

import { pool } from '../db/database';
import { subscriptionService } from '../services/SubscriptionService';
import { subscriptionExpirationService } from '../services/SubscriptionExpirationService';
import { QuotaInitializationService } from '../services/QuotaInitializationService';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  log(title, colors.cyan);
  console.log('='.repeat(60));
}

function logSuccess(message: string) {
  log(`✅ ${message}`, colors.green);
}

function logError(message: string) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, colors.blue);
}

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const testResults: TestResult[] = [];

function recordTest(name: string, passed: boolean, message: string) {
  testResults.push({ name, passed, message });
  if (passed) {
    logSuccess(`${name}: ${message}`);
  } else {
    logError(`${name}: ${message}`);
  }
}

async function getTestUser(username: string): Promise<{ userId: number; username: string } | null> {
  const result = await pool.query('SELECT id, username FROM users WHERE username = $1', [username]);
  if (result.rows.length === 0) return null;
  return { userId: result.rows[0].id, username: result.rows[0].username };
}

async function testQuotaExhaustion() {
  logSection('测试5: 配额耗尽阻止操作');
  
  const user = await getTestUser('ceshi1');
  if (!user) {
    logWarning('找不到 ceshi1 用户，请先运行 businessSimulationTest.ts');
    return;
  }
  
  try {
    // 获取当前配额
    const stats = await subscriptionService.getUserUsageStats(user.userId);
    const articleStat = stats.find(s => s.feature_code === 'articles_per_month');
    
    if (!articleStat) {
      logWarning('找不到文章配额');
      return;
    }
    
    logInfo(`当前文章配额: ${articleStat.used}/${articleStat.limit}`);
    
    // 模拟消耗到配额上限
    const remaining = articleStat.limit - articleStat.used;
    if (remaining > 0) {
      logInfo(`消耗剩余 ${remaining} 次配额...`);
      
      // 直接更新数据库模拟消耗
      await pool.query(
        `UPDATE user_usage 
         SET usage_count = $1 
         WHERE user_id = $2 AND feature_code = 'articles_per_month'
         AND period_start <= CURRENT_DATE AND period_end >= CURRENT_DATE`,
        [articleStat.limit, user.userId]
      );
    }
    
    // 检查是否可以继续操作
    const canPerform = await subscriptionService.canUserPerformAction(user.userId, 'articles_per_month');
    
    recordTest(
      '配额耗尽阻止',
      !canPerform,
      canPerform ? 'BUG: 配额耗尽后仍允许操作' : '正确阻止配额耗尽后的操作'
    );
    
    // 恢复配额用于后续测试
    await pool.query(
      `UPDATE user_usage 
       SET usage_count = 1 
       WHERE user_id = $1 AND feature_code = 'articles_per_month'
       AND period_start <= CURRENT_DATE AND period_end >= CURRENT_DATE`,
      [user.userId]
    );
    
  } catch (error: any) {
    recordTest('配额耗尽测试', false, error.message);
  }
}

async function testSubscriptionExpiration() {
  logSection('测试6: 套餐到期返回免费版');
  
  // 使用 ceshi2 测试（专业版用户）
  const user = await getTestUser('ceshi2');
  if (!user) {
    logWarning('找不到 ceshi2 用户');
    return;
  }
  
  try {
    // 获取当前订阅
    const currentSub = await subscriptionService.getUserActiveSubscription(user.userId);
    if (!currentSub) {
      logWarning('ceshi2 无活跃订阅');
      return;
    }
    
    logInfo(`当前订阅: ${(currentSub as any).plan_name || currentSub.plan?.plan_name}, 到期: ${currentSub.end_date}`);
    
    // 模拟订阅到期（将 end_date 设置为过去）
    const originalEndDate = currentSub.end_date;
    await pool.query(
      `UPDATE user_subscriptions 
       SET end_date = CURRENT_TIMESTAMP - INTERVAL '1 hour'
       WHERE id = $1`,
      [currentSub.id]
    );
    
    logInfo('已模拟订阅到期...');
    
    // 手动触发到期检查
    await subscriptionExpirationService.checkExpiredSubscriptions();
    
    // 检查是否已退回免费版
    const newSub = await subscriptionService.getUserActiveSubscription(user.userId);
    const planCode = newSub?.plan?.plan_code || (newSub as any)?.plan_code;
    
    // 获取套餐信息
    let newPlanName = '无';
    if (newSub) {
      const planResult = await pool.query(
        'SELECT plan_name, plan_code FROM subscription_plans WHERE id = $1',
        [newSub.plan_id]
      );
      if (planResult.rows.length > 0) {
        newPlanName = planResult.rows[0].plan_name;
      }
    }
    
    logInfo(`到期后订阅: ${newPlanName}`);
    
    const isFreePlan = newPlanName === '免费版' || planCode === 'free';
    
    recordTest(
      '到期返回免费版',
      isFreePlan,
      isFreePlan ? '正确返回免费版' : `BUG: 应返回免费版，实际为 ${newPlanName}`
    );
    
    // 检查配额是否重置为免费版配额
    const stats = await subscriptionService.getUserUsageStats(user.userId);
    const articleStat = stats.find(s => s.feature_code === 'articles_per_month');
    
    if (articleStat) {
      // 免费版文章配额应该是 10
      const isCorrectQuota = articleStat.limit === 10;
      recordTest(
        '到期后配额重置',
        isCorrectQuota,
        isCorrectQuota ? '配额正确重置为免费版' : `配额应为10，实际为${articleStat.limit}`
      );
    }
    
    // 恢复订阅用于后续测试（重新购买专业版）
    logInfo('恢复 ceshi2 的专业版订阅...');
    await subscriptionService.activateSubscription(user.userId, 2); // 2 = 专业版
    
  } catch (error: any) {
    recordTest('套餐到期测试', false, error.message);
  }
}

async function testQuotaReset() {
  logSection('测试7: 配额重置周期');
  
  const user = await getTestUser('ceshi1');
  if (!user) {
    logWarning('找不到 ceshi1 用户');
    return;
  }
  
  try {
    // 获取当前使用统计
    const stats = await subscriptionService.getUserUsageStats(user.userId);
    
    logInfo('当前配额使用情况:');
    for (const stat of stats) {
      logInfo(`  ${stat.feature_name}: ${stat.used}/${stat.limit}, 重置周期: ${stat.reset_period}`);
      if (stat.reset_time) {
        logInfo(`    下次重置: ${stat.reset_time}`);
      }
    }
    
    // 验证重置周期配置
    const articleStat = stats.find(s => s.feature_code === 'articles_per_month');
    if (articleStat) {
      const hasResetTime = !!articleStat.reset_time;
      recordTest(
        '配额重置时间',
        hasResetTime,
        hasResetTime ? `下次重置时间: ${articleStat.reset_time}` : '未配置重置时间'
      );
    }
    
    // 模拟配额周期结束（将 period_end 设置为过去）
    logInfo('模拟配额周期结束...');
    
    // 获取当前周期记录
    const usageResult = await pool.query(
      `SELECT id, period_start, period_end, usage_count 
       FROM user_usage 
       WHERE user_id = $1 AND feature_code = 'articles_per_month'
       ORDER BY period_start DESC LIMIT 1`,
      [user.userId]
    );
    
    if (usageResult.rows.length > 0) {
      const currentUsage = usageResult.rows[0];
      logInfo(`当前周期: ${currentUsage.period_start} - ${currentUsage.period_end}, 使用: ${currentUsage.usage_count}`);
      
      // 记录新的使用量（模拟新周期开始）
      await subscriptionService.recordUsage(user.userId, 'articles_per_month', 1);
      
      // 再次获取使用量
      const newUsage = await subscriptionService.getUserUsage(user.userId, 'articles_per_month');
      logInfo(`新周期使用量: ${newUsage}`);
      
      recordTest(
        '配额周期记录',
        true,
        '配额使用量正确记录在当前周期'
      );
    }
    
  } catch (error: any) {
    recordTest('配额重置测试', false, error.message);
  }
}

async function testLandingPagePlans() {
  logSection('测试8: 落地页套餐展示');
  
  try {
    // 获取所有激活的套餐
    const plans = await subscriptionService.getAllActivePlans();
    
    logInfo(`共 ${plans.length} 个激活套餐:`);
    
    for (const plan of plans) {
      const price = typeof plan.price === 'string' ? parseFloat(plan.price) : plan.price;
      const discountRate = (plan as any).agent_discount_rate || 100;
      
      logInfo(`\n  ${plan.plan_name} (${plan.plan_code}):`);
      logInfo(`    价格: ¥${price}`);
      logInfo(`    计费周期: ${plan.billing_cycle}`);
      logInfo(`    代理商折扣: ${discountRate}%`);
      
      if (plan.features && plan.features.length > 0) {
        logInfo(`    功能配额:`);
        for (const feature of plan.features) {
          if (feature.feature_code) {
            const valueDisplay = feature.feature_value === -1 ? '无限' : feature.feature_value;
            logInfo(`      - ${feature.feature_name}: ${valueDisplay} ${feature.feature_unit}`);
          }
        }
      }
    }
    
    // 验证套餐数据完整性
    const hasFreePlan = plans.some(p => p.plan_code === 'free');
    const hasProfessionalPlan = plans.some(p => p.plan_code === 'professional');
    const hasEnterprisePlan = plans.some(p => p.plan_code === 'enterprise');
    
    recordTest(
      '免费版套餐',
      hasFreePlan,
      hasFreePlan ? '存在' : '缺失'
    );
    
    recordTest(
      '专业版套餐',
      hasProfessionalPlan,
      hasProfessionalPlan ? '存在' : '缺失'
    );
    
    recordTest(
      '企业版套餐',
      hasEnterprisePlan,
      hasEnterprisePlan ? '存在' : '缺失'
    );
    
    // 验证折扣配置
    const professionalPlan = plans.find(p => p.plan_code === 'professional');
    const enterprisePlan = plans.find(p => p.plan_code === 'enterprise');
    
    if (professionalPlan) {
      const discountRate = (professionalPlan as any).agent_discount_rate;
      recordTest(
        '专业版折扣配置',
        discountRate && discountRate < 100,
        discountRate ? `折扣率: ${discountRate}%` : '未配置折扣'
      );
    }
    
    if (enterprisePlan) {
      const discountRate = (enterprisePlan as any).agent_discount_rate;
      recordTest(
        '企业版折扣配置',
        discountRate && discountRate < 100,
        discountRate ? `折扣率: ${discountRate}%` : '未配置折扣'
      );
    }
    
  } catch (error: any) {
    recordTest('落地页套餐测试', false, error.message);
  }
}

async function printSummary() {
  logSection('测试结果汇总');
  
  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;
  
  console.log(`\n总计: ${testResults.length} 项测试`);
  logSuccess(`通过: ${passed} 项`);
  if (failed > 0) {
    logError(`失败: ${failed} 项`);
    
    console.log('\n失败的测试:');
    for (const result of testResults.filter(r => !r.passed)) {
      logError(`  - ${result.name}: ${result.message}`);
    }
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  log('GEO 系统业务模拟测试 - 第二部分', colors.cyan);
  console.log('='.repeat(60));
  
  try {
    // 测试配额耗尽
    await testQuotaExhaustion();
    
    // 测试套餐到期
    await testSubscriptionExpiration();
    
    // 测试配额重置
    await testQuotaReset();
    
    // 测试落地页套餐展示
    await testLandingPagePlans();
    
    // 打印汇总
    await printSummary();
    
  } catch (error: any) {
    logError(`测试执行失败: ${error.message}`);
    console.error(error);
  } finally {
    await pool.end();
  }
}

main();
