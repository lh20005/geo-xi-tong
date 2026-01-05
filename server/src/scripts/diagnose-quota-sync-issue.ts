/**
 * 诊断配额同步问题
 * 检查用户管理中的配额调整是否正确反映到个人中心
 */

import { pool } from '../db/database';

async function diagnoseQuotaSyncIssue() {
  console.log('='.repeat(80));
  console.log('配额同步问题诊断');
  console.log('='.repeat(80));

  try {
    // 1. 检查所有用户的订阅和自定义配额
    console.log('\n1. 检查用户订阅和自定义配额:');
    console.log('-'.repeat(80));
    
    const subscriptionsResult = await pool.query(`
      SELECT 
        us.id as subscription_id,
        us.user_id,
        u.username,
        sp.plan_name,
        us.custom_quotas,
        us.status,
        us.end_date
      FROM user_subscriptions us
      JOIN users u ON us.user_id = u.id
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.status = 'active' AND us.end_date > CURRENT_TIMESTAMP
      ORDER BY us.user_id
    `);

    for (const sub of subscriptionsResult.rows) {
      console.log(`\n用户: ${sub.username} (ID: ${sub.user_id})`);
      console.log(`  套餐: ${sub.plan_name}`);
      console.log(`  订阅状态: ${sub.status}`);
      console.log(`  到期时间: ${sub.end_date}`);
      console.log(`  自定义配额: ${sub.custom_quotas ? JSON.stringify(sub.custom_quotas, null, 2) : '无'}`);
    }

    // 2. 检查套餐默认配额
    console.log('\n\n2. 检查套餐默认配额:');
    console.log('-'.repeat(80));
    
    const planFeaturesResult = await pool.query(`
      SELECT 
        sp.plan_name,
        pf.feature_code,
        pf.feature_name,
        pf.feature_value,
        pf.feature_unit
      FROM subscription_plans sp
      JOIN plan_features pf ON sp.id = pf.plan_id
      WHERE sp.is_active = true
      ORDER BY sp.display_order, pf.feature_code
    `);

    let currentPlan = '';
    for (const feature of planFeaturesResult.rows) {
      if (feature.plan_name !== currentPlan) {
        console.log(`\n${feature.plan_name}:`);
        currentPlan = feature.plan_name;
      }
      console.log(`  ${feature.feature_name} (${feature.feature_code}): ${feature.feature_value} ${feature.feature_unit || ''}`);
    }

    // 3. 模拟 getUserUsageStats 的逻辑（当前实现）
    console.log('\n\n3. 当前 getUserUsageStats 实现的问题:');
    console.log('-'.repeat(80));
    console.log('问题: getUserUsageStats 只从 plan_features 获取 limit，忽略了 custom_quotas');
    console.log('');
    console.log('当前代码逻辑:');
    console.log('  1. 获取用户订阅 -> 得到 plan_id');
    console.log('  2. 获取套餐配置 -> 从 plan_features 获取 feature_value');
    console.log('  3. 返回统计 -> limit = feature.feature_value (❌ 没有检查 custom_quotas)');

    // 4. 展示正确的逻辑应该是什么
    console.log('\n\n4. 正确的逻辑应该是:');
    console.log('-'.repeat(80));
    console.log('  1. 获取用户订阅 -> 得到 plan_id 和 custom_quotas');
    console.log('  2. 获取套餐配置 -> 从 plan_features 获取默认 feature_value');
    console.log('  3. 返回统计 -> limit = custom_quotas[feature_code] ?? feature.feature_value');
    console.log('     (优先使用自定义配额，如果没有则使用默认配额)');

    // 5. 对比每个用户的实际配额和应该显示的配额
    console.log('\n\n5. 配额对比分析:');
    console.log('-'.repeat(80));
    
    for (const sub of subscriptionsResult.rows) {
      console.log(`\n用户: ${sub.username} (ID: ${sub.user_id})`);
      
      // 获取套餐默认配额
      const defaultFeaturesResult = await pool.query(`
        SELECT feature_code, feature_name, feature_value
        FROM plan_features pf
        JOIN user_subscriptions us ON pf.plan_id = us.plan_id
        WHERE us.id = $1
      `, [sub.subscription_id]);

      const customQuotas = sub.custom_quotas || {};
      
      console.log('  功能配额对比:');
      for (const feature of defaultFeaturesResult.rows) {
        const defaultValue = feature.feature_value;
        const customValue = customQuotas[feature.feature_code];
        const actualValue = customValue !== undefined ? customValue : defaultValue;
        
        if (customValue !== undefined) {
          console.log(`    ${feature.feature_name}:`);
          console.log(`      默认配额: ${defaultValue}`);
          console.log(`      自定义配额: ${customValue} ✓`);
          console.log(`      当前显示: ${defaultValue} ❌ (错误！应该显示 ${customValue})`);
        } else {
          console.log(`    ${feature.feature_name}: ${defaultValue} (使用默认配额)`);
        }
      }
    }

    // 6. 检查调整历史
    console.log('\n\n6. 配额调整历史:');
    console.log('-'.repeat(80));
    
    const adjustmentsResult = await pool.query(`
      SELECT 
        sa.id,
        sa.user_id,
        u.username,
        sa.adjustment_type,
        sa.quota_adjustments,
        sa.reason,
        sa.created_at,
        au.username as admin_username
      FROM subscription_adjustments sa
      JOIN users u ON sa.user_id = u.id
      LEFT JOIN users au ON sa.admin_id = au.id
      WHERE sa.adjustment_type = 'quota_adjust'
      ORDER BY sa.created_at DESC
      LIMIT 10
    `);

    if (adjustmentsResult.rows.length === 0) {
      console.log('暂无配额调整记录');
    } else {
      for (const adj of adjustmentsResult.rows) {
        console.log(`\n调整ID: ${adj.id}`);
        console.log(`  用户: ${adj.username} (ID: ${adj.user_id})`);
        console.log(`  操作员: ${adj.admin_username || '系统'}`);
        console.log(`  时间: ${adj.created_at}`);
        console.log(`  原因: ${adj.reason}`);
        console.log(`  调整内容: ${JSON.stringify(adj.quota_adjustments, null, 2)}`);
      }
    }

    console.log('\n\n' + '='.repeat(80));
    console.log('诊断完成');
    console.log('='.repeat(80));
    console.log('\n结论:');
    console.log('  ❌ getUserUsageStats 函数没有考虑 custom_quotas');
    console.log('  ❌ 导致管理员调整的配额无法在个人中心显示');
    console.log('  ✅ 需要修改 SubscriptionService.getUserUsageStats 方法');
    console.log('');

  } catch (error) {
    console.error('诊断失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// 运行诊断
diagnoseQuotaSyncIssue().catch(console.error);
