/**
 * 检查 lzc2005 用户的问题
 */

import { pool } from '../db/database';

async function checkLzc2005Issue() {
  console.log('=== 检查 lzc2005 用户问题 ===\n');

  try {
    // 1. 查找 lzc2005 用户
    const userResult = await pool.query(
      'SELECT id, username, role FROM users WHERE username = $1',
      ['lzc2005']
    );

    console.log('1️⃣ lzc2005 用户信息:');
    console.log(userResult.rows);
    console.log('');

    if (userResult.rows.length === 0) {
      console.log('未找到 lzc2005 用户');
      return;
    }

    const userId = userResult.rows[0].id;
    const userRole = userResult.rows[0].role;

    // 2. 检查存储记录
    const storageResult = await pool.query(
      'SELECT * FROM user_storage_usage WHERE user_id = $1',
      [userId]
    );

    console.log('2️⃣ 存储记录:');
    console.log(`  配额: ${storageResult.rows[0]?.storage_quota_bytes / (1024 * 1024)} MB`);
    console.log('');

    // 3. 检查用户角色
    console.log('3️⃣ 用户角色:', userRole);
    if (userRole === 'admin') {
      console.log('  ⚠️  这是管理员用户，get_user_storage_quota 函数会返回固定的 1GB');
    }
    console.log('');

    // 4. 测试函数
    const quotaResult = await pool.query(
      'SELECT get_user_storage_quota($1) as quota',
      [userId]
    );
    console.log('4️⃣ 函数返回的配额:', quotaResult.rows[0].quota / (1024 * 1024), 'MB');
    console.log('');

    // 5. 检查订阅
    const subResult = await pool.query(
      `SELECT us.*, sp.plan_name 
       FROM user_subscriptions us
       JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE us.user_id = $1 AND us.status = 'active'
       ORDER BY us.end_date DESC`,
      [userId]
    );

    console.log('5️⃣ 订阅信息:');
    if (subResult.rows.length > 0) {
      subResult.rows.forEach(sub => {
        console.log(`  套餐: ${sub.plan_name}, 结束时间: ${sub.end_date}`);
      });
    } else {
      console.log('  无激活订阅');
    }
    console.log('');

    // 6. 解决方案
    console.log('=== 解决方案 ===');
    if (userRole === 'admin') {
      console.log('lzc2005 是管理员用户，配额固定为 1GB。');
      console.log('如果需要修改管理员的配额，需要：');
      console.log('1. 修改 get_user_storage_quota 函数中的管理员配额逻辑');
      console.log('2. 或者将用户角色改为普通用户');
    } else {
      console.log('需要手动更新存储配额');
    }

  } catch (error) {
    console.error('检查过程中出错:', error);
  } finally {
    await pool.end();
  }
}

checkLzc2005Issue();
