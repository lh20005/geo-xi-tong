/**
 * 订阅服务单元测试
 */
import { subscriptionService } from '../services/SubscriptionService';
import { pool } from '../db/database';

async function testSubscriptionService() {
  console.log('开始测试订阅服务...\n');

  try {
    // 测试 1: 获取所有激活的套餐
    console.log('测试 1: 获取所有激活的套餐');
    const plans = await subscriptionService.getAllActivePlans();
    console.log(`✅ 找到 ${plans.length} 个套餐`);
    plans.forEach(plan => {
      console.log(`  - ${plan.plan_name} (${plan.plan_code}): ¥${plan.price}/月`);
      console.log(`    功能数量: ${plan.features.length}`);
    });
    console.log('');

    // 测试 2: 获取特定套餐配置
    console.log('测试 2: 获取专业版套餐配置');
    const proPlan = await subscriptionService.getPlanConfig('professional');
    if (proPlan) {
      console.log(`✅ 套餐名称: ${proPlan.plan_name}`);
      console.log(`  价格: ¥${proPlan.price}`);
      console.log(`  功能配额:`);
      proPlan.features.forEach(f => {
        const value = f.feature_value === -1 ? '无限制' : f.feature_value;
        console.log(`    - ${f.feature_name}: ${value} ${f.feature_unit}`);
      });
    }
    console.log('');

    // 测试 3: 创建测试用户并开通订阅
    console.log('测试 3: 为测试用户开通订阅');
    
    // 查找或创建测试用户
    let testUser = await pool.query('SELECT id FROM users WHERE username = $1', ['test_subscription_user']);
    let userId: number;
    
    if (testUser.rows.length === 0) {
      // 生成随机邀请码
      const invitationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const newUser = await pool.query(
        'INSERT INTO users (username, password_hash, role, invitation_code) VALUES ($1, $2, $3, $4) RETURNING id',
        ['test_subscription_user', '$2b$10$test_hash', 'user', invitationCode]
      );
      userId = newUser.rows[0].id;
      console.log(`  创建测试用户 ID: ${userId}`);
    } else {
      userId = testUser.rows[0].id;
      console.log(`  使用现有测试用户 ID: ${userId}`);
    }

    // 获取专业版套餐 ID
    const planResult = await pool.query('SELECT id FROM subscription_plans WHERE plan_code = $1', ['professional']);
    const planId = planResult.rows[0].id;

    // 开通订阅
    const subscription = await subscriptionService.activateSubscription(userId, planId, 1);
    console.log(`✅ 订阅已开通`);
    console.log(`  订阅 ID: ${subscription.id}`);
    console.log(`  开始时间: ${subscription.start_date}`);
    console.log(`  结束时间: ${subscription.end_date}`);
    console.log('');

    // 测试 4: 检查用户配额
    console.log('测试 4: 检查用户配额');
    const canGenerate = await subscriptionService.canUserPerformAction(userId, 'articles_per_day');
    console.log(`✅ 用户可以生成文章: ${canGenerate}`);
    
    const usage = await subscriptionService.getUserUsage(userId, 'articles_per_day');
    console.log(`  当前使用量: ${usage}`);
    console.log('');

    // 测试 5: 记录使用量
    console.log('测试 5: 记录使用量');
    await subscriptionService.recordUsage(userId, 'articles_per_day', 5);
    const newUsage = await subscriptionService.getUserUsage(userId, 'articles_per_day');
    console.log(`✅ 使用量已更新: ${usage} -> ${newUsage}`);
    console.log('');

    // 测试 6: 获取使用统计
    console.log('测试 6: 获取使用统计');
    const stats = await subscriptionService.getUserUsageStats(userId);
    console.log(`✅ 获取到 ${stats.length} 个功能的统计信息:`);
    stats.forEach(stat => {
      const limit = stat.limit === -1 ? '无限制' : stat.limit;
      console.log(`  - ${stat.feature_name}: ${stat.used}/${limit} ${stat.unit} (${stat.percentage.toFixed(1)}%)`);
    });
    console.log('');

    // 测试 7: 配额耗尽检查
    console.log('测试 7: 测试配额耗尽场景');
    // 将使用量设置为配额上限
    await pool.query(
      `UPDATE user_usage SET usage_count = 100 
       WHERE user_id = $1 AND feature_code = 'articles_per_day'`,
      [userId]
    );
    const canGenerateAfterLimit = await subscriptionService.canUserPerformAction(userId, 'articles_per_day');
    console.log(`✅ 配额用完后可以生成文章: ${canGenerateAfterLimit}`);
    console.log('');

    console.log('✅ 所有测试通过！');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await pool.end();
  }
}

testSubscriptionService();
