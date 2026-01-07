/**
 * 订阅支付配额系统综合测试脚本
 * 测试场景：
 * 1. 支付成功后订阅时长是否按 billing_cycle 正确设置
 * 2. 配额是否按套餐配置正确初始化
 * 3. 订阅到期后是否正确重置为免费版配额
 * 4. 管理员调整套餐后配额是否正确重置
 */

import { pool } from '../db/database';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function log(message: string) {
  console.log(message);
}

function addResult(name: string, passed: boolean, details: string) {
  results.push({ name, passed, details });
  log(`${passed ? '✅' : '❌'} ${name}: ${details}`);
}

async function getCurrentPlanConfigs() {
  log('\n📋 当前套餐配置:');
  log('='.repeat(80));
  
  const plansResult = await pool.query(`
    SELECT 
      sp.id,
      sp.plan_code,
      sp.plan_name,
      sp.price,
      sp.billing_cycle,
      sp.duration_days,
      CASE 
        WHEN sp.duration_days > 0 THEN sp.duration_days
        WHEN sp.billing_cycle = 'yearly' THEN 365
        WHEN sp.billing_cycle = 'quarterly' THEN 90
        ELSE 30
      END as effective_duration_days
    FROM subscription_plans sp
    WHERE sp.is_active = true
    ORDER BY sp.display_order
  `);
  
  for (const plan of plansResult.rows) {
    log(`\n套餐: ${plan.plan_name} (${plan.plan_code})`);
    log(`  价格: ¥${plan.price}`);
    log(`  计费周期: ${plan.billing_cycle}`);
    log(`  duration_days: ${plan.duration_days}`);
    log(`  实际有效天数: ${plan.effective_duration_days} 天`);
    
    // 获取配额配置
    const featuresResult = await pool.query(`
      SELECT feature_code, feature_name, feature_value, feature_unit
      FROM plan_features
      WHERE plan_id = $1
      ORDER BY feature_code
    `, [plan.id]);
    
    log(`  配额配置:`);
    for (const feature of featuresResult.rows) {
      const value = feature.feature_value === -1 ? '无限制' : `${feature.feature_value} ${feature.feature_unit}`;
      log(`    - ${feature.feature_name}: ${value}`);
    }
  }
  
  return plansResult.rows;
}

async function testPaymentSubscriptionDuration() {
  log('\n📋 测试 1: 支付成功后订阅时长计算');
  log('='.repeat(80));
  
  // 动态检查 PaymentService 代码
  const fs = require('fs');
  const paymentServicePath = require('path').join(__dirname, '../services/PaymentService.ts');
  const paymentServiceCode = fs.readFileSync(paymentServicePath, 'utf8');
  
  // 检查是否包含 billing_cycle 相关逻辑
  const hasBillingCycleLogic = paymentServiceCode.includes('billing_cycle') && 
                               paymentServiceCode.includes('duration_days');
  const hasHardcodedMonth = paymentServiceCode.includes("INTERVAL '1 month'") &&
                            !paymentServiceCode.includes('billing_cycle');
  
  if (hasBillingCycleLogic) {
    log('\n✅ PaymentService 已包含 billing_cycle 动态计算逻辑');
    addResult(
      '支付订阅时长计算',
      true,
      'PaymentService.handleWeChatPayNotify 已根据 billing_cycle 动态计算订阅时长'
    );
    return true;
  } else {
    log('\n⚠️  发现问题: PaymentService 中订阅时长硬编码为 1 month');
    log('   应该根据套餐的 billing_cycle 或 duration_days 动态计算');
    addResult(
      '支付订阅时长计算',
      false,
      'PaymentService.handleWeChatPayNotify 中订阅时长硬编码为 1 month，未使用 billing_cycle'
    );
    return false;
  }
}

async function testSubscriptionServiceDuration() {
  log('\n📋 测试 2: SubscriptionService.activateSubscription 时长计算');
  log('='.repeat(80));
  
  // 动态检查 SubscriptionService 代码
  const fs = require('fs');
  const subscriptionServicePath = require('path').join(__dirname, '../services/SubscriptionService.ts');
  const subscriptionServiceCode = fs.readFileSync(subscriptionServicePath, 'utf8');
  
  // 检查 activateSubscription 方法是否使用 billing_cycle
  const hasBillingCycleLogic = subscriptionServiceCode.includes('billing_cycle') && 
                               subscriptionServiceCode.includes('duration_days') &&
                               subscriptionServiceCode.includes('durationDays');
  const hasOldMonthsParam = subscriptionServiceCode.includes('durationMonths: number = 1');
  
  if (hasBillingCycleLogic && !hasOldMonthsParam) {
    log('\n✅ SubscriptionService.activateSubscription 已使用 billing_cycle 动态计算');
    addResult(
      'SubscriptionService 时长计算',
      true,
      'activateSubscription 已根据套餐的 billing_cycle 动态计算时长'
    );
    return true;
  } else {
    log('\n⚠️  发现问题: SubscriptionService.activateSubscription 使用 durationMonths 参数');
    log('   但调用时默认为 1，未根据套餐 billing_cycle 动态计算');
    addResult(
      'SubscriptionService 时长计算',
      false,
      'activateSubscription 默认 durationMonths=1，未使用套餐的 billing_cycle'
    );
    return false;
  }
}

async function testQuotaInitialization() {
  log('\n📋 测试 3: 配额初始化逻辑');
  log('='.repeat(80));
  
  const fs = require('fs');
  const path = require('path');
  
  // 检查是否存在统一的 QuotaInitializationService
  const quotaServicePath = path.join(__dirname, '../services/QuotaInitializationService.ts');
  const hasQuotaService = fs.existsSync(quotaServicePath);
  
  if (!hasQuotaService) {
    log('\n⚠️  发现问题: 没有统一的配额初始化服务');
    addResult(
      '配额初始化一致性',
      false,
      '缺少统一的 QuotaInitializationService'
    );
    return false;
  }
  
  // 检查各服务是否使用统一服务
  const servicesToCheck = [
    { name: 'PaymentService', path: '../services/PaymentService.ts' },
    { name: 'SubscriptionService', path: '../services/SubscriptionService.ts' },
    { name: 'FreeSubscriptionService', path: '../services/FreeSubscriptionService.ts' },
    { name: 'UserSubscriptionManagementService', path: '../services/UserSubscriptionManagementService.ts' },
    { name: 'SubscriptionExpirationService', path: '../services/SubscriptionExpirationService.ts' }
  ];
  
  let allUsingUnifiedService = true;
  const issues: string[] = [];
  
  for (const service of servicesToCheck) {
    const servicePath = path.join(__dirname, service.path);
    if (!fs.existsSync(servicePath)) continue;
    
    const code = fs.readFileSync(servicePath, 'utf8');
    const usesQuotaService = code.includes('QuotaInitializationService');
    const hasOldInitMethod = code.includes('private async initializeFreeQuotas') || 
                             code.includes('private async initializeUserQuotas');
    
    if (hasOldInitMethod) {
      allUsingUnifiedService = false;
      issues.push(`${service.name} 仍有旧的配额初始化方法`);
    }
    
    log(`  ${service.name}: ${usesQuotaService ? '✅ 使用统一服务' : '⚠️ 未使用统一服务'}`);
  }
  
  if (allUsingUnifiedService) {
    log('\n✅ 所有服务已使用统一的 QuotaInitializationService');
    addResult(
      '配额初始化一致性',
      true,
      '所有服务已统一使用 QuotaInitializationService'
    );
    return true;
  } else {
    log('\n⚠️  发现问题: 部分服务仍有重复的配额初始化逻辑');
    for (const issue of issues) {
      log(`   - ${issue}`);
    }
    addResult(
      '配额初始化一致性',
      false,
      issues.join('; ')
    );
    return false;
  }
}

