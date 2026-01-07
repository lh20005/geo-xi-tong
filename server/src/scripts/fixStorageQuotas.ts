/**
 * 修复所有用户的存储配额，使其与当前套餐配置一致
 */

import { pool } from '../db/database';

async function fixStorageQuotas() {
  console.log('='.repeat(60));
  console.log('修复存储配额');
  console.log('='.repeat(60));

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 修复所有有活跃订阅的用户的存储配额
    const result = await client.query(`
      UPDATE user_storage_usage usu
      SET storage_quota_bytes = subquery.expected_bytes,
          last_updated_at = CURRENT_TIMESTAMP
      FROM (
        SELECT 
          us.user_id,
          CASE 
            WHEN pf.feature_value = -1 THEN -1
            ELSE pf.feature_value * 1024 * 1024
          END as expected_bytes
        FROM user_subscriptions us
        JOIN plan_features pf ON us.plan_id = pf.plan_id AND pf.feature_code = 'storage_space'
        WHERE us.status = 'active'
      ) subquery
      WHERE usu.user_id = subquery.user_id
      RETURNING usu.user_id, usu.storage_quota_bytes
    `);

    console.log(`\n✅ 已更新 ${result.rowCount} 个用户的存储配额`);

    // 显示更新后的结果
    const verifyResult = await client.query(`
      SELECT 
        u.id as user_id,
        u.username,
        sp.plan_name,
        pf.feature_value as expected_mb,
        ROUND(usu.storage_quota_bytes / 1024.0 / 1024.0, 2) as actual_mb
      FROM users u
      JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
      JOIN subscription_plans sp ON us.plan_id = sp.id
      JOIN plan_features pf ON sp.id = pf.plan_id AND pf.feature_code = 'storage_space'
      LEFT JOIN user_storage_usage usu ON u.id = usu.user_id
      ORDER BY u.id
      LIMIT 20
    `);

    console.log('\n📊 更新后的配额状态:');
    console.log('用户ID | 用户名 | 套餐 | 期望配额 | 实际配额');
    console.log('-'.repeat(60));
    for (const user of verifyResult.rows) {
      const expectedDisplay = user.expected_mb === -1 ? '无限制' : `${user.expected_mb} MB`;
      const actualDisplay = user.actual_mb === null ? '未设置' : `${user.actual_mb} MB`;
      console.log(`${user.user_id.toString().padEnd(6)} | ${user.username.substring(0, 10).padEnd(10)} | ${user.plan_name.padEnd(8)} | ${expectedDisplay.padEnd(10)} | ${actualDisplay}`);
    }

    await client.query('COMMIT');
    console.log('\n✅ 修复完成');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('修复失败:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

fixStorageQuotas();
