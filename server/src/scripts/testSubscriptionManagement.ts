/**
 * 订阅管理功能系统测试
 * 
 * 测试功能：
 * 1. 获取订阅详情
 * 2. 升级套餐
 * 3. 延期订阅
 * 4. 调整配额
 * 5. 重置配额
 * 6. 暂停订阅
 * 7. 恢复订阅
 * 8. 取消订阅
 * 9. 赠送套餐
 * 10. 获取调整历史
 */

import { pool } from '../db/database';
import { userSubscriptionManagementService } from '../services/UserSubscriptionManagementService';

// 测试用户ID（使用 test 用户）
const TEST_USER_ID = 2;
const ADMIN_ID = 1;

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

async function log(message: string) {
  console.log(message);
}

async function getStorageQuota(userId: number): Promise<number> {
  const result = await pool.query(
    'SELECT storage_quota_bytes FROM user_storage_usage WHERE user_id = $1',
    [userId]
  );
  // 确保转换为数字类型
  return Number(result.rows[0]?.storage_quota_bytes) || 0;
}

async function getSubscriptionInfo(userId: number) {
  const result = await pool.query(`
    SELECT us.*, sp.plan_code, sp.plan_name
    FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.user_id = $1 AND us.status = 'active'
    ORDER BY us.end_date DESC
    LIMIT 1
  `, [userId]);
  return result.rows[0];
}

async function getPlanId(planCode: string): Promise<number> {
  const result = await pool.query(
    'SELECT id FROM subscription_plans WHERE plan_code = $1',
    [planCode]
  );
  return result.rows[0]?.id;
}

async function test1_GetSubscriptionDetail() {
  log('\n📋 测试 1: 获取订阅详情');
  try {
    const detail = await userSubscriptionManagementService.getUserSubscriptionDetail(TEST_USER_ID);
    
    if (!detail) {
      results.push({ name: '获取订阅详情', passed: false, error: '未找到订阅' });
      return;
    }
    
    log(`  ✅ 套餐: ${detail.plan_name}`);
    log(`  ✅ 状态: ${detail.status}`);
    log(`  ✅ 剩余天数: ${detail.days_remaining}`);
    
    results.push({ name: '获取订阅详情', passed: true, details: detail });
  } catch (error: any) {
    log(`  ❌ 失败: ${error.message}`);
    results.push({ name: '获取订阅详情', passed: false, error: error.message });
  }
}

async function test2_UpgradePlan() {
  log('\n📋 测试 2: 升级套餐');
  try {
    const beforeSub = await getSubscriptionInfo(TEST_USER_ID);
    const beforeQuota = await getStorageQuota(TEST_USER_ID);
    log(`  升级前: ${beforeSub?.plan_name}, 存储配额: ${beforeQuota / 1024 / 1024} MB`);
    
    // 升级到专业版
    const professionalPlanId = await getPlanId('professional');
    await userSubscriptionManagementService.upgradePlan(
      TEST_USER_ID,
      professionalPlanId,
      ADMIN_ID,
      '系统测试升级'
    );
    
    const afterSub = await getSubscriptionInfo(TEST_USER_ID);
    const afterQuota = await getStorageQuota(TEST_USER_ID);
    log(`  升级后: ${afterSub?.plan_name}, 存储配额: ${afterQuota / 1024 / 1024} MB`);
    
    // 验证
    const quotaCorrect = afterQuota === 20 * 1024 * 1024;
    const planCorrect = afterSub?.plan_code === 'professional';
    const passed = planCorrect && quotaCorrect;
    if (passed) {
      log(`  ✅ 升级成功，存储配额正确更新`);
    } else {
      if (!planCorrect) log(`  ❌ 套餐未正确升级`);
      if (!quotaCorrect) log(`  ❌ 配额不正确，期望 20 MB，实际 ${afterQuota / 1024 / 1024} MB`);
    }
    
    results.push({ name: '升级套餐', passed, details: { before: beforeSub?.plan_name, after: afterSub?.plan_name } });
  } catch (error: any) {
    log(`  ❌ 失败: ${error.message}`);
    results.push({ name: '升级套餐', passed: false, error: error.message });
  }
}

