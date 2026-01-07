/**
 * 清理重复的 active 订阅
 * 每个用户只保留 end_date 最新的一个 active 订阅
 */

import { pool } from '../db/database';

async function cleanupDuplicateSubscriptions() {
  console.log('='.repeat(60));
  console.log('清理重复的 active 订阅');
  console.log('='.repeat(60));

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 找出有多个 active 订阅的用户
    const multiActive = await client.query(`
      SELECT user_id, COUNT(*) as active_count
      FROM user_subscriptions
      WHERE status = 'active'
      GROUP BY user_id
      HAVING COUNT(*) > 1
    `);

    console.log(`\n发现 ${multiActive.rows.length} 个用户有多个 active 订阅`);

    for (const row of multiActive.rows) {
      const userId = row.user_id;
      
      // 获取该用户所有 active 订阅，按 end_date 降序
      const subs = await client.query(`
        SELECT us.id, us.plan_id, sp.plan_name, us.end_date
        FROM user_subscriptions us
        JOIN subscription_plans sp ON us.plan_id = sp.id
        WHERE us.user_id = $1 AND us.status = 'active'
        ORDER BY us.end_date DESC
      `, [userId]);

      console.log(`\n用户 ${userId} 的 active 订阅:`);
      for (let i = 0; i < subs.rows.length; i++) {
        const sub = subs.rows[i];
        const keep = i === 0 ? '✅ 保留' : '❌ 取消';
        console.log(`  ${keep} ID: ${sub.id}, 套餐: ${sub.plan_name}, 结束: ${sub.end_date}`);
      }

      // 将除了最新的之外的所有订阅标记为 expired
      if (subs.rows.length > 1) {
        const keepId = subs.rows[0].id;
        const cancelIds = subs.rows.slice(1).map(s => s.id);
        
        await client.query(`
          UPDATE user_subscriptions 
          SET status = 'expired', updated_at = CURRENT_TIMESTAMP
          WHERE id = ANY($1)
        `, [cancelIds]);
        
        console.log(`  已将 ${cancelIds.length} 个旧订阅标记为 expired`);
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ 清理完成');

    // 重新运行配额修复
    console.log('\n' + '='.repeat(60));
    console.log('重新同步存储配额');
    console.log('='.repeat(60));

    await client.query('BEGIN');

    const fixResult = await client.query(`
      UPDATE user_storage_usage usu
      SET storage_quota_bytes = subquery.expected_bytes,
          last_updated_at = CURRENT_TIMESTAMP
      FROM (
        SELECT DISTINCT ON (us.user_id)
          us.user_id,
          CASE 
            WHEN pf.feature_value = -1 THEN -1
            ELSE pf.feature_value * 1024 * 1024
          END as expected_bytes
        FROM user_subscriptions us
        JOIN plan_features pf ON us.plan_id = pf.plan_id AND pf.feature_code = 'storage_space'
        WHERE us.status = 'active'
        ORDER BY us.user_id, us.end_date DESC
      ) subquery
      WHERE usu.user_id = subquery.user_id
      RETURNING usu.user_id, usu.storage_quota_bytes
    `);

    console.log(`\n✅ 已更新 ${fixResult.rowCount} 个用户的存储配额`);

    await client.query('COMMIT');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('清理失败:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanupDuplicateSubscriptions();
