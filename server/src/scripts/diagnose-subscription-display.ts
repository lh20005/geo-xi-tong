/**
 * 诊断用户订阅套餐显示问题
 */

import { pool } from '../db/database';

async function diagnoseSubscriptionDisplay() {
  console.log('=== 诊断用户订阅套餐显示问题 ===\n');

  try {
    // 1. 检查所有用户的订阅状态
    console.log('1. 检查所有用户的订阅状态：');
    const allUsersResult = await pool.query(`
      SELECT 
        u.id,
        u.username,
        us.id as subscription_id,
        us.status,
        us.start_date,
        us.end_date,
        p.plan_name,
        CASE 
          WHEN us.end_date IS NULL THEN '永久有效'
          WHEN us.end_date > NOW() THEN '未过期'
          ELSE '已过期'
        END as expiration_status
      FROM users u
      LEFT JOIN user_subscriptions us ON us.user_id = u.id
      LEFT JOIN subscription_plans p ON p.id = us.plan_id
      ORDER BY u.id
      LIMIT 20
    `);
    
    console.log(`找到 ${allUsersResult.rows.length} 条记录：`);
    allUsersResult.rows.forEach((row: any) => {
      console.log(`  用户 ${row.username} (ID: ${row.id}):`);
      if (row.subscription_id) {
        console.log(`    - 订阅ID: ${row.subscription_id}`);
        console.log(`    - 套餐: ${row.plan_name}`);
        console.log(`    - 状态: ${row.status}`);
        console.log(`    - 开始: ${row.start_date}`);
        console.log(`    - 结束: ${row.end_date || '永久'}`);
        console.log(`    - 过期状态: ${row.expiration_status}`);
      } else {
        console.log(`    - 无订阅记录`);
      }
    });

    // 2. 检查当前查询逻辑返回的结果
    console.log('\n2. 检查当前查询逻辑（status = active）：');
    const currentQueryResult = await pool.query(`
      SELECT 
        u.id, 
        u.username,
        COUNT(DISTINCT invited.id) as invited_count,
        MAX(p.plan_name) as subscription_plan_name
      FROM users u
      LEFT JOIN users invited ON invited.invited_by_code = u.invitation_code
      LEFT JOIN user_subscriptions us ON us.user_id = u.id AND us.status = 'active'
      LEFT JOIN subscription_plans p ON p.id = us.plan_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT 20
    `);
    
    console.log(`当前查询返回 ${currentQueryResult.rows.length} 条记录：`);
    currentQueryResult.rows.forEach((row: any) => {
      console.log(`  ${row.username}: ${row.subscription_plan_name || '无订阅'}`);
    });

    // 3. 检查订阅状态的分布
    console.log('\n3. 检查订阅状态分布：');
    const statusDistResult = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM user_subscriptions
      GROUP BY status
    `);
    
    console.log('订阅状态统计：');
    statusDistResult.rows.forEach((row: any) => {
      console.log(`  ${row.status}: ${row.count} 条`);
    });

    // 4. 检查是否有过期但状态仍为active的订阅
    console.log('\n4. 检查过期但状态为active的订阅：');
    const expiredActiveResult = await pool.query(`
      SELECT 
        us.id,
        u.username,
        p.plan_name,
        us.status,
        us.end_date,
        NOW() as current_time
      FROM user_subscriptions us
      JOIN users u ON u.id = us.user_id
      JOIN subscription_plans p ON p.id = us.plan_id
      WHERE us.status = 'active' 
        AND us.end_date IS NOT NULL 
        AND us.end_date < NOW()
    `);
    
    if (expiredActiveResult.rows.length > 0) {
      console.log(`找到 ${expiredActiveResult.rows.length} 条过期但状态为active的订阅：`);
      expiredActiveResult.rows.forEach((row: any) => {
        console.log(`  ${row.username}: ${row.plan_name}, 过期时间: ${row.end_date}`);
      });
    } else {
      console.log('没有找到过期但状态为active的订阅');
    }

    // 5. 推荐的查询逻辑
    console.log('\n5. 推荐的查询逻辑（考虑过期时间）：');
    const recommendedQueryResult = await pool.query(`
      SELECT 
        u.id, 
        u.username,
        COUNT(DISTINCT invited.id) as invited_count,
        MAX(p.plan_name) as subscription_plan_name
      FROM users u
      LEFT JOIN users invited ON invited.invited_by_code = u.invitation_code
      LEFT JOIN user_subscriptions us ON us.user_id = u.id 
        AND us.status = 'active'
        AND (us.end_date IS NULL OR us.end_date > NOW())
      LEFT JOIN subscription_plans p ON p.id = us.plan_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT 20
    `);
    
    console.log(`推荐查询返回 ${recommendedQueryResult.rows.length} 条记录：`);
    recommendedQueryResult.rows.forEach((row: any) => {
      console.log(`  ${row.username}: ${row.subscription_plan_name || '无订阅'}`);
    });

    // 6. 对比差异
    console.log('\n6. 对比当前查询和推荐查询的差异：');
    const currentMap = new Map(currentQueryResult.rows.map((r: any) => [r.username, r.subscription_plan_name]));
    const recommendedMap = new Map(recommendedQueryResult.rows.map((r: any) => [r.username, r.subscription_plan_name]));
    
    let differenceCount = 0;
    for (const [username, currentPlan] of currentMap) {
      const recommendedPlan = recommendedMap.get(username);
      if (currentPlan !== recommendedPlan) {
        differenceCount++;
        console.log(`  ${username}: "${currentPlan || '无订阅'}" -> "${recommendedPlan || '无订阅'}"`);
      }
    }
    
    if (differenceCount === 0) {
      console.log('  没有差异');
    } else {
      console.log(`\n  共有 ${differenceCount} 个用户的套餐显示不同`);
    }

  } catch (error) {
    console.error('诊断失败:', error);
  } finally {
    await pool.end();
  }
}

diagnoseSubscriptionDisplay();
