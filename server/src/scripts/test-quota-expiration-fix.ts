import { pool } from '../db/database';

/**
 * 测试配额时效性修复
 */
async function testQuotaExpirationFix() {
  console.log('='.repeat(60));
  console.log('测试配额时效性修复');
  console.log('='.repeat(60));
  console.log();

  try {
    // 1. 检查是否还有永久配额
    console.log('1. 检查永久配额...');
    const permanentQuotasResult = await pool.query(`
      SELECT 
        user_id,
        feature_code,
        period_start,
        period_end,
        usage_count
      FROM user_usage
      WHERE period_end > '2099-01-01'::TIMESTAMP
      ORDER BY user_id, feature_code
    `);

    if (permanentQuotasResult.rows.length > 0) {
      console.log(`❌ 发现 ${permanentQuotasResult.rows.length} 条永久配额记录:`);
      permanentQuotasResult.rows.forEach(row => {
        console.log(`   用户 ${row.user_id} - ${row.feature_code}: ${row.period_start} 至 ${row.period_end}`);
      });
    } else {
      console.log('✅ 没有永久配额记录');
    }
    console.log();

    // 2. 检查配额是否与订阅周期绑定
    console.log('2. 检查配额与订阅周期绑定...');
    const quotaBindingResult = await pool.query(`
      SELECT 
        uu.user_id,
        u.username,
        uu.feature_code,
        uu.period_start,
        uu.period_end,
        us.start_date as subscription_start,
        us.end_date as subscription_end,
        us.status as subscription_status,
        CASE 
          WHEN uu.period_end <= us.end_date THEN '✅ 正确'
          ELSE '❌ 超出订阅周期'
        END as binding_status
      FROM user_usage uu
      JOIN users u ON u.id = uu.user_id
      LEFT JOIN user_subscriptions us ON us.user_id = uu.user_id 
        AND us.status = 'active'
        AND us.end_date > CURRENT_TIMESTAMP
      WHERE uu.period_end > CURRENT_TIMESTAMP
      ORDER BY uu.user_id, uu.feature_code
    `);

    console.log(`找到 ${quotaBindingResult.rows.length} 条活跃配额记录:`);
    quotaBindingResult.rows.forEach(row => {
      console.log(`   ${row.binding_status} 用户 ${row.username} - ${row.feature_code}`);
      if (row.subscription_status) {
        console.log(`      配额周期: ${row.period_start} 至 ${row.period_end}`);
        console.log(`      订阅周期: ${row.subscription_start} 至 ${row.subscription_end}`);
      } else {
        console.log(`      ⚠️  没有有效订阅`);
      }
    });
    console.log();

    // 3. 检查过期订阅
    console.log('3. 检查过期订阅...');
    const expiredSubsResult = await pool.query(`
      SELECT 
        us.id,
        us.user_id,
        u.username,
        sp.plan_name,
        us.status,
        us.end_date,
        CASE 
          WHEN us.status = 'active' AND us.end_date <= CURRENT_TIMESTAMP THEN '❌ 需要处理'
          WHEN us.status = 'expired' THEN '✅ 已标记为过期'
          ELSE '✅ 正常'
        END as status_check
      FROM user_subscriptions us
      JOIN users u ON u.id = us.user_id
      JOIN subscription_plans sp ON sp.id = us.plan_id
      WHERE us.end_date <= CURRENT_TIMESTAMP
        AND us.end_date > CURRENT_TIMESTAMP - INTERVAL '7 days'
      ORDER BY us.end_date DESC
    `);

    if (expiredSubsResult.rows.length > 0) {
      console.log(`找到 ${expiredSubsResult.rows.length} 个最近过期的订阅:`);
      expiredSubsResult.rows.forEach(row => {
        console.log(`   ${row.status_check} 用户 ${row.username} - ${row.plan_name}`);
        console.log(`      状态: ${row.status}, 过期时间: ${row.end_date}`);
      });
    } else {
      console.log('✅ 没有最近过期的订阅');
    }
    console.log();

    // 4. 检查配额类型分布
    console.log('4. 检查配额类型分布...');
    const quotaTypesResult = await pool.query(`
      SELECT 
        feature_code,
        COUNT(DISTINCT user_id) as user_count,
        MIN(period_end) as earliest_end,
        MAX(period_end) as latest_end,
        CASE 
          WHEN MAX(period_end) > '2099-01-01'::TIMESTAMP THEN '❌ 包含永久配额'
          ELSE '✅ 正常'
        END as type_status
      FROM user_usage
      WHERE period_end > CURRENT_TIMESTAMP
      GROUP BY feature_code
      ORDER BY feature_code
    `);

    console.log('配额类型统计:');
    quotaTypesResult.rows.forEach(row => {
      console.log(`   ${row.type_status} ${row.feature_code}: ${row.user_count} 个用户`);
      console.log(`      最早到期: ${row.earliest_end}`);
      console.log(`      最晚到期: ${row.latest_end}`);
    });
    console.log();

    // 5. 测试配额检查函数
    console.log('5. 测试配额检查函数...');
    
    // 获取一个有效订阅的用户
    const testUserResult = await pool.query(`
      SELECT u.id, u.username, us.end_date
      FROM users u
      JOIN user_subscriptions us ON us.user_id = u.id
      WHERE us.status = 'active' AND us.end_date > CURRENT_TIMESTAMP
      ORDER BY us.end_date DESC
      LIMIT 1
    `);

    if (testUserResult.rows.length > 0) {
      const testUser = testUserResult.rows[0];
      console.log(`测试用户: ${testUser.username} (ID: ${testUser.id})`);
      console.log(`订阅到期: ${testUser.end_date}`);
      
      // 测试各种配额检查
      const features = ['articles_per_month', 'platform_accounts', 'storage_space'];
      
      for (const featureCode of features) {
        const checkResult = await pool.query(
          'SELECT * FROM check_feature_quota($1, $2, 1)',
          [testUser.id, featureCode]
        );
        
        if (checkResult.rows.length > 0) {
          const check = checkResult.rows[0];
          console.log(`   ${featureCode}:`);
          console.log(`      允许: ${check.allowed ? '✅' : '❌'}`);
          console.log(`      当前使用: ${check.current_usage}/${check.quota_limit}`);
          console.log(`      原因: ${check.reason}`);
        }
      }
    } else {
      console.log('⚠️  没有找到有效订阅的用户进行测试');
    }
    console.log();

    // 6. 检查订阅到期处理函数
    console.log('6. 测试订阅到期处理函数...');
    const expiredCountResult = await pool.query('SELECT handle_expired_subscriptions() as count');
    const expiredCount = expiredCountResult.rows[0].count;
    console.log(`处理了 ${expiredCount} 个过期订阅`);
    console.log();

    // 7. 总结
    console.log('='.repeat(60));
    console.log('测试总结');
    console.log('='.repeat(60));
    
    const issues: string[] = [];
    
    if (permanentQuotasResult.rows.length > 0) {
      issues.push(`发现 ${permanentQuotasResult.rows.length} 条永久配额记录`);
    }
    
    const wrongBinding = quotaBindingResult.rows.filter(r => 
      r.binding_status.includes('❌')
    );
    if (wrongBinding.length > 0) {
      issues.push(`发现 ${wrongBinding.length} 条配额未正确绑定到订阅周期`);
    }
    
    const needsHandling = expiredSubsResult.rows.filter(r => 
      r.status_check.includes('需要处理')
    );
    if (needsHandling.length > 0) {
      issues.push(`发现 ${needsHandling.length} 个需要处理的过期订阅`);
    }
    
    if (issues.length > 0) {
      console.log('❌ 发现以下问题:');
      issues.forEach(issue => console.log(`   - ${issue}`));
      console.log('\n建议: 运行迁移 030 来修复这些问题');
    } else {
      console.log('✅ 所有检查通过！配额时效性修复成功！');
    }
    console.log();

  } catch (error) {
    console.error('❌ 测试失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// 执行测试
testQuotaExpirationFix().catch(error => {
  console.error('测试执行失败:', error);
  process.exit(1);
});
