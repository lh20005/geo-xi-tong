/**
 * 验证免费版订阅配置结果
 * 
 * 使用方法:
 * npx ts-node src/scripts/verify-free-subscription-setup.ts
 */

import { pool } from '../db/database';

async function verifySetup() {
  console.log('========================================');
  console.log('验证免费版订阅配置结果');
  console.log('========================================\n');

  try {
    // 1. 检查免费版套餐
    console.log('1. 检查免费版套餐配置...');
    const planResult = await pool.query(
      `SELECT id, plan_code, plan_name, price, is_active 
       FROM subscription_plans 
       WHERE plan_code = 'free'`
    );

    if (planResult.rows.length === 0) {
      console.log('❌ 免费版套餐不存在\n');
      return;
    }

    const freePlan = planResult.rows[0];
    console.log(`✅ 免费版套餐: ${freePlan.plan_name} (ID: ${freePlan.id})`);
    console.log(`   状态: ${freePlan.is_active ? '激活' : '未激活'}`);
    console.log(`   价格: ${freePlan.price}\n`);

    // 2. 检查套餐功能配置
    console.log('2. 检查套餐功能配置...');
    const featuresResult = await pool.query(
      `SELECT feature_code, feature_name, feature_value, feature_unit
       FROM plan_features
       WHERE plan_id = $1
       ORDER BY id`,
      [freePlan.id]
    );

    if (featuresResult.rows.length === 0) {
      console.log('❌ 套餐没有配置任何功能\n');
      return;
    }

    console.log(`✅ 配置了 ${featuresResult.rows.length} 项功能:`);
    for (const feature of featuresResult.rows) {
      console.log(`   - ${feature.feature_name}: ${feature.feature_value} ${feature.feature_unit}`);
    }
    console.log('');

    // 3. 统计用户订阅情况
    console.log('3. 统计用户订阅情况...');
    
    const totalUsersResult = await pool.query('SELECT COUNT(*) as count FROM users');
    const totalUsers = parseInt(totalUsersResult.rows[0].count);
    
    const activeSubsResult = await pool.query(`
      SELECT COUNT(DISTINCT user_id) as count 
      FROM user_subscriptions 
      WHERE status = 'active' AND end_date > CURRENT_TIMESTAMP
    `);
    const usersWithActiveSub = parseInt(activeSubsResult.rows[0].count);
    
    const freeSubsResult = await pool.query(`
      SELECT COUNT(DISTINCT us.user_id) as count
      FROM user_subscriptions us
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.status = 'active' 
        AND us.end_date > CURRENT_TIMESTAMP
        AND sp.plan_code = 'free'
    `);
    const usersWithFreeSub = parseInt(freeSubsResult.rows[0].count);
    
    const noSubResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM user_subscriptions us
        WHERE us.user_id = u.id 
          AND us.status = 'active'
          AND us.end_date > CURRENT_TIMESTAMP
      )
    `);
    const usersWithoutSub = parseInt(noSubResult.rows[0].count);

    console.log(`✅ 用户统计:`);
    console.log(`   总用户数: ${totalUsers}`);
    console.log(`   有活跃订阅: ${usersWithActiveSub} (${((usersWithActiveSub/totalUsers)*100).toFixed(1)}%)`);
    console.log(`   使用免费版: ${usersWithFreeSub} (${((usersWithFreeSub/totalUsers)*100).toFixed(1)}%)`);
    console.log(`   无订阅: ${usersWithoutSub} (${((usersWithoutSub/totalUsers)*100).toFixed(1)}%)`);
    console.log('');

    if (usersWithoutSub > 0) {
      console.log(`⚠️  还有 ${usersWithoutSub} 个用户没有订阅\n`);
      
      // 显示这些用户
      const noSubUsersResult = await pool.query(`
        SELECT u.id, u.username, u.created_at
        FROM users u
        WHERE NOT EXISTS (
          SELECT 1 FROM user_subscriptions us
          WHERE us.user_id = u.id 
            AND us.status = 'active'
            AND us.end_date > CURRENT_TIMESTAMP
        )
        ORDER BY u.id
        LIMIT 10
      `);
      
      console.log('   无订阅用户列表（最多显示10个）:');
      for (const user of noSubUsersResult.rows) {
        console.log(`   - ${user.username} (ID: ${user.id}, 注册: ${user.created_at.toISOString().split('T')[0]})`);
      }
      console.log('');
    }

    // 4. 检查配额初始化情况
    console.log('4. 检查配额初始化情况...');
    
    const quotaStatsResult = await pool.query(`
      SELECT 
        COUNT(DISTINCT user_id) as users_with_quota,
        COUNT(*) as total_quota_records
      FROM user_usage
    `);
    
    const quotaStats = quotaStatsResult.rows[0];
    console.log(`✅ 配额记录统计:`);
    console.log(`   有配额记录的用户: ${quotaStats.users_with_quota}`);
    console.log(`   总配额记录数: ${quotaStats.total_quota_records}`);
    console.log('');

    // 5. 检查存储空间初始化
    console.log('5. 检查存储空间初始化...');
    
    const storageStatsResult = await pool.query(`
      SELECT 
        COUNT(*) as users_with_storage,
        AVG(storage_quota_bytes) as avg_quota,
        MIN(storage_quota_bytes) as min_quota,
        MAX(storage_quota_bytes) as max_quota
      FROM user_storage_usage
    `);
    
    const storageStats = storageStatsResult.rows[0];
    console.log(`✅ 存储空间统计:`);
    console.log(`   有存储记录的用户: ${storageStats.users_with_storage}`);
    console.log(`   平均配额: ${(storageStats.avg_quota / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`   最小配额: ${(storageStats.min_quota / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`   最大配额: ${(storageStats.max_quota / (1024 * 1024)).toFixed(2)} MB`);
    console.log('');

    // 6. 抽样检查几个用户的详细配置
    console.log('6. 抽样检查用户配置（最多3个）...');
    
    const sampleUsersResult = await pool.query(`
      SELECT u.id, u.username, sp.plan_name, us.start_date, us.end_date
      FROM users u
      JOIN user_subscriptions us ON u.id = us.user_id
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.status = 'active' 
        AND us.end_date > CURRENT_TIMESTAMP
        AND sp.plan_code = 'free'
      ORDER BY us.created_at DESC
      LIMIT 3
    `);

    for (const user of sampleUsersResult.rows) {
      console.log(`\n   用户: ${user.username} (ID: ${user.id})`);
      console.log(`   套餐: ${user.plan_name}`);
      console.log(`   有效期: ${user.start_date.toISOString().split('T')[0]} 至 ${user.end_date.toISOString().split('T')[0]}`);
      
      // 检查配额
      const userQuotaResult = await pool.query(
        `SELECT feature_code, usage_count, period_start, period_end
         FROM user_usage
         WHERE user_id = $1
         ORDER BY feature_code`,
        [user.id]
      );
      
      console.log(`   配额记录: ${userQuotaResult.rows.length} 项`);
      
      // 检查存储
      const userStorageResult = await pool.query(
        `SELECT storage_quota_bytes, 
                image_storage_bytes + document_storage_bytes + article_storage_bytes as used_bytes
         FROM user_storage_usage
         WHERE user_id = $1`,
        [user.id]
      );
      
      if (userStorageResult.rows.length > 0) {
        const storage = userStorageResult.rows[0];
        const quotaMB = (storage.storage_quota_bytes / (1024 * 1024)).toFixed(2);
        const usedMB = (storage.used_bytes / (1024 * 1024)).toFixed(2);
        console.log(`   存储空间: ${usedMB} MB / ${quotaMB} MB`);
      } else {
        console.log(`   ⚠️  没有存储记录`);
      }
    }

    console.log('\n========================================');
    console.log('验证完成');
    console.log('========================================\n');

    // 总结
    if (usersWithoutSub === 0) {
      console.log('✅ 所有用户都已配置订阅');
    } else {
      console.log(`⚠️  还有 ${usersWithoutSub} 个用户需要配置订阅`);
      console.log('   运行以下命令为这些用户配置免费版:');
      console.log('   npx ts-node src/scripts/reset-users-to-free-subscription.ts');
    }
    console.log('');

  } catch (error) {
    console.error('❌ 验证失败:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verifySetup();
