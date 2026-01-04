/**
 * 验证存储空间配置
 */

import { pool } from '../db/database';

async function verifyStorageConfig() {
  console.log('========================================');
  console.log('存储空间配置验证');
  console.log('========================================\n');

  try {
    // 检查套餐中的存储空间配置
    const result = await pool.query(`
      SELECT 
        sp.plan_name,
        sp.plan_code,
        pf.feature_name,
        pf.feature_value,
        pf.feature_unit,
        CASE 
          WHEN pf.feature_value = -1 THEN '无限制'
          ELSE pf.feature_value || ' ' || pf.feature_unit
        END as display_value
      FROM plan_features pf
      JOIN subscription_plans sp ON pf.plan_id = sp.id
      WHERE pf.feature_code = 'storage_space'
      ORDER BY sp.display_order
    `);

    if (result.rows.length === 0) {
      console.log('❌ 未找到存储空间配置');
      process.exit(1);
    }

    console.log('✅ 数据库配置:');
    console.table(result.rows);

    // 检查单位
    const allMB = result.rows.every(r => r.feature_unit === 'MB');
    if (allMB) {
      console.log('\n✅ 单位正确: 所有套餐都使用 MB\n');
    } else {
      console.log('\n❌ 单位错误: 存在非 MB 单位\n');
      process.exit(1);
    }

    console.log('========================================');
    console.log('验证通过！');
    console.log('========================================\n');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ 验证失败:', error);
    await pool.end();
    process.exit(1);
  }
}

verifyStorageConfig();
