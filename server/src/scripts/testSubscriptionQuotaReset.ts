/**
 * 订阅配额重置测试脚本
 * 测试场景：
 * 1. 套餐续费后配额重置
 * 2. 套餐到期后退回免费版
 * 3. 所有套餐的配额验证
 */

import { pool } from '../db/database';
import { subscriptionService } from '../services/SubscriptionService';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function log(message: string) {
  console.log(`[测试] ${message}`);
}

function addResult(name: string, passed: boolean, message: string) {
  results.push({ name, passed, message });
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${name}: ${message}`);
}

async function testAllPlansQuota() {
  log('========== 测试所有套餐配额 ==========');
  
  // 获取所有套餐
  const plansResult = await pool.query(`
    SELECT sp.id, sp.plan_code, sp.plan_name, sp.billing_cycle
    FROM subscription_plans sp
    WHERE sp.is_active = true
    ORDER BY sp.display_order
  `);

  for (const plan of plansResult.rows) {
    log(`\n--- 测试套餐: ${plan.plan_name} (${plan.plan_code}) ---`);
    
    // 获取套餐功能
    const featuresResult = await pool.query(`
      SELECT feature_code, feature_name, feature_value, feature_unit
      FROM plan_features
      WHERE plan_id = $1
      ORDER BY feature_code
    `, [plan.id]);

    if (featuresResult.rows.length === 0) {
      addResult(`${plan.plan_name} 功能配置`, false, '套餐没有配置任何功能');
      continue;
    }

    log(`  功能配置 (${featuresResult.rows.length} 项):`);
    for (const feature of featuresResult.rows) {
      const value = feature.feature_value === -1 ? '无限制' : `${feature.feature_value} ${feature.feature_unit}`;
      log(`    - ${feature.feature_name}: ${value}`);
    }

    addResult(`${plan.plan_name} 功能配置`, true, `${featuresResult.rows.length} 项功能已配置`);
  }
}

async function testQuotaPeriodCalculation() {
  log('\n========== 测试配额周期计算 ==========');
  
  // 获取有活跃订阅的用户
  const usersResult = await pool.query(`
    SELECT DISTINCT us.user_id, u.username, sp.plan_name, us.quota_reset_anchor, us.quota_cycle_type
    FROM user_subscriptions us
    JOIN users u ON u.id = us.user_id
    JOIN subscription_plans sp ON sp.id = us.plan_id
    WHERE us.status = 'active'
    LIMIT 5
  `);

  if (usersResult.rows.length === 0) {
    addResult('配额周期计算', false, '没有找到活跃订阅的用户');
    return;
  }

  for (const user of usersResult.rows) {
    log(`\n--- 用户: ${user.username} (${user.plan_name}) ---`);
    log(`  配额锚点: ${user.quota_reset_anchor}`);
    log(`  周期类型: ${user.quota_cycle_type}`);

    // 测试配额周期函数
    try {
      const periodResult = await pool.query(
        `SELECT * FROM get_user_quota_period($1, 'articles_per_month')`,
        [user.user_id]
      );

      if (periodResult.rows.length > 0) {
        const period = periodResult.rows[0];
        log(`  当前周期: ${period.period_start} ~ ${period.period_end}`);
        log(`  订阅结束: ${period.subscription_end}`);
        
        // 验证周期结束不超过订阅结束
        const periodEnd = new Date(period.period_end);
        const subEnd = new Date(period.subscription_end);
        
        if (periodEnd <= subEnd) {
          addResult(`${user.username} 周期计算`, true, '周期结束时间正确（不超过订阅结束）');
        } else {
          addResult(`${user.username} 周期计算`, false, '周期结束时间超过订阅结束时间');
        }
      } else {
        addResult(`${user.username} 周期计算`, false, '无法计算配额周期');
      }

      // 测试下次重置时间
      const resetTimeResult = await pool.query(
        `SELECT get_next_quota_reset_time($1) as next_reset`,
        [user.user_id]
      );

      if (resetTimeResult.rows[0].next_reset) {
        log(`  下次重置: ${resetTimeResult.rows[0].next_reset}`);
        addResult(`${user.username} 重置时间`, true, '下次重置时间已计算');
      }

      // 测试重置描述
      const descResult = await pool.query(
        `SELECT get_quota_reset_description($1) as description`,
        [user.user_id]
      );

      if (descResult.rows[0].description) {
        log(`  重置描述: ${descResult.rows[0].description}`);
      }

    } catch (error: any) {
      addResult(`${user.username} 周期计算`, false, `错误: ${error.message}`);
    }
  }
}

async function testSubscriptionRenewal() {
  log('\n========== 测试套餐续费场景 ==========');
  
  // 创建测试用户
  const testUsername = `test_renewal_${Date.now()}`;
  const invitationCode = Math.random().toString(36).substring(2, 8); // 6位随机码
  
  try {
    // 1. 创建测试用户
    const userResult = await pool.query(`
      INSERT INTO users (username, password_hash, email, role, invitation_code)
      VALUES ($1, 'test_hash', $2, 'user', $3)
      RETURNING id
    `, [testUsername, `${testUsername}@test.com`, invitationCode]);
    
    const testUserId = userResult.rows[0].id;
    log(`创建测试用户: ${testUsername} (ID: ${testUserId})`);

    // 2. 创建专业版订阅（即将到期）
    const professionalPlanResult = await pool.query(
      `SELECT id FROM subscription_plans WHERE plan_code = 'professional'`
    );
    const professionalPlanId = professionalPlanResult.rows[0].id;

    await pool.query(`
      INSERT INTO user_subscriptions (user_id, plan_id, status, start_date, end_date, quota_reset_anchor, quota_cycle_type)
      VALUES ($1, $2, 'active', CURRENT_TIMESTAMP - INTERVAL '25 days', CURRENT_TIMESTAMP + INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '25 days', 'monthly')
    `, [testUserId, professionalPlanId]);

    log('创建专业版订阅（5天后到期）');

    // 3. 模拟使用一些配额
    await pool.query(`
      INSERT INTO user_usage (user_id, feature_code, usage_count, period_start, period_end)
      VALUES 
        ($1, 'articles_per_month', 50, CURRENT_TIMESTAMP - INTERVAL '25 days', CURRENT_TIMESTAMP + INTERVAL '5 days'),
        ($1, 'publish_per_month', 30, CURRENT_TIMESTAMP - INTERVAL '25 days', CURRENT_TIMESTAMP + INTERVAL '5 days')
    `, [testUserId]);

    log('模拟使用配额: 文章50篇, 发布30篇');

    // 4. 获取续费前的使用统计
    const beforeStats = await subscriptionService.getUserUsageStats(testUserId);
    log('续费前使用统计:');
    for (const stat of beforeStats) {
      log(`  - ${stat.feature_name}: ${stat.used}/${stat.limit}`);
    }

    // 5. 模拟续费（延长订阅时间，重置配额锚点）
    await pool.query(`
      UPDATE user_subscriptions
      SET 
        end_date = end_date + INTERVAL '1 month',
        quota_reset_anchor = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND status = 'active'
    `, [testUserId]);

    // 清除旧的使用记录（续费重置配额）
    await pool.query(`DELETE FROM user_usage WHERE user_id = $1`, [testUserId]);

    log('执行续费操作（延长1个月，重置配额）');

    // 6. 获取续费后的使用统计
    const afterStats = await subscriptionService.getUserUsageStats(testUserId);
    log('续费后使用统计:');
    for (const stat of afterStats) {
      log(`  - ${stat.feature_name}: ${stat.used}/${stat.limit}`);
    }

    // 验证配额已重置
    const allReset = afterStats.every(s => s.used === 0);
    addResult('续费配额重置', allReset, allReset ? '所有配额已重置为0' : '配额未正确重置');

    // 清理测试数据
    await pool.query(`DELETE FROM user_usage WHERE user_id = $1`, [testUserId]);
    await pool.query(`DELETE FROM user_subscriptions WHERE user_id = $1`, [testUserId]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [testUserId]);
    log('清理测试数据完成');

  } catch (error: any) {
    addResult('续费测试', false, `错误: ${error.message}`);
  }
}

async function testSubscriptionExpiration() {
  log('\n========== 测试套餐到期场景 ==========');
  
  const testUsername = `test_expiry_${Date.now()}`;
  const invitationCode = Math.random().toString(36).substring(2, 8); // 6位随机码
  
  try {
    // 1. 创建测试用户
    const userResult = await pool.query(`
      INSERT INTO users (username, password_hash, email, role, invitation_code)
      VALUES ($1, 'test_hash', $2, 'user', $3)
      RETURNING id
    `, [testUsername, `${testUsername}@test.com`, invitationCode]);
    
    const testUserId = userResult.rows[0].id;
    log(`创建测试用户: ${testUsername} (ID: ${testUserId})`);

    // 2. 创建企业版订阅（已过期）
    const enterprisePlanResult = await pool.query(
      `SELECT id FROM subscription_plans WHERE plan_code = 'enterprise'`
    );
    const enterprisePlanId = enterprisePlanResult.rows[0].id;

    await pool.query(`
      INSERT INTO user_subscriptions (user_id, plan_id, status, start_date, end_date, quota_reset_anchor, quota_cycle_type)
      VALUES ($1, $2, 'active', CURRENT_TIMESTAMP - INTERVAL '31 days', CURRENT_TIMESTAMP - INTERVAL '1 hour', CURRENT_TIMESTAMP - INTERVAL '31 days', 'monthly')
    `, [testUserId, enterprisePlanId]);

    log('创建企业版订阅（已过期1小时）');

    // 3. 获取到期前的订阅信息
    const beforeSub = await subscriptionService.getUserActiveSubscription(testUserId);
    log(`到期前套餐: ${beforeSub?.plan?.plan_name || '无'}`);

    // 4. 模拟到期处理（手动执行）
    const freePlanResult = await pool.query(
      `SELECT id FROM subscription_plans WHERE plan_code = 'free'`
    );
    const freePlanId = freePlanResult.rows[0].id;

    // 更新旧订阅为过期
    await pool.query(`
      UPDATE user_subscriptions SET status = 'expired' WHERE user_id = $1 AND status = 'active'
    `, [testUserId]);

    // 创建免费版订阅
    await pool.query(`
      INSERT INTO user_subscriptions (user_id, plan_id, status, start_date, end_date, quota_reset_anchor, quota_cycle_type)
      VALUES ($1, $2, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '100 years', CURRENT_TIMESTAMP, 'monthly')
    `, [testUserId, freePlanId]);

    log('执行到期处理（退回免费版）');

    // 5. 获取到期后的订阅信息
    const afterSub = await subscriptionService.getUserActiveSubscription(testUserId);
    log(`到期后套餐: ${afterSub?.plan?.plan_name || '无'}`);

    // 6. 获取免费版配额
    const freeStats = await subscriptionService.getUserUsageStats(testUserId);
    log('免费版配额:');
    for (const stat of freeStats) {
      log(`  - ${stat.feature_name}: ${stat.used}/${stat.limit}`);
    }

    // 验证已退回免费版
    const isFreePlan = afterSub?.plan?.plan_code === 'free';
    addResult('到期退回免费版', isFreePlan, isFreePlan ? '已正确退回免费版' : '未正确退回免费版');

    // 验证配额是免费版配额
    const freePlanFeatures = await pool.query(`
      SELECT feature_code, feature_value FROM plan_features WHERE plan_id = $1
    `, [freePlanId]);

    let quotaCorrect = true;
    for (const feature of freePlanFeatures.rows) {
      const stat = freeStats.find(s => s.feature_code === feature.feature_code);
      if (stat && stat.limit !== feature.feature_value) {
        quotaCorrect = false;
        log(`  ⚠️ ${feature.feature_code}: 期望 ${feature.feature_value}, 实际 ${stat?.limit}`);
      }
    }
    addResult('免费版配额正确', quotaCorrect, quotaCorrect ? '配额与免费版一致' : '配额不正确');

    // 清理测试数据
    await pool.query(`DELETE FROM user_usage WHERE user_id = $1`, [testUserId]);
    await pool.query(`DELETE FROM user_subscriptions WHERE user_id = $1`, [testUserId]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [testUserId]);
    log('清理测试数据完成');

  } catch (error: any) {
    addResult('到期测试', false, `错误: ${error.message}`);
  }
}

async function testTimeConsistency() {
  log('\n========== 测试时间一致性 ==========');
  
  // 获取有活跃订阅的用户
  const usersResult = await pool.query(`
    SELECT us.user_id, u.username, us.end_date as subscription_end
    FROM user_subscriptions us
    JOIN users u ON u.id = us.user_id
    WHERE us.status = 'active'
    LIMIT 3
  `);

  for (const user of usersResult.rows) {
    log(`\n--- 用户: ${user.username} ---`);
    
    // 获取三个时间点
    const periodResult = await pool.query(
      `SELECT period_end FROM get_user_quota_period($1, 'articles_per_month') LIMIT 1`,
      [user.user_id]
    );
    
    const resetTimeResult = await pool.query(
      `SELECT get_next_quota_reset_time($1) as next_reset`,
      [user.user_id]
    );

    const subscriptionEnd = new Date(user.subscription_end);
    const periodEnd = periodResult.rows[0] ? new Date(periodResult.rows[0].period_end) : null;
    const nextReset = resetTimeResult.rows[0].next_reset ? new Date(resetTimeResult.rows[0].next_reset) : null;

    log(`  订阅到期: ${subscriptionEnd.toISOString()}`);
    log(`  周期结束: ${periodEnd?.toISOString() || 'N/A'}`);
    log(`  下次重置: ${nextReset?.toISOString() || 'N/A'}`);

    // 验证时间一致性
    if (periodEnd && nextReset) {
      // 周期结束不应超过订阅到期
      const periodValid = periodEnd <= subscriptionEnd;
      // 下次重置应该是周期结束后1秒
      const resetValid = Math.abs(nextReset.getTime() - periodEnd.getTime() - 1000) < 1000;

      addResult(`${user.username} 时间一致性`, periodValid && resetValid, 
        periodValid && resetValid ? '三个时间点一致' : '时间不一致');
    }
  }
}

async function main() {
  console.log('====================================');
  console.log('  订阅配额重置测试');
  console.log('====================================\n');

  try {
    await testAllPlansQuota();
    await testQuotaPeriodCalculation();
    await testSubscriptionRenewal();
    await testSubscriptionExpiration();
    await testTimeConsistency();

    // 输出测试结果汇总
    console.log('\n====================================');
    console.log('  测试结果汇总');
    console.log('====================================');
    
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    
    console.log(`\n总计: ${results.length} 项测试`);
    console.log(`✅ 通过: ${passed}`);
    console.log(`❌ 失败: ${failed}`);

    if (failed > 0) {
      console.log('\n失败的测试:');
      results.filter(r => !r.passed).forEach(r => {
        console.log(`  - ${r.name}: ${r.message}`);
      });
    }

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('测试执行失败:', error);
    process.exit(1);
  }
}

main();
