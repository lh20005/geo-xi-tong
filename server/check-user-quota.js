const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: 'postgresql://lzc@localhost:5432/geo_system'
});

async function check() {
  // 查询用户信息
  const userResult = await pool.query("SELECT id, username FROM users WHERE username = 'lzc2005'");
  console.log('用户信息:', userResult.rows);
  
  if (userResult.rows.length === 0) {
    console.log('用户不存在');
    return;
  }
  
  const userId = userResult.rows[0].id;
  
  // 直接调用 check_user_quota 函数
  console.log('\n===== 调用 check_user_quota 函数 =====');
  const quotaResult = await pool.query('SELECT * FROM check_user_quota($1, $2)', [userId, 'platform_accounts']);
  console.log('check_user_quota 结果:', quotaResult.rows);
  
  // 检查订阅状态
  console.log('\n===== 检查订阅状态 =====');
  const subResult = await pool.query(`
    SELECT 
      us.id,
      us.status,
      us.end_date,
      us.end_date > CURRENT_TIMESTAMP as is_valid,
      CURRENT_TIMESTAMP as current_time
    FROM user_subscriptions us 
    WHERE us.user_id = $1 AND us.status = 'active'
  `, [userId]);
  console.log('订阅状态:', subResult.rows);
  
  // 检查 plan_features
  console.log('\n===== 检查 plan_features =====');
  const featuresResult = await pool.query(`
    SELECT pf.* 
    FROM plan_features pf 
    JOIN user_subscriptions us ON pf.plan_id = us.plan_id 
    WHERE us.user_id = $1 AND us.status = 'active' AND pf.feature_code = 'platform_accounts'
  `, [userId]);
  console.log('plan_features:', featuresResult.rows);
  
  // 检查 user_usage
  console.log('\n===== 检查 user_usage =====');
  const usageResult = await pool.query(`
    SELECT * FROM user_usage 
    WHERE user_id = $1 AND feature_code = 'platform_accounts'
    ORDER BY period_start DESC
    LIMIT 5
  `, [userId]);
  console.log('user_usage:', usageResult.rows);
  
  await pool.end();
}

check().catch(console.error);
