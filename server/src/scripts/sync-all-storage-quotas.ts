/**
 * 同步所有用户的存储配额
 */

import { pool } from '../db/database';

async function syncAllStorageQuotas() {
  console.log('=== 同步所有用户的存储配额 ===\n');

  try {
    // 同步所有用户
    const result = await pool.query(`
      UPDATE user_storage_usage
      SET storage_quota_bytes = get_user_storage_quota(user_id),
          last_updated_at = CURRENT_TIMESTAMP
      RETURNING user_id, storage_quota_bytes / (1024 * 1024)::numeric as quota_mb;
    `);
    
    console.log(`✅ 已更新 ${result.rows.length} 个用户的存储配额:\n`);
    result.rows.forEach(row => {
      console.log(`  用户 ${row.user_id}: ${parseFloat(row.quota_mb).toFixed(2)} MB`);
    });

    // 验证关键用户
    console.log('\n=== 验证关键用户 ===\n');
    const verifyResult = await pool.query(`
      SELECT 
        u.username,
        sp.plan_name,
        pf.feature_value as plan_quota,
        usu.storage_quota_bytes / (1024 * 1024)::numeric as actual_quota_mb
      FROM users u
      LEFT JOIN user_storage_usage usu ON u.id = usu.user_id
      LEFT JOIN user_subscriptions us ON u.id = us.user_id 
        AND us.status = 'active' 
        AND us.end_date > CURRENT_TIMESTAMP
      LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
      LEFT JOIN plan_features pf ON sp.id = pf.plan_id 
        AND pf.feature_code = 'storage_space'
      WHERE u.username IN ('testuser2', 'lzc2005')
    `);

    verifyResult.rows.forEach(row => {
      console.log(`${row.username}:`);
      console.log(`  套餐: ${row.plan_name || 'N/A'}`);
      console.log(`  配置: ${row.plan_quota || 'N/A'} MB`);
      console.log(`  实际: ${parseFloat(row.actual_quota_mb).toFixed(2)} MB`);
      console.log('');
    });

    console.log('✅ 同步完成！');

  } catch (error) {
    console.error('同步过程中出错:', error);
  } finally {
    await pool.end();
  }
}

syncAllStorageQuotas();
