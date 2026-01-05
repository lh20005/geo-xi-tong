/**
 * 检查免费版套餐的实际配额配置
 */

import { pool } from '../db/database';

async function checkFreePlanQuotas() {
  console.log('========================================');
  console.log('检查免费版套餐配额配置');
  console.log('========================================\n');

  try {
    // 查询免费版套餐
    const planResult = await pool.query(
      `SELECT id, plan_code, plan_name, price FROM subscription_plans WHERE plan_code = 'free'`
    );

    if (planResult.rows.length === 0) {
      console.log('❌ 免费版套餐不存在');
      process.exit(1);
    }

    const plan = planResult.rows[0];
    console.log('免费版套餐信息:');
    console.log(`  ID: ${plan.id}`);
    console.log(`  代码: ${plan.plan_code}`);
    console.log(`  名称: ${plan.plan_name}`);
    console.log(`  价格: ${plan.price}\n`);

    // 查询配额配置
    const featuresResult = await pool.query(
      `SELECT feature_code, feature_name, feature_value, feature_unit 
       FROM plan_features 
       WHERE plan_id = $1 
       ORDER BY id`,
      [plan.id]
    );

    console.log('配额配置:');
    console.log('----------------------------------------');
    
    if (featuresResult.rows.length === 0) {
      console.log('❌ 没有配置任何功能配额');
    } else {
      for (const feature of featuresResult.rows) {
        console.log(`${feature.feature_name}:`);
        console.log(`  代码: ${feature.feature_code}`);
        console.log(`  配额: ${feature.feature_value} ${feature.feature_unit}`);
        console.log('');
      }
    }

    console.log('========================================\n');
  } catch (error) {
    console.error('❌ 查询失败:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkFreePlanQuotas();
