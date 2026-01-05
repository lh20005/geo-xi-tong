/**
 * 修复数据库中存储空间的单位
 * 将所有 bytes 单位的存储空间配额转换为 MB
 */

import { pool } from '../db/database';

async function fixStorageUnit() {
  console.log('开始修复存储空间单位...\n');

  try {
    // 1. 检查当前状态
    console.log('1. 检查当前存储空间配额状态:');
    const checkResult = await pool.query(`
      SELECT 
        sp.plan_name,
        pf.feature_code,
        pf.feature_value,
        pf.feature_unit,
        CASE 
          WHEN pf.feature_value = -1 THEN '无限制'
          WHEN pf.feature_unit = 'bytes' AND pf.feature_value >= 1073741824 THEN 
            CONCAT(ROUND(pf.feature_value::numeric / 1073741824, 1), ' GB (', pf.feature_value, ' bytes)')
          WHEN pf.feature_unit = 'bytes' THEN 
            CONCAT(ROUND(pf.feature_value::numeric / 1048576, 1), ' MB (', pf.feature_value, ' bytes)')
          WHEN pf.feature_unit = 'MB' AND pf.feature_value >= 1024 THEN
            CONCAT(ROUND(pf.feature_value::numeric / 1024, 1), ' GB (', pf.feature_value, ' MB)')
          ELSE CONCAT(pf.feature_value, ' ', pf.feature_unit)
        END as display_value
      FROM plan_features pf
      JOIN subscription_plans sp ON pf.plan_id = sp.id
      WHERE pf.feature_code = 'storage_space'
      ORDER BY sp.display_order
    `);

    console.log('当前状态:');
    checkResult.rows.forEach(row => {
      console.log(`  ${row.plan_name}: ${row.display_value}`);
    });
    console.log('');

    // 2. 查找需要转换的记录
    const needsConversion = await pool.query(`
      SELECT 
        pf.id,
        sp.plan_name,
        pf.feature_value,
        pf.feature_unit
      FROM plan_features pf
      JOIN subscription_plans sp ON pf.plan_id = sp.id
      WHERE pf.feature_code = 'storage_space' 
        AND pf.feature_unit = 'bytes'
    `);

    if (needsConversion.rows.length === 0) {
      console.log('✅ 所有存储空间配额已经是 MB 单位，无需转换');
      return;
    }

    console.log(`2. 发现 ${needsConversion.rows.length} 条需要转换的记录:\n`);

    // 3. 执行转换
    for (const row of needsConversion.rows) {
      const oldValue = row.feature_value;
      const newValue = oldValue === -1 ? -1 : Math.round((oldValue / (1024 * 1024)) * 100) / 100;

      console.log(`  转换 ${row.plan_name}:`);
      console.log(`    旧值: ${oldValue} bytes`);
      console.log(`    新值: ${newValue} MB`);

      await pool.query(
        `UPDATE plan_features 
         SET feature_value = $1, feature_unit = 'MB'
         WHERE id = $2`,
        [newValue, row.id]
      );

      console.log(`    ✅ 转换完成\n`);
    }

    // 4. 验证结果
    console.log('3. 验证转换结果:');
    const verifyResult = await pool.query(`
      SELECT 
        sp.plan_name,
        pf.feature_value,
        pf.feature_unit,
        CASE 
          WHEN pf.feature_value = -1 THEN '无限制'
          WHEN pf.feature_value >= 1024 THEN 
            CONCAT(ROUND(pf.feature_value::numeric / 1024, 1), ' GB')
          ELSE CONCAT(pf.feature_value, ' MB')
        END as display_value
      FROM plan_features pf
      JOIN subscription_plans sp ON pf.plan_id = sp.id
      WHERE pf.feature_code = 'storage_space'
      ORDER BY sp.display_order
    `);

    console.log('转换后状态:');
    verifyResult.rows.forEach(row => {
      console.log(`  ${row.plan_name}: ${row.display_value} (${row.feature_value} ${row.feature_unit})`);
    });

    console.log('\n✅ 存储空间单位修复完成！');

  } catch (error) {
    console.error('❌ 修复失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// 执行修复
fixStorageUnit().catch(error => {
  console.error('执行失败:', error);
  process.exit(1);
});
