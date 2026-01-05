import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function testSubscriptionDetail() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('测试用户订阅详情功能...\n');

    // 测试用户 ID 437
    console.log('=== 测试用户 437 ===');
    const result437 = await pool.query(
      'SELECT * FROM get_user_subscription_detail($1)',
      [437]
    );
    
    if (result437.rows.length === 0) {
      console.log('❌ 用户 437 没有活跃的订阅');
      
      // 检查用户是否存在
      const userCheck = await pool.query('SELECT id, username FROM users WHERE id = $1', [437]);
      if (userCheck.rows.length === 0) {
        console.log('   用户 437 不存在');
      } else {
        console.log(`   用户存在: ${userCheck.rows[0].username}`);
        
        // 检查订阅记录
        const subCheck = await pool.query(
          'SELECT id, plan_id, status, start_date, end_date FROM user_subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5',
          [437]
        );
        console.log(`   订阅记录数: ${subCheck.rows.length}`);
        if (subCheck.rows.length > 0) {
          console.log('   最近的订阅:');
          subCheck.rows.forEach(sub => {
            console.log(`     - ID: ${sub.id}, 状态: ${sub.status}, 结束时间: ${sub.end_date}`);
          });
        }
      }
    } else {
      console.log('✅ 成功获取订阅详情');
      console.log(JSON.stringify(result437.rows[0], null, 2));
    }

    console.log('\n=== 测试用户 6591 ===');
    const result6591 = await pool.query(
      'SELECT * FROM get_user_subscription_detail($1)',
      [6591]
    );
    
    if (result6591.rows.length === 0) {
      console.log('❌ 用户 6591 没有活跃的订阅');
      
      // 检查用户是否存在
      const userCheck = await pool.query('SELECT id, username FROM users WHERE id = $1', [6591]);
      if (userCheck.rows.length === 0) {
        console.log('   用户 6591 不存在');
      } else {
        console.log(`   用户存在: ${userCheck.rows[0].username}`);
        
        // 检查订阅记录
        const subCheck = await pool.query(
          'SELECT id, plan_id, status, start_date, end_date FROM user_subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5',
          [6591]
        );
        console.log(`   订阅记录数: ${subCheck.rows.length}`);
        if (subCheck.rows.length > 0) {
          console.log('   最近的订阅:');
          subCheck.rows.forEach(sub => {
            console.log(`     - ID: ${sub.id}, 状态: ${sub.status}, 结束时间: ${sub.end_date}`);
          });
        }
      }
    } else {
      console.log('✅ 成功获取订阅详情');
      console.log(JSON.stringify(result6591.rows[0], null, 2));
    }

    // 查找有活跃订阅的用户
    console.log('\n=== 查找有活跃订阅的用户 ===');
    const activeUsers = await pool.query(
      `SELECT DISTINCT u.id, u.username, us.status, us.end_date
       FROM users u
       JOIN user_subscriptions us ON us.user_id = u.id
       WHERE us.status = 'active' AND us.end_date > CURRENT_TIMESTAMP
       ORDER BY u.id
       LIMIT 5`
    );
    
    if (activeUsers.rows.length === 0) {
      console.log('❌ 没有找到任何活跃订阅的用户');
    } else {
      console.log(`✅ 找到 ${activeUsers.rows.length} 个有活跃订阅的用户:`);
      activeUsers.rows.forEach(user => {
        console.log(`   - 用户 ${user.id} (${user.username}): 状态=${user.status}, 结束时间=${user.end_date}`);
      });
      
      // 测试第一个用户
      if (activeUsers.rows.length > 0) {
        const testUserId = activeUsers.rows[0].id;
        console.log(`\n=== 测试用户 ${testUserId} 的详情 ===`);
        const testResult = await pool.query(
          'SELECT * FROM get_user_subscription_detail($1)',
          [testUserId]
        );
        if (testResult.rows.length > 0) {
          console.log('✅ 成功获取订阅详情');
          console.log(JSON.stringify(testResult.rows[0], null, 2));
        }
      }
    }

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await pool.end();
  }
}

testSubscriptionDetail();
