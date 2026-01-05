/**
 * 诊断使用统计 API 错误
 */

import { pool } from '../db/database';

async function diagnoseUsageStatsError() {
  try {
    console.log('='.repeat(80));
    console.log('诊断使用统计 API 错误');
    console.log('='.repeat(80));

    // 1. 检查用户订阅信息
    console.log('\n1. 检查用户订阅信息:');
    console.log('-'.repeat(80));
    
    const userResult = await pool.query(
      `SELECT id, username, email FROM users WHERE username = 'lzc2005'`
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ 用户不存在');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('✅ 用户信息:', user);
    
    // 2. 检查活跃订阅
    console.log('\n2. 检查活跃订阅:');
    console.log('-'.repeat(80));
    
    const subscriptionResult = await pool.query(
      `SELECT 
        us.id,
        us.plan_id,
        us.status,
        us.start_date,
        us.end_date,
        us.custom_quotas,
        sp.plan_code,
        sp.plan_name
      FROM user_subscriptions us
      LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.user_id = $1 
        AND us.status = 'active'
        AND us.end_date > CURRENT_TIMESTAMP
      ORDER BY us.end_date DESC
      LIMIT 1`,
      [user.id]
    );
    
    if (subscriptionResult.rows.length === 0) {
      console.log('❌ 没有活跃订阅');
      return;
    }
    
    const subscription = subscriptionResult.rows[0];
    console.log('✅ 订阅信息:', JSON.stringify(subscription, null, 2));
    
    // 3. 检查套餐功能配置
    console.log('\n3. 检查套餐功能配置:');
    console.log('-'.repeat(80));
    
    const featuresResult = await pool.query(
      `SELECT 
        pf.feature_code,
        pf.feature_name,
        pf.feature_value,
        pf.feature_unit
      FROM plan_features pf
      WHERE pf.plan_id = $1
      ORDER BY pf.feature_code`,
      [subscription.plan_id]
    );
    
    console.log(`✅ 套餐功能 (${featuresResult.rows.length} 个):`);
    featuresResult.rows.forEach(f => {
      console.log(`  - ${f.feature_code}: ${f.feature_name} = ${f.feature_value} ${f.feature_unit}`);
    });
    
    // 4. 检查 FEATURE_DEFINITIONS 中是否有对应定义
    console.log('\n4. 检查功能定义匹配:');
    console.log('-'.repeat(80));
    
    const { FEATURE_DEFINITIONS } = await import('../config/features');
    
    for (const feature of featuresResult.rows) {
      const featureDef = FEATURE_DEFINITIONS[feature.feature_code as keyof typeof FEATURE_DEFINITIONS];
      if (featureDef) {
        console.log(`  ✅ ${feature.feature_code}: 有定义 (resetPeriod: ${featureDef.resetPeriod})`);
      } else {
        console.log(`  ❌ ${feature.feature_code}: 无定义 - 这会导致 500 错误!`);
      }
    }
    
    // 5. 测试 get_next_quota_reset_time 函数
    console.log('\n5. 测试 get_next_quota_reset_time 函数:');
    console.log('-'.repeat(80));
    
    try {
      const resetTimeResult = await pool.query(
        'SELECT get_next_quota_reset_time($1) as next_reset',
        [user.id]
      );
      console.log('✅ 函数调用成功:', resetTimeResult.rows[0]);
    } catch (error: any) {
      console.log('❌ 函数调用失败:', error.message);
    }
    
    // 6. 模拟 getUserUsageStats 逻辑
    console.log('\n6. 模拟 getUserUsageStats 逻辑:');
    console.log('-'.repeat(80));
    
    try {
      const customQuotas = subscription.custom_quotas || {};
      
      for (const feature of featuresResult.rows) {
        console.log(`\n处理功能: ${feature.feature_code}`);
        
        const featureDef = FEATURE_DEFINITIONS[feature.feature_code as keyof typeof FEATURE_DEFINITIONS];
        
        if (!featureDef) {
          console.log(`  ⚠️  跳过 - 无功能定义`);
          continue;
        }
        
        const limit = customQuotas[feature.feature_code] !== undefined 
          ? customQuotas[feature.feature_code] 
          : feature.feature_value;
        
        console.log(`  - 配额限制: ${limit} ${feature.feature_unit}`);
        console.log(`  - 重置周期: ${featureDef.resetPeriod}`);
        
        // 尝试获取重置时间
        try {
          const resetTimeResult = await pool.query(
            'SELECT get_next_quota_reset_time($1) as next_reset',
            [user.id]
          );
          console.log(`  - 下次重置: ${resetTimeResult.rows[0]?.next_reset || '未知'}`);
        } catch (error: any) {
          console.log(`  - 获取重置时间失败: ${error.message}`);
        }
      }
      
      console.log('\n✅ 模拟成功完成');
      
    } catch (error: any) {
      console.log('\n❌ 模拟失败:', error.message);
      console.log('错误堆栈:', error.stack);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('诊断完成');
    console.log('='.repeat(80));
    
  } catch (error: any) {
    console.error('❌ 诊断过程出错:', error.message);
    console.error('错误堆栈:', error.stack);
  } finally {
    await pool.end();
  }
}

diagnoseUsageStatsError();
