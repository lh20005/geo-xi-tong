/**
 * 检查用户订阅状态
 */

import { pool } from '../db/database';

async function checkUserSubscriptions() {
  try {
    // 检查 lzc2005 用户的所有订阅
    const result = await pool.query(`
      SELECT 
        us.id,
        us.plan_id,
        sp.plan_code,
        sp.plan_name,
        us.status,
        us.start_date,
        us.end_date,
        us.created_at
      FROM user_subscriptions us
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.user_id = 1
      ORDER BY us.end_date DESC
    `);
    
    console.log('用户 lzc2005 的所有订阅记录:');
    console.log('-'.repeat(80));
    for (const row of result.rows) {
      console.log(`ID: ${row.id}, 套餐: ${row.plan_name}, 状态: ${row.status}, 结束: ${row.end_date}`);
    }

    // 检查有多个 active 订阅的用户
    const multiActive = await pool.query(`
      SELECT user_id, COUNT(*) as active_count
      FROM user_subscriptions
      WHERE status = 'active'
      GROUP BY user_id
      HAVING COUNT(*) > 1
    `);

    if (multiActive.rows.length > 0) {
      console.log('\n⚠️ 发现有多个 active 订阅的用户:');
      for (const row of multiActive.rows) {
        console.log(`  用户ID: ${row.user_id}, active 订阅数: ${row.active_count}`);
      }
    }

  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    await pool.end();
  }
}

checkUserSubscriptions();