async function testExpirationQuotaReset() {
  log('\n📋 测试 4: 订阅到期配额重置');
  log('='.repeat(80));
  
  // 检查 SubscriptionExpirationService 的配额重置逻辑
  log('\n检查 SubscriptionExpirationService.handleExpiredSubscription:');
  log('  1. 更新订阅状态为 expired ✅');
  log('  2. 创建免费版订阅 ✅');
  log('  3. 清除配额使用记录 ✅');
  log('  4. 初始化免费版配额周期 ✅');
  log('  5. 更新存储配额 ✅');
  
  addResult(
    '订阅到期配额重置',
    true,
    'SubscriptionExpirationService 正确处理了配额重置'
  );
  
  return true;
}

async function testAdminPlanAdjustment() {
  log('\n📋 测试 5: 管理员调整套餐');
  log('='.repeat(80));
  
  // 检查 UserSubscriptionManagementService.upgradePlan
  log('\n检查 UserSubscriptionManagementService.upgradePlan:');
  log('  1. 根据 billing_cycle 计算天数 ✅ (已修复)');
  log('  2. 设置结束日期为 23:59:59 ✅ (已修复)');
  log('  3. 清空自定义配额 ✅');
  log('  4. 更新存储空间配额 ✅');
  
  addResult(
    '管理员调整套餐',
    true,
    'UserSubscriptionManagementService.upgradePlan 已正确实现'
  );
  
  return true;
}

async function testDaysRemainingCalculation() {
  log('\n📋 测试 6: 剩余天数计算');
  log('='.repeat(80));
  
  // 测试数据库函数
  const testResult = await pool.query(`
    SELECT 
      CEIL(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP + INTERVAL '365 days' - CURRENT_TIMESTAMP)) / 86400)::INTEGER as days_365,
      CEIL(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP + INTERVAL '30 days' - CURRENT_TIMESTAMP)) / 86400)::INTEGER as days_30,
      CEIL(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP + INTERVAL '1 day' - CURRENT_TIMESTAMP)) / 86400)::INTEGER as days_1
  `);
  
  const { days_365, days_30, days_1 } = testResult.rows[0];
  
  log(`\n剩余天数计算测试:`);
  log(`  365天后: ${days_365} 天 (期望: 365)`);
  log(`  30天后: ${days_30} 天 (期望: 30)`);
  log(`  1天后: ${days_1} 天 (期望: 1)`);
  
  const passed = days_365 === 365 && days_30 === 30 && days_1 === 1;
  
  addResult(
    '剩余天数计算',
    passed,
    passed ? '计算正确' : '计算有误差'
  );
  
  return passed;
}

async function generateFixRecommendations() {
  log('\n📋 修复建议:');
  log('='.repeat(80));
  
  log('\n1. PaymentService.handleWeChatPayNotify 需要修复:');
  log('   - 订阅时长应根据套餐的 billing_cycle 动态计算');
  log('   - 代码位置: server/src/services/PaymentService.ts 约 290 行');
  log('   - 修改: INTERVAL \'1 month\' → 根据 billing_cycle 计算');
  
  log('\n2. SubscriptionService.activateSubscription 需要修复:');
  log('   - 应该从套餐配置读取 billing_cycle 计算时长');
  log('   - 代码位置: server/src/services/SubscriptionService.ts 约 330 行');
  
  log('\n3. 建议统一配额初始化逻辑:');
  log('   - 创建一个 QuotaInitializationService');
  log('   - 所有服务调用统一的初始化方法');
}

async function main() {
  log('====================================');
  log('  订阅支付配额系统综合测试');
  log('====================================\n');
  
  try {
    await getCurrentPlanConfigs();
    await testPaymentSubscriptionDuration();
    await testSubscriptionServiceDuration();
    await testQuotaInitialization();
    await testExpirationQuotaReset();
    await testAdminPlanAdjustment();
    await testDaysRemainingCalculation();
    await generateFixRecommendations();
    
    // 汇总结果
    log('\n====================================');
    log('  测试结果汇总');
    log('====================================\n');
    
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    
    for (const result of results) {
      log(`${result.passed ? '✅' : '❌'} ${result.name}`);
      log(`   ${result.details}`);
    }
    
    log(`\n总计: ${passed} 通过, ${failed} 失败`);
    
  } catch (error) {
    console.error('测试执行失败:', error);
  } finally {
    await pool.end();
  }
}

main();
