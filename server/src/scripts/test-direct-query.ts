/**
 * 直接测试SQL查询
 */

import { pool } from '../db/database';

async function testDirectQuery() {
  console.log('=== 直接测试SQL查询 ===\n');

  try {
    const page = 1;
    const pageSize = 10;
    const offset = (page - 1) * pageSize;
    const params: any[] = [];
    const whereClause = '';

    console.log('1. 测试参数占位符：');
    console.log(`   params.length: ${params.length}`);
    console.log(`   limitParam应该是: $${params.length + 1}`);
    console.log(`   offsetParam应该是: $${params.length + 2}`);

    const limitParam = params.length + 1;
    const offsetParam = params.length + 2;

    const query = `SELECT 
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
       LIMIT $${limitParam} OFFSET $${offsetParam}`;

    console.log('\n2. 生成的SQL查询：');
    console.log(query);

    console.log('\n3. 查询参数：');
    console.log([...params, pageSize, offset]);

    console.log('\n4. 执行查询...');
    const result = await pool.query(query, [...params, pageSize, offset]);

    console.log(`\n5. 查询结果：返回 ${result.rows.length} 条记录`);
    result.rows.forEach((row: any) => {
      console.log(`   ${row.username}: ${row.subscription_plan_name || '无订阅'}`);
    });

  } catch (error: any) {
    console.error('\n❌ 查询失败:', error.message);
    if (error.code) {
      console.error('   错误代码:', error.code);
    }
    if (error.position) {
      console.error('   错误位置:', error.position);
    }
  } finally {
    await pool.end();
  }
}

testDirectQuery();
