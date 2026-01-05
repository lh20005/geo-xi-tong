import { pool } from '../db/database';

/**
 * 测试订阅周期配额重置系统
 */
async function testSubscriptionCycleQuota() {
  const client = await pool.connect();
  
  try {
    console.log('========================================');
    console.log('测试订阅周期配额重置系统');
    console.log('========================================\n');
    
    // 1. 测试不同周期类型的用户
    console.log('1️⃣ 测试场景：创建不同周期的测试用户\n');
    
    // 创建月度测试用户
    const monthlyUserResult = await client.query(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES ('test_monthly_user', 'monthly@test.com', 'hash', 'user')
      ON CONFLICT (username) DO UPDATE SET email = EXCLUDED.email
      RETURNING id
    `);
    const monthlyUserId = monthlyUserResult.rows[0].id;
    
    // 获取月度套餐
    const monthlyPlanResult = await client.query(`
      SELECT id FROM subscription_plans 
      WHERE billing_cycle = 'monthly' AND plan_code != 'free'
      LIMIT 1
    `);
    
    if (monthlyPlanResult.rows.length > 0) {
      const monthlyPlanId = monthlyPlanResult.rows[0].id;
      
      // 创建月度订阅（从15号开始）
      await client.query(`
        INSERT INTO user_subscriptions (
          user_id, plan_id, status, 
          start_date, end_date,
          quota_reset_anchor, quota_cycle_type
        ) VALUES (
          $1, $2, 'active',
          '2026-01-15 00:00:00', '2026-02-15 00:00:00',
          '2026-01-15 00:00:00', 'monthly'
        )
        ON CONFLICT (user_id, plan_id) 
        WHERE status = 'active'
        DO UPDATE SET 
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          quota_reset_anchor = EXCLUDED.quota_reset_anchor,
          quota_cycle_type = EXCLUDED.quota_cycle_type
      `, [monthlyUserId, monthlyPlanId]);
      
      console.log('✅ 创建月度测试用户成功');
      console.log(`   用户ID: ${monthlyUserId}`);
      console.log(`   订阅开始: 2026-01-15`);
      console.log(`   配额重置: 每月15号\n`);
    }
    
    // 创建年度测试用户
    const yearlyUserResult = await client.query(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES ('test_yearly_user', 'yearly@test.com', 'hash', 'user')
      ON CONFLICT (username) DO UPDATE SET email = EXCLUDED.email
      RETURNING id
    `);
    const yearlyUserId = yearlyUserResult.rows[0].id;
    
    // 检查是否有年度套餐
    const yearlyPlanResult = await client.query(`
      SELECT id FROM subscription_plans 
      WHERE billing_cycle = 'yearly'
      LIMIT 1
    `);
    
    if (yearlyPlanResult.rows.length > 0) {
      const yearlyPlanId = yearlyPlanResult.rows[0].id;
      
      // 创建年度订阅（从3月20号开始）
      await client.query(`
        INSERT INTO user_subscriptions (
          user_id, plan_id, status,
          start_date, end_date,
          quota_reset_anchor, quota_cycle_type
        ) VALUES (
          $1, $2, 'active',
          '2025-03-20 00:00:00', '2026-03-20 00:00:00',
          '2025-03-20 00:00:00', 'yearly'
        )
        ON CONFLICT (user_id, plan_id)
        WHERE status = 'active'
        DO UPDATE SET
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          quota_reset_anchor = EXCLUDED.quota_reset_anchor,
          quota_cycle_type = EXCLUDED.quota_cycle_type
      `, [yearlyUserId, yearlyPlanId]);
      
      console.log('✅ 创建年度测试用户成功');
      console.log(`   用户ID: ${yearlyUserId}`);
      console.log(`   订阅开始: 2025-03-20`);
      console.log(`   配额重置: 每年3月20日\n`);
    } else {
      console.log('⚠️  没有年度套餐，跳过年度用户测试\n');
    }
    
    // 2. 测试配额周期计算
    console.log('2️⃣ 测试场景：计算配额周期\n');
    
    const periodResult = await client.query(`
      SELECT 
        u.username,
        us.quota_cycle_type,
        us.quota_reset_anchor,
        p.*
      FROM users u
      JOIN user_subscriptions us ON us.user_id = u.id
      CROSS JOIN LATERAL get_user_quota_period(u.id, 'articles_per_month') p
      WHERE u.username IN ('test_monthly_user', 'test_yearly_user')
        AND us.status = 'active'
    `);
    
    console.log('配额周期计算结果：');
    periodResult.rows.forEach(row => {
      console.log(`\n  用户: ${row.username}`);
      console.log(`  周期类型: ${row.cycle_type}`);
      console.log(`  重置锚点: ${row.quota_reset_anchor}`);
      console.log(`  当前周期开始: ${row.period_start}`);
      console.log(`  当前周期结束: ${row.period_end}`);
      console.log(`  订阅结束: ${row.subscription_end}`);
    });
    
    // 3. 测试配额重置描述
    console.log('\n3️⃣ 测试场景：配额重置描述\n');
    
    const descResult = await client.query(`
      SELECT 
        u.username,
        get_quota_reset_description(u.id) as reset_description,
        get_next_quota_reset_time(u.id) as next_reset_time
      FROM users u
      WHERE u.username IN ('test_monthly_user', 'test_yearly_user')
    `);
    
    console.log('配额重置信息：');
    descResult.rows.forEach(row => {
      console.log(`\n  用户: ${row.username}`);
      console.log(`  重置规则: ${row.reset_description}`);
      console.log(`  下次重置: ${row.next_reset_time}`);
    });
    
    // 4. 测试配额使用记录
    console.log('\n4️⃣ 测试场景：记录配额使用\n');
    
    if (monthlyPlanResult.rows.length > 0) {
      // 记录月度用户的使用量
      await client.query(`
        SELECT record_feature_usage($1, 'articles_per_month', 5)
      `, [monthlyUserId]);
      
      console.log('✅ 记录月度用户使用量: 5篇文章');
      
      // 检查使用量
      const usageResult = await client.query(`
        SELECT * FROM check_feature_quota($1, 'articles_per_month', 1)
      `, [monthlyUserId]);
      
      const usage = usageResult.rows[0];
      console.log(`   当前使用: ${usage.current_usage}`);
      console.log(`   配额限制: ${usage.quota_limit}`);
      console.log(`   剩余配额: ${usage.remaining}`);
      console.log(`   是否允许: ${usage.allowed ? '是' : '否'}`);
    }
    
    // 5. 测试不同时间点的周期计算
    console.log('\n5️⃣ 测试场景：模拟不同时间点的周期计算\n');
    
    // 创建一个在月初购买的用户
    const earlyMonthUserResult = await client.query(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES ('test_early_month', 'early@test.com', 'hash', 'user')
      ON CONFLICT (username) DO UPDATE SET email = EXCLUDED.email
      RETURNING id
    `);
    const earlyMonthUserId = earlyMonthUserResult.rows[0].id;
    
    if (monthlyPlanResult.rows.length > 0) {
      const monthlyPlanId = monthlyPlanResult.rows[0].id;
      
      // 1号购买
      await client.query(`
        INSERT INTO user_subscriptions (
          user_id, plan_id, status,
          start_date, end_date,
          quota_reset_anchor, quota_cycle_type
        ) VALUES (
          $1, $2, 'active',
          '2026-01-01 00:00:00', '2026-02-01 00:00:00',
          '2026-01-01 00:00:00', 'monthly'
        )
        ON CONFLICT (user_id, plan_id)
        WHERE status = 'active'
        DO UPDATE SET
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          quota_reset_anchor = EXCLUDED.quota_reset_anchor
      `, [earlyMonthUserId, monthlyPlanId]);
      
      console.log('对比不同购买日期的用户：');
      
      const comparisonResult = await client.query(`
        SELECT 
          u.username,
          us.quota_reset_anchor,
          get_quota_reset_description(u.id) as reset_rule,
          p.period_start,
          p.period_end
        FROM users u
        JOIN user_subscriptions us ON us.user_id = u.id
        CROSS JOIN LATERAL get_user_quota_period(u.id, 'articles_per_month') p
        WHERE u.username IN ('test_early_month', 'test_monthly_user')
          AND us.status = 'active'
        ORDER BY us.quota_reset_anchor
      `);
      
      comparisonResult.rows.forEach(row => {
        console.log(`\n  用户: ${row.username}`);
        console.log(`  购买日期: ${new Date(row.quota_reset_anchor).toLocaleDateString()}`);
        console.log(`  重置规则: ${row.reset_rule}`);
        console.log(`  当前周期: ${new Date(row.period_start).toLocaleDateString()} - ${new Date(row.period_end).toLocaleDateString()}`);
      });
    }
    
    // 6. 测试触发器
    console.log('\n6️⃣ 测试场景：自动设置配额周期触发器\n');
    
    const triggerTestResult = await client.query(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES ('test_trigger', 'trigger@test.com', 'hash', 'user')
      ON CONFLICT (username) DO UPDATE SET email = EXCLUDED.email
      RETURNING id
    `);
    const triggerUserId = triggerTestResult.rows[0].id;
    
    if (monthlyPlanResult.rows.length > 0) {
      const monthlyPlanId = monthlyPlanResult.rows[0].id;
      
      // 插入订阅，不指定 quota_cycle_type（应该自动设置）
      await client.query(`
        INSERT INTO user_subscriptions (
          user_id, plan_id, status,
          start_date, end_date
        ) VALUES (
          $1, $2, 'active',
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 month'
        )
        ON CONFLICT (user_id, plan_id)
        WHERE status = 'active'
        DO UPDATE SET
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date
      `, [triggerUserId, monthlyPlanId]);
      
      // 检查是否自动设置
      const checkResult = await client.query(`
        SELECT 
          quota_cycle_type,
          quota_reset_anchor,
          sp.billing_cycle
        FROM user_subscriptions us
        JOIN subscription_plans sp ON sp.id = us.plan_id
        WHERE us.user_id = $1 AND us.status = 'active'
      `, [triggerUserId]);
      
      const sub = checkResult.rows[0];
      console.log('触发器测试结果：');
      console.log(`  套餐周期: ${sub.billing_cycle}`);
      console.log(`  配额周期: ${sub.quota_cycle_type}`);
      console.log(`  重置锚点: ${sub.quota_reset_anchor}`);
      console.log(`  ✅ 触发器${sub.quota_cycle_type === sub.billing_cycle ? '正常工作' : '未生效'}`);
    }
    
    // 7. 显示所有活跃用户的配额信息
    console.log('\n7️⃣ 所有活跃用户配额信息汇总\n');
    
    const summaryResult = await client.query(`
      SELECT 
        u.username,
        sp.plan_name,
        sp.billing_cycle,
        us.quota_cycle_type,
        TO_CHAR(us.quota_reset_anchor, 'YYYY-MM-DD') as anchor_date,
        get_quota_reset_description(u.id) as reset_rule,
        TO_CHAR(get_next_quota_reset_time(u.id), 'YYYY-MM-DD HH24:MI') as next_reset
      FROM users u
      JOIN user_subscriptions us ON us.user_id = u.id
      JOIN subscription_plans sp ON sp.id = us.plan_id
      WHERE us.status = 'active'
        AND us.end_date > CURRENT_TIMESTAMP
      ORDER BY us.quota_reset_anchor
      LIMIT 20
    `);
    
    console.log('┌─────────────────────┬──────────────┬──────────────┬──────────────┬──────────────────────┬──────────────────────┐');
    console.log('│ 用户名              │ 套餐         │ 计费周期     │ 配额周期     │ 重置规则             │ 下次重置             │');
    console.log('├─────────────────────┼──────────────┼──────────────┼──────────────┼──────────────────────┼──────────────────────┤');
    
    summaryResult.rows.forEach(row => {
      console.log(
        `│ ${row.username.padEnd(19)} │ ${row.plan_name.padEnd(12)} │ ` +
        `${row.billing_cycle.padEnd(12)} │ ${row.quota_cycle_type.padEnd(12)} │ ` +
        `${row.reset_rule.padEnd(20)} │ ${(row.next_reset || 'N/A').padEnd(20)} │`
      );
    });
    
    console.log('└─────────────────────┴──────────────┴──────────────┴──────────────┴──────────────────────┴──────────────────────┘');
    
    console.log('\n========================================');
    console.log('✅ 测试完成！');
    console.log('========================================');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// 执行测试
testSubscriptionCycleQuota().catch(error => {
  console.error('测试脚本执行失败:', error);
  process.exit(1);
});
