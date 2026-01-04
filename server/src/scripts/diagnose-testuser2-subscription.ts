import { pool } from '../db/database';

/**
 * 诊断 testuser2 的订阅和配额问题
 */
async function diagnoseTestuser2() {
  const client = await pool.connect();
  
  try {
    console.log('=== 开始诊断 testuser2 的订阅问题 ===\n');
    
    // 1. 查找用户
    const userResult = await client.query(
      `SELECT id, username, email, role, created_at FROM users WHERE username = 'testuser2'`
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ 未找到 testuser2 用户');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('✅ 找到用户:');
    console.log(JSON.stringify(user, null, 2));
    console.log('');
    
    // 2. 查找订阅记录
    const subscriptionResult = await client.query(
      `SELECT 
        us.id,
        us.user_id,
        us.plan_id,
        us.status,
        us.start_date,
        us.end_date,
        us.created_at,
        sp.plan_code,
        sp.plan_name,
        sp.price
      FROM user_subscriptions us
      LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.user_id = $1
      ORDER BY us.created_at DESC`,
      [user.id]
    );
    
    console.log(`📋 订阅记录 (${subscriptionResult.rows.length} 条):`);
    if (subscriptionResult.rows.length > 0) {
      console.log(JSON.stringify(subscriptionResult.rows, null, 2));
    } else {
      console.log('  无订阅记录');
    }
    console.log('');
    
    // 3. 查找订单记录
    const orderResult = await client.query(
      `SELECT 
        o.id,
        o.order_no,
        o.user_id,
        o.plan_id,
        o.amount,
        o.status,
        o.order_type,
        o.created_at,
        o.paid_at,
        sp.plan_code,
        sp.plan_name
      FROM orders o
      LEFT JOIN subscription_plans sp ON o.plan_id = sp.id
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC`,
      [user.id]
    );
    
    console.log(`💰 订单记录 (${orderResult.rows.length} 条):`);
    if (orderResult.rows.length > 0) {
      console.log(JSON.stringify(orderResult.rows, null, 2));
    } else {
      console.log('  无订单记录');
    }
    console.log('');
    
    // 4. 查找配额记录
    const quotaResult = await client.query(
      `SELECT 
        uq.id,
        uq.user_id,
        uq.feature_code,
        uq.quota_limit,
        uq.used_count,
        uq.period_start,
        uq.period_end,
        uq.created_at,
        uq.updated_at
      FROM user_quotas uq
      WHERE uq.user_id = $1
      ORDER BY uq.feature_code`,
      [user.id]
    );
    
    console.log(`📊 配额记录 (${quotaResult.rows.length} 条):`);
    if (quotaResult.rows.length > 0) {
      console.log(JSON.stringify(quotaResult.rows, null, 2));
    } else {
      console.log('  ❌ 无配额记录 - 这是问题所在！');
    }
    console.log('');
    
    // 5. 如果有激活的订阅但没有配额，查看套餐的功能配置
    const activeSubscription = subscriptionResult.rows.find(s => s.status === 'active');
    if (activeSubscription) {
      console.log('✅ 找到激活的订阅，查看套餐功能配置:');
      
      const featuresResult = await client.query(
        `SELECT 
          pf.id,
          pf.plan_id,
          pf.feature_code,
          pf.feature_name,
          pf.feature_value,
          pf.feature_unit
        FROM plan_features pf
        WHERE pf.plan_id = $1
        ORDER BY pf.feature_code`,
        [activeSubscription.plan_id]
      );
      
      console.log(`  套餐功能 (${featuresResult.rows.length} 条):`);
      if (featuresResult.rows.length > 0) {
        console.log(JSON.stringify(featuresResult.rows, null, 2));
      } else {
        console.log('    ❌ 套餐没有配置功能！');
      }
      console.log('');
      
      // 6. 检查是否需要初始化配额
      if (quotaResult.rows.length === 0 && featuresResult.rows.length > 0) {
        console.log('🔧 检测到需要初始化配额...');
        console.log('');
        
        // 计算周期
        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        
        console.log('📅 配额周期:');
        console.log(`  开始: ${periodStart.toISOString()}`);
        console.log(`  结束: ${periodEnd.toISOString()}`);
        console.log('');
        
        console.log('💡 建议执行以下操作来修复:');
        console.log('  1. 为用户初始化配额记录');
        console.log('  2. 根据套餐功能配置设置配额限制');
        console.log('');
        
        return {
          user,
          subscription: activeSubscription,
          features: featuresResult.rows,
          needsQuotaInit: true
        };
      }
    } else {
      console.log('❌ 没有找到激活的订阅');
    }
    
    console.log('=== 诊断完成 ===');
    
  } catch (error) {
    console.error('❌ 诊断过程中出错:', error);
    throw error;
  } finally {
    client.release();
  }
}

// 执行诊断
diagnoseTestuser2()
  .then(() => {
    console.log('\n✅ 诊断完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 诊断失败:', error);
    process.exit(1);
  });