async function test3_ExtendSubscription() {
  log('\n📋 测试 3: 延期订阅');
  try {
    const beforeSub = await getSubscriptionInfo(TEST_USER_ID);
    const beforeEndDate = new Date(beforeSub.end_date);
    log(`  延期前结束日期: ${beforeEndDate.toLocaleDateString()}`);
    
    await userSubscriptionManagementService.extendSubscription(
      TEST_USER_ID,
      30,
      ADMIN_ID,
      '系统测试延期'
    );
    
    const afterSub = await getSubscriptionInfo(TEST_USER_ID);
    const afterEndDate = new Date(afterSub.end_date);
    log(`  延期后结束日期: ${afterEndDate.toLocaleDateString()}`);
    
    // 验证延期了约30天
    const daysDiff = Math.round((afterEndDate.getTime() - beforeEndDate.getTime()) / (1000 * 60 * 60 * 24));
    const passed = daysDiff >= 29 && daysDiff <= 31;
    
    if (passed) {
      log(`  ✅ 延期成功，增加了 ${daysDiff} 天`);
    } else {
      log(`  ❌ 延期天数不正确，期望 30 天，实际 ${daysDiff} 天`);
    }
    
    results.push({ name: '延期订阅', passed, details: { daysDiff } });
  } catch (error: any) {
    log(`  ❌ 失败: ${error.message}`);
    results.push({ name: '延期订阅', passed: false, error: error.message });
  }
}

async function test4_AdjustQuota() {
  log('\n📋 测试 4: 调整配额（存储空间）');
  try {
    const beforeQuota = await getStorageQuota(TEST_USER_ID);
    log(`  调整前存储配额: ${beforeQuota / 1024 / 1024} MB`);
    
    // 调整存储配额到 50 MB
    await userSubscriptionManagementService.adjustQuota(
      TEST_USER_ID,
      'storage_space',
      50,
      false,
      ADMIN_ID,
      '系统测试调整配额'
    );
    
    const afterQuota = await getStorageQuota(TEST_USER_ID);
    log(`  调整后存储配额: ${afterQuota / 1024 / 1024} MB`);
    
    const passed = afterQuota === 50 * 1024 * 1024;
    if (passed) {
      log(`  ✅ 配额调整成功`);
    } else {
      log(`  ❌ 配额调整失败，期望 50 MB，实际 ${afterQuota / 1024 / 1024} MB`);
    }
    log(`  验证: afterQuota=${afterQuota}, expected=${50 * 1024 * 1024}, passed=${passed}`);
    
    results.push({ name: '调整配额', passed, details: { before: beforeQuota, after: afterQuota } });
  } catch (error: any) {
    log(`  ❌ 失败: ${error.message}`);
    results.push({ name: '调整配额', passed: false, error: error.message });
  }
}

async function test5_PauseAndResume() {
  log('\n📋 测试 5: 暂停和恢复订阅');
  try {
    // 暂停
    await userSubscriptionManagementService.pauseSubscription(
      TEST_USER_ID,
      ADMIN_ID,
      '系统测试暂停'
    );
    
    let sub = await getSubscriptionInfo(TEST_USER_ID);
    const pausedAt = sub?.paused_at;
    log(`  暂停后 paused_at: ${pausedAt ? '已设置' : '未设置'}`);
    
    if (!pausedAt) {
      results.push({ name: '暂停订阅', passed: false, error: 'paused_at 未设置' });
      return;
    }
    log(`  ✅ 暂停成功`);
    
    // 恢复
    await userSubscriptionManagementService.resumeSubscription(
      TEST_USER_ID,
      ADMIN_ID,
      '系统测试恢复'
    );
    
    sub = await getSubscriptionInfo(TEST_USER_ID);
    const resumedPausedAt = sub?.paused_at;
    log(`  恢复后 paused_at: ${resumedPausedAt ? '仍设置' : '已清除'}`);
    
    const passed = !resumedPausedAt;
    if (passed) {
      log(`  ✅ 恢复成功`);
    } else {
      log(`  ❌ 恢复失败，paused_at 未清除`);
    }
    
    results.push({ name: '暂停和恢复订阅', passed });
  } catch (error: any) {
    log(`  ❌ 失败: ${error.message}`);
    results.push({ name: '暂停和恢复订阅', passed: false, error: error.message });
  }
}

