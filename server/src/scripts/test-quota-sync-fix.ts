/**
 * 测试配额同步修复
 * 验证用户管理中的配额调整是否正确反映到个人中心
 */

import { pool } from '../db/database';
import { subscriptionService } from '../services/SubscriptionService';

async function testQuotaSyncFix() {
  console.log('='.repeat(80));
  console.log('测试配额同步修复');
  console.log('='.repeat(80));

  try {
    // 1. 找一个有自定义配额的用户
    console.log('\n1. 查找有自定义配额的用户:');
    console.log('-'.repeat(80));
    
    const userWithCustomQuota = await pool.query(`
      SELECT 
        us.user_id,
        u.username,
        us.custom_quotas,
        sp.plan_name
      FROM user_subscriptions us
      JOIN users u ON us.user_id = u.id
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.status = 'active' 
        AND us.end_date > CURRENT_TIMESTAMP
        AND us.custom_quotas IS NOT NULL
      LIMIT 1
    `);

    if (userWithCustomQuota.rows.length === 0) {
      console.log('❌ 没有找到有自定义配额的用户，无法测试');
      console.log('提示: 请先在用户管理中调整某个用户的配额');
      return;
    }

    const testUser = userWithCustomQuota.rows[0];
    console.log(`✅ 找到测试用户: ${testUser.username} (ID: ${testUser.user_id})`);
    console.log(`   套餐: ${testUser.plan_name}`);
    console.log(`   自定义配额: ${JSON.stringify(testUser.custom_quotas, null, 2)}`);

    // 2. 获取套餐默认配额
    console.log('\n2. 获取套餐默认配额:');
    console.log('-'.repeat(80));
    
    const defaultFeatures = await pool.query(`
      SELECT pf.feature_code, pf.feature_name, pf.feature_value
      FROM plan_features pf
      JOIN user_subscriptions us ON pf.plan_id = us.plan_id
      WHERE us.user_id = $1 AND us.status = 'active' AND us.end_date > CURRENT_TIMESTAMP
      ORDER BY us.end_date DESC
      LIMIT 5
    `, [testUser.user_id]);

    console.log('套餐默认配额:');
    for (const feature of defaultFeatures.rows) {
      console.log(`  ${feature.feature_name}: ${feature.feature_value}`);
    }

    // 3. 调用修复后的 getUserUsageStats
    console.log('\n3. 调用修复后的 getUserUsageStats:');
    console.log('-'.repeat(80));
    
    const stats = await subscriptionService.getUserUsageStats(testUser.user_id);
    
    console.log('返回的使用统计:');
    for (const stat of stats) {
      const customValue = testUser.custom_quotas[stat.feature_code];
      const isCustom = customValue !== undefined;
      
      console.log(`\n  ${stat.feature_name} (${stat.feature_code}):`);
      console.log(`    配额限制: ${stat.limit} ${stat.unit || ''}`);
      console.log(`    已使用: ${stat.used} ${stat.unit || ''}`);
      console.log(`    剩余: ${stat.remaining === -1 ? '无限' : stat.remaining} ${stat.unit || ''}`);
      console.log(`    使用率: ${stat.percentage.toFixed(2)}%`);
      
      if (isCustom) {
        console.log(`    ✅ 使用自定义配额: ${customValue}`);
        if (stat.limit === customValue) {
          console.log(`    ✅ 配额显示正确！`);
        } else {
          console.log(`    ❌ 配额显示错误！期望 ${customValue}，实际 ${stat.limit}`);
        }
      } else {
        console.log(`    ℹ️  使用默认配额`);
      }
    }

    // 4. 验证结果
    console.log('\n4. 验证结果:');
    console.log('-'.repeat(80));
    
    let allCorrect = true;
    for (const stat of stats) {
      const customValue = testUser.custom_quotas[stat.feature_code];
      if (customValue !== undefined && stat.limit !== customValue) {
        console.log(`❌ ${stat.feature_name}: 期望 ${customValue}，实际 ${stat.limit}`);
        allCorrect = false;
      }
    }

    if (allCorrect) {
      console.log('✅ 所有自定义配额都正确显示！');
      console.log('✅ 修复成功：用户管理中的配额调整已正确反映到个人中心');
    } else {
      console.log('❌ 部分配额显示不正确，修复失败');
    }

    // 5. 模拟前端 API 调用
    console.log('\n5. 模拟前端 API 调用:');
    console.log('-'.repeat(80));
    console.log('前端调用 GET /api/subscription/usage-stats 时会收到:');
    console.log(JSON.stringify({
      success: true,
      data: {
        features: stats
      }
    }, null, 2));

    console.log('\n' + '='.repeat(80));
    console.log('测试完成');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('测试失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// 运行测试
testQuotaSyncFix().catch(console.error);
