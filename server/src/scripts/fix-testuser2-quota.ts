import { pool } from '../db/database';

/**
 * 修复 testuser2 的配额初始化问题
 * 
 * 问题：支付成功后创建了订阅，但没有初始化 user_usage 表
 * 解决：为用户的每个功能配额创建初始记录
 */
async function fixTestuser2Quota() {
  const client = await pool.connect();
  
  try {
    console.log('=== 开始修复 testuser2 的配额问题 ===\n');
    
    await client.query('BEGIN');
    
    // 1. 查找用户
    const userResult = await client.query(
      `SELECT id, username FROM users WHERE username = 'testuser2'`
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ 未找到 testuser2 用户');
      return;
    }
    
    const user = userResult.rows[0];
    console.log(`✅ 找到用户: ${user.username} (ID: ${user.id})\n`);
    
    // 2. 查找激活的订阅
    const subscriptionResult = await client.query(
      `SELECT 
        us.id,
        us.plan_id,
        sp.plan_code,
        sp.plan_name
      FROM user_subscriptions us
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.user_id = $1 AND us.status = 'active'
      ORDER BY us.end_date DESC
      LIMIT 1`,
      [user.id]
    );
    
    if (subscriptionResult.rows.length === 0) {
      console.log('❌ 用户没有激活的订阅');
      await client.query('ROLLBACK');
      return;
    }
    
    const subscription = subscriptionResult.rows[0];
    console.log(`✅ 找到激活订阅: ${subscription.plan_name} (${subscription.plan_code})\n`);
    
    // 3. 获取套餐的所有功能配额
    const featuresResult = await client.query(
      `SELECT 
        feature_code,
        feature_name,
        feature_value,
        feature_unit
      FROM plan_features
      WHERE plan_id = $1
      ORDER BY feature_code`,
      [subscription.plan_id]
    );
    
    if (featuresResult.rows.length === 0) {
      console.log('❌ 套餐没有配置功能');
      await client.query('ROLLBACK');
      return;
    }
    
    console.log(`📋 套餐功能配置 (${featuresResult.rows.length} 项):`);
    featuresResult.rows.forEach(f => {
      console.log(`  - ${f.feature_name} (${f.feature_code}): ${f.feature_value} ${f.feature_unit}`);
    });
    console.log('');
    
    // 4. 为每个功能初始化 user_usage 记录
    console.log('🔧 开始初始化配额记录...\n');
    
    let initializedCount = 0;
    
    for (const feature of featuresResult.rows) {
      // 确定周期
      let periodStart: Date;
      let periodEnd: Date;
      const now = new Date();
      
      // 根据功能代码确定重置周期
      if (feature.feature_code.includes('_per_day')) {
        // 每日重置
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      } else if (feature.feature_code.includes('_per_month') || feature.feature_code === 'keyword_distillation') {
        // 每月重置
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      } else {
        // 永不重置（如 platform_accounts, storage_space）
        periodStart = new Date(2000, 0, 1);
        periodEnd = new Date(2099, 11, 31);
      }
      
      // 检查是否已存在记录
      const existingResult = await client.query(
        `SELECT id FROM user_usage 
         WHERE user_id = $1 AND feature_code = $2 AND period_start = $3`,
        [user.id, feature.feature_code, periodStart]
      );
      
      if (existingResult.rows.length > 0) {
        console.log(`  ⏭️  ${feature.feature_name}: 已存在记录，跳过`);
        continue;
      }
      
      // 插入初始记录
      await client.query(
        `INSERT INTO user_usage (
          user_id, 
          feature_code, 
          usage_count, 
          period_start, 
          period_end,
          last_reset_at
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [user.id, feature.feature_code, 0, periodStart, periodEnd, periodStart]
      );
      
      console.log(`  ✅ ${feature.feature_name}: 初始化成功 (0/${feature.feature_value})`);
      initializedCount++;
    }
    
    console.log('');
    console.log(`✅ 成功初始化 ${initializedCount} 项配额记录\n`);
    
    await client.query('COMMIT');
    
    // 5. 验证修复结果
    console.log('=== 验证修复结果 ===\n');
    
    const verifyResult = await client.query(
      `SELECT 
        feature_code,
        feature_name,
        quota_limit,
        current_usage,
        remaining,
        usage_percentage
      FROM v_user_quota_overview
      WHERE user_id = $1
      ORDER BY feature_code`,
      [user.id]
    );
    
    if (verifyResult.rows.length > 0) {
      console.log('✅ 配额概览:');
      verifyResult.rows.forEach(row => {
        const limit = row.quota_limit === -1 ? '无限' : row.quota_limit;
        const remaining = row.remaining === -1 ? '无限' : row.remaining;
        console.log(`  - ${row.feature_name}: ${row.current_usage}/${limit} (剩余: ${remaining}, 使用率: ${row.usage_percentage}%)`);
      });
    } else {
      console.log('⚠️  警告: 配额概览视图仍然为空');
    }
    
    console.log('\n=== 修复完成 ===');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 修复过程中出错:', error);
    throw error;
  } finally {
    client.release();
  }
}

// 执行修复
fixTestuser2Quota()
  .then(() => {
    console.log('\n✅ 修复成功完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 修复失败:', error);
    process.exit(1);
  });
