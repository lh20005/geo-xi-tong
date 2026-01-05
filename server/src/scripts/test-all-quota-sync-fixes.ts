/**
 * 全面测试配额同步修复
 * 验证所有使用配额的地方都正确考虑了 custom_quotas
 */

import { pool } from '../db/database';
import { subscriptionService } from '../services/SubscriptionService';

async function testAllQuotaSyncFixes() {
  console.log('='.repeat(80));
  console.log('全面测试配额同步修复');
  console.log('='.repeat(80));

  try {
    // 1. 准备测试数据
    console.log('\n1. 准备测试数据:');
    console.log('-'.repeat(80));
    
    const testUserResult = await pool.query(`
      SELECT 
        us.id as subscription_id,
        us.user_id,
        u.username,
        us.custom_quotas,
        sp.plan_name,
        sp.plan_code
      FROM user_subscriptions us
      JOIN users u ON us.user_id = u.id
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.status = 'active' 
        AND us.end_date > CURRENT_TIMESTAMP
        AND us.custom_quotas IS NOT NULL
      LIMIT 1
    `);

    if (testUserResult.rows.length === 0) {
      console.log('❌ 没有找到有自定义配额的用户');
      console.log('提示: 请先在用户管理中调整某个用户的配额');
      return;
    }

    const testUser = testUserResult.rows[0];
    console.log(`✅ 测试用户: ${testUser.username} (ID: ${testUser.user_id})`);
    console.log(`   套餐: ${testUser.plan_name}`);
    console.log(`   自定义配额: ${JSON.stringify(testUser.custom_quotas, null, 2)}`);

    // 找到一个有自定义配额的功能
    const customFeatureCode = Object.keys(testUser.custom_quotas)[0];
    const customFeatureValue = testUser.custom_quotas[customFeatureCode];
    
    console.log(`\n   测试功能: ${customFeatureCode}`);
    console.log(`   自定义值: ${customFeatureValue}`);

    // 2. 测试 getUserUsageStats
    console.log('\n\n2. 测试 getUserUsageStats (个人中心显示):');
    console.log('-'.repeat(80));
    
    const stats = await subscriptionService.getUserUsageStats(testUser.user_id);
    const targetStat = stats.find(s => s.feature_code === customFeatureCode);
    
    if (targetStat) {
      console.log(`功能: ${targetStat.feature_name}`);
      console.log(`  配额限制: ${targetStat.limit}`);
      console.log(`  期望值: ${customFeatureValue}`);
      
      if (targetStat.limit === customFeatureValue) {
        console.log(`  ✅ getUserUsageStats 正确使用自定义配额`);
      } else {
        console.log(`  ❌ getUserUsageStats 未使用自定义配额`);
      }
    } else {
      console.log(`❌ 未找到功能 ${customFeatureCode} 的统计信息`);
    }

    // 3. 测试 canUserPerformAction
    console.log('\n\n3. 测试 canUserPerformAction (配额检查):');
    console.log('-'.repeat(80));
    
    // 获取当前使用量
    const usageResult = await pool.query(
      `SELECT usage_count FROM user_usage 
       WHERE user_id = $1 AND feature_code = $2 
       AND period_end > CURRENT_TIMESTAMP`,
      [testUser.user_id, customFeatureCode]
    );
    
    const currentUsage = usageResult.rows[0]?.usage_count || 0;
    console.log(`当前使用量: ${currentUsage}`);
    console.log(`自定义配额: ${customFeatureValue}`);
    
    const canPerform = await subscriptionService.canUserPerformAction(
      testUser.user_id, 
      customFeatureCode as any
    );
    
    const shouldAllow = currentUsage < customFeatureValue;
    console.log(`期望结果: ${shouldAllow ? '允许' : '拒绝'}`);
    console.log(`实际结果: ${canPerform ? '允许' : '拒绝'}`);
    
    if (canPerform === shouldAllow) {
      console.log(`✅ canUserPerformAction 正确使用自定义配额`);
    } else {
      console.log(`❌ canUserPerformAction 未正确使用自定义配额`);
    }

    // 4. 测试数据库函数 check_user_quota
    console.log('\n\n4. 测试数据库函数 check_user_quota:');
    console.log('-'.repeat(80));
    
    const dbCheckResult = await pool.query(
      `SELECT check_user_quota($1, $2, 1) as can_use`,
      [testUser.user_id, customFeatureCode]
    );
    
    const dbCanUse = dbCheckResult.rows[0]?.can_use;
    console.log(`数据库函数返回: ${dbCanUse ? '允许' : '拒绝'}`);
    console.log(`期望结果: ${shouldAllow ? '允许' : '拒绝'}`);
    
    if (dbCanUse === shouldAllow) {
      console.log(`✅ check_user_quota 正确使用自定义配额`);
    } else {
      console.log(`❌ check_user_quota 未正确使用自定义配额`);
    }

    // 5. 测试 get_user_subscription_detail 视图
    console.log('\n\n5. 测试 get_user_subscription_detail 函数:');
    console.log('-'.repeat(80));
    
    const detailResult = await pool.query(
      `SELECT * FROM get_user_subscription_detail($1)`,
      [testUser.user_id]
    );
    
    if (detailResult.rows.length > 0) {
      const detail = detailResult.rows[0];
      const features = detail.features;
      
      if (Array.isArray(features)) {
        const targetFeature = features.find((f: any) => f.feature_code === customFeatureCode);
        
        if (targetFeature) {
          console.log(`功能: ${targetFeature.feature_name}`);
          console.log(`  配额值: ${targetFeature.feature_value}`);
          console.log(`  期望值: ${customFeatureValue}`);
          
          if (targetFeature.feature_value === customFeatureValue) {
            console.log(`  ✅ get_user_subscription_detail 正确返回自定义配额`);
          } else {
            console.log(`  ❌ get_user_subscription_detail 未返回自定义配额`);
          }
        }
      }
    }

    // 6. 汇总结果
    console.log('\n\n' + '='.repeat(80));
    console.log('测试汇总');
    console.log('='.repeat(80));
    
    const results = [
      { name: 'getUserUsageStats (个人中心)', status: targetStat?.limit === customFeatureValue },
      { name: 'canUserPerformAction (配额检查)', status: canPerform === shouldAllow },
      { name: 'check_user_quota (数据库函数)', status: dbCanUse === shouldAllow },
    ];
    
    console.log('\n测试结果:');
    results.forEach(r => {
      console.log(`  ${r.status ? '✅' : '❌'} ${r.name}`);
    });
    
    const allPassed = results.every(r => r.status);
    
    if (allPassed) {
      console.log('\n🎉 所有测试通过！配额同步已完全修复！');
    } else {
      console.log('\n⚠️  部分测试失败，请检查相关代码');
    }

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('测试失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// 运行测试
testAllQuotaSyncFixes().catch(console.error);
