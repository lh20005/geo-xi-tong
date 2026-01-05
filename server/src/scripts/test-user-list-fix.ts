/**
 * 测试用户列表订阅套餐显示修复
 */

import { pool } from '../db/database';

async function testUserListFix() {
  console.log('=== 测试用户列表订阅套餐显示修复 ===\n');

  try {
    const page = 1;
    const pageSize = 20;
    const params: any[] = [];
    const whereClause = '';
    const offset = (page - 1) * pageSize;

    console.log('1. 测试修复后的查询：');
    const usersResult = await pool.query(
      `SELECT 
        u.id, u.username, u.invitation_code, u.invited_by_code, u.role, 
        u.is_temp_password, u.created_at, u.updated_at, u.last_login_at,
        COUNT(DISTINCT invited.id) as invited_count,
        latest_sub.plan_name as subscription_plan_name
       FROM users u
       LEFT JOIN users invited ON invited.invited_by_code = u.invitation_code
       LEFT JOIN LATERAL (
         SELECT p.plan_name
         FROM user_subscriptions us
         JOIN subscription_plans p ON p.id = us.plan_id
         WHERE us.user_id = u.id 
           AND us.status = 'active'
           AND (us.end_date IS NULL OR us.end_date > NOW())
         ORDER BY us.created_at DESC
         LIMIT 1
       ) latest_sub ON true
       ${whereClause}
       GROUP BY u.id, latest_sub.plan_name
       ORDER BY u.created_at DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    console.log(`查询返回 ${usersResult.rows.length} 条记录：\n`);
    
    usersResult.rows.forEach((row: any) => {
      console.log(`  用户 ${row.username} (ID: ${row.id}):`);
      console.log(`    - 订阅套餐: ${row.subscription_plan_name || '无订阅'}`);
      console.log(`    - 邀请人数: ${row.invited_count}`);
    });

    // 2. 统计套餐分布
    console.log('\n2. 套餐分布统计：');
    const planCounts: { [key: string]: number } = {};
    usersResult.rows.forEach((row: any) => {
      const planName = row.subscription_plan_name || '无订阅';
      planCounts[planName] = (planCounts[planName] || 0) + 1;
    });

    Object.entries(planCounts).forEach(([plan, count]) => {
      console.log(`  ${plan}: ${count} 个用户`);
    });

    // 3. 检查是否还有"无订阅"的用户
    const noSubCount = usersResult.rows.filter((row: any) => !row.subscription_plan_name).length;
    console.log(`\n3. 无订阅用户数量: ${noSubCount}`);

    if (noSubCount > 0) {
      console.log('\n无订阅的用户列表：');
      usersResult.rows
        .filter((row: any) => !row.subscription_plan_name)
        .forEach((row: any) => {
          console.log(`  - ${row.username} (ID: ${row.id})`);
        });
    }

    // 4. 验证总数
    const countResult = await pool.query('SELECT COUNT(*) as total FROM users');
    const totalUsers = parseInt(countResult.rows[0].total);
    console.log(`\n4. 数据库总用户数: ${totalUsers}`);
    console.log(`   查询返回用户数: ${usersResult.rows.length}`);
    
    if (totalUsers === usersResult.rows.length) {
      console.log('   ✅ 所有用户都已正确显示');
    } else {
      console.log(`   ⚠️  缺少 ${totalUsers - usersResult.rows.length} 个用户`);
    }

  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await pool.end();
  }
}

testUserListFix();
