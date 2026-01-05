import { pool } from '../db/database';

async function testUserListQuery() {
  try {
    console.log('Testing user list query with subscription plan...');
    
    const whereClause = '';
    const params: any[] = [];
    const pageSize = 10;
    const offset = 0;
    
    const usersResult = await pool.query(
      `SELECT 
        u.id, u.username, u.invitation_code, u.invited_by_code, u.role, 
        u.is_temp_password, u.created_at, u.updated_at, u.last_login_at,
        COUNT(DISTINCT invited.id) as invited_count,
        MAX(p.plan_name) as subscription_plan_name
       FROM users u
       LEFT JOIN users invited ON invited.invited_by_code = u.invitation_code
       LEFT JOIN user_subscriptions us ON us.user_id = u.id AND us.status = 'active'
       LEFT JOIN subscription_plans p ON p.id = us.plan_id
       ${whereClause}
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]
    );
    
    console.log('Query successful!');
    console.log('Results:', JSON.stringify(usersResult.rows, null, 2));
    
  } catch (error: any) {
    console.error('Query failed:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

testUserListQuery();