async function test6_GiftSubscription() {
  log('\n📋 测试 6: 赠送套餐');
  try {
    const beforeSub = await getSubscriptionInfo(TEST_USER_ID);
    const beforeQuota = await getStorageQuota(TEST_USER_ID);
    log(`  赠送前: ${beforeSub?.plan_name}, 存储配额: ${beforeQuota / 1024 / 1024} MB`);
    
    // 赠送企业版 30 天
    const enterprisePlanId = await getPlanId('enterprise');
    await userSubscriptionManagementService.giftSubscription(
      TEST_USER_ID,
      enterprisePlanId,
      30,
      ADMIN_ID,
      '系统测试赠送'
    );
    
    const afterSub = await getSubscriptionInfo(TEST_USER_ID);
    const afterQuota = await getStorageQuota(TEST_USER_ID);
    log(`  赠送后: ${afterSub?.plan_name}, 存储配额: ${afterQuota / 1024 / 1024} MB`);
    
    // 验证：企业版存储配额是 30 MB
    const quotaCorrect = afterQuota === 30 * 1024 * 1024;
    const planCorrect = afterSub?.plan_code === 'enterprise';
    const passed = planCorrect && quotaCorrect;
    if (passed) {
      log(`  ✅ 赠送成功，存储配额正确更新`);
    } else {
      if (!planCorrect) log(`  ❌ 套餐未正确赠送，当前: ${afterSub?.plan_code}`);
      if (!quotaCorrect) log(`  ❌ 配额不正确，期望 30 MB，实际 ${afterQuota / 1024 / 1024} MB`);
    }
    
    // 检查旧订阅是否被标记为 replaced
    const oldSubs = await pool.query(
      `SELECT COUNT(*) as count FROM user_subscriptions WHERE user_id = $1 AND status = 'active'`,
      [TEST_USER_ID]
    );
    const activeCount = parseInt(oldSubs.rows[0].count);
    log(`  当前 active 订阅数: ${activeCount}`);
    
    if (activeCount !== 1) {
      log(`  ⚠️ 警告：存在多个 active 订阅`);
    }
    
    results.push({ name: '赠送套餐', passed, details: { before: beforeSub?.plan_name, after: afterSub?.plan_name } });
  } catch (error: any) {
    log(`  ❌ 失败: ${error.message}`);
    results.push({ name: '赠送套餐', passed: false, error: error.message });
  }
}

async function test7_CancelSubscription() {
  log('\n📋 测试 7: 取消订阅（立即生效）');
  try {
    const beforeSub = await getSubscriptionInfo(TEST_USER_ID);
    const beforeQuota = await getStorageQuota(TEST_USER_ID);
    log(`  取消前: ${beforeSub?.plan_name}, 存储配额: ${beforeQuota / 1024 / 1024} MB`);
    
    await userSubscriptionManagementService.cancelSubscription(
      TEST_USER_ID,
      true, // immediate
      ADMIN_ID,
      '系统测试取消'
    );
    
    const afterSub = await getSubscriptionInfo(TEST_USER_ID);
    const afterQuota = await getStorageQuota(TEST_USER_ID);
    log(`  取消后: ${afterSub?.plan_name}, 存储配额: ${afterQuota / 1024 / 1024} MB`);
    
    // 验证：应该回退到免费版，存储配额 10 MB
    const quotaCorrect = afterQuota === 10 * 1024 * 1024;
    const planCorrect = afterSub?.plan_code === 'free';
    const passed = planCorrect && quotaCorrect;
    if (passed) {
      log(`  ✅ 取消成功，已回退到免费版`);
    } else {
      if (!planCorrect) log(`  ❌ 套餐未正确回退，当前: ${afterSub?.plan_code}`);
      if (!quotaCorrect) log(`  ❌ 配额不正确，期望 10 MB，实际 ${afterQuota / 1024 / 1024} MB`);
    }
    
    results.push({ name: '取消订阅', passed, details: { before: beforeSub?.plan_name, after: afterSub?.plan_name } });
  } catch (error: any) {
    log(`  ❌ 失败: ${error.message}`);
    results.push({ name: '取消订阅', passed: false, error: error.message });
  }
}

async function test8_GetAdjustmentHistory() {
  log('\n📋 测试 8: 获取调整历史');
  try {
    const history = await userSubscriptionManagementService.getAdjustmentHistory(TEST_USER_ID, 1, 10);
    
    log(`  历史记录数: ${history.total}`);
    if (history.history.length > 0) {
      log(`  最近操作: ${history.history[0].adjustment_type_label}`);
    }
    
    const passed = history.total > 0;
    if (passed) {
      log(`  ✅ 获取历史成功`);
    } else {
      log(`  ⚠️ 没有历史记录`);
    }
    
    results.push({ name: '获取调整历史', passed, details: { total: history.total } });
  } catch (error: any) {
    log(`  ❌ 失败: ${error.message}`);
    results.push({ name: '获取调整历史', passed: false, error: error.message });
  }
}

async function runAllTests() {
  console.log('='.repeat(60));
  console.log('订阅管理功能系统测试');
  console.log('='.repeat(60));
  console.log(`测试用户ID: ${TEST_USER_ID}`);
  
  try {
    // 确保测试用户有订阅
    const initialSub = await getSubscriptionInfo(TEST_USER_ID);
    if (!initialSub) {
      log('\n⚠️ 测试用户没有订阅，先创建免费版订阅...');
      const freePlanId = await getPlanId('free');
      await pool.query(`
        INSERT INTO user_subscriptions (user_id, plan_id, status, start_date, end_date)
        VALUES ($1, $2, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 year')
      `, [TEST_USER_ID, freePlanId]);
      
      // 确保有存储记录
      await pool.query(`
        INSERT INTO user_storage_usage (user_id, storage_quota_bytes)
        VALUES ($1, 10485760)
        ON CONFLICT (user_id) DO UPDATE SET storage_quota_bytes = 10485760
      `, [TEST_USER_ID]);
    }
    
    await test1_GetSubscriptionDetail();
    await test2_UpgradePlan();
    await test3_ExtendSubscription();
    await test4_AdjustQuota();
    await test5_PauseAndResume();
    await test6_GiftSubscription();
    await test7_CancelSubscription();
    await test8_GetAdjustmentHistory();
    
  } catch (error: any) {
    console.error('测试过程中发生错误:', error);
  }
  
  // 输出测试结果汇总
  console.log('\n' + '='.repeat(60));
  console.log('测试结果汇总');
  console.log('='.repeat(60));
  
  let passedCount = 0;
  let failedCount = 0;
  
  for (const result of results) {
    const status = result.passed ? '✅ 通过' : '❌ 失败';
    console.log(`${status} - ${result.name}${result.error ? `: ${result.error}` : ''}`);
    if (result.passed) passedCount++;
    else failedCount++;
  }
  
  console.log('\n' + '-'.repeat(60));
  console.log(`总计: ${results.length} 项测试, ${passedCount} 通过, ${failedCount} 失败`);
  console.log('='.repeat(60));
  
  await pool.end();
}

runAllTests();
