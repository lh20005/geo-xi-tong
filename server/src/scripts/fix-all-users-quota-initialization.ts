import { pool } from '../db/database';

/**
 * 修复所有用户的配额初始化问题
 * 
 * 问题：历史订阅可能没有初始化 user_usage 表
 * 解决：为所有有激活订阅但缺少配额记录的用户初始化配额
 */
async function fixAllUsersQuota() {
  const client = await pool.connect();
  
  try {
    console.log('=== 开始批量修复用户配额初始化问题 ===\n');
    
    await client.query('BEGIN');
    
    // 1. 查找所有有激活订阅的用户
    const usersResult = await client.query(
      `SELECT DISTINCT
        u.id,
        u.username,
        us.plan_id,
        sp.plan_code,
        sp.plan_name
      FROM users u
      JOIN user_subscriptions us ON us.user_id = u.id
      JOIN subscription_plans sp ON sp.id = us.plan_id
      WHERE us.status = 'active'
        AND us.end_date > CURRENT_TIMESTAMP
      ORDER BY u.id`
    );
    
    console.log(`📋 找到 ${usersResult.rows.length} 个有激活订阅的用户\n`);
    
    if (usersResult.rows.length === 0) {
      console.log('✅ 没有需要处理的用户');
      await client.query('ROLLBACK');
      return;
    }
    
    let totalFixed = 0;
    let totalInitialized = 0;
    
    // 2. 为每个用户检查并初始化配额
    for (const user of usersResult.rows) {
      console.log(`\n处理用户: ${user.username} (ID: ${user.id}) - ${user.plan_name}`);
      
      // 获取套餐的所有功能配额
      const featuresResult = await client.query(
        `SELECT 
          feature_code,
          feature_name,
          feature_value,
          feature_unit
        FROM plan_features
        WHERE plan_id = $1
        ORDER BY feature_code`,
        [user.plan_id]
      );
      
      if (featuresResult.rows.length === 0) {
        console.log(`  ⚠️  套餐没有配置功能，跳过`);
        continue;
      }
      
      let userInitializedCount = 0;
      const now = new Date();
      
      for (const feature of featuresResult.rows) {
        // 确定周期
        let periodStart: Date;
        let periodEnd: Date;
        
        if (feature.feature_code.includes('_per_day')) {
          periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        } else if (feature.feature_code.includes('_per_month') || feature.feature_code === 'keyword_distillation') {
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        } else {
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
        
        userInitializedCount++;
        totalInitialized++;
      }
      
      if (userInitializedCount > 0) {
        console.log(`  ✅ 初始化了 ${userInitializedCount} 项配额记录`);
        totalFixed++;
      } else {
        console.log(`  ⏭️  配额已存在，无需初始化`);
      }
    }
    
    await client.query('COMMIT');
    
    console.log('\n=== 批量修复完成 ===');
    console.log(`✅ 共处理 ${usersResult.rows.length} 个用户`);
    console.log(`✅ 修复了 ${totalFixed} 个用户`);
    console.log(`✅ 初始化了 ${totalInitialized} 项配额记录`);
    
    // 3. 验证修复结果
    console.log('\n=== 验证修复结果 ===\n');
    
    const verifyResult = await client.query(
      `SELECT 
        COUNT(DISTINCT user_id) as users_with_quotas
      FROM v_user_quota_overview`
    );
    
    console.log(`✅ 配额概览视图中有 ${verifyResult.rows[0].users_with_quotas} 个用户有配额数据`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 批量修复过程中出错:', error);
    throw error;
  } finally {
    client.release();
  }
}

// 执行修复
fixAllUsersQuota()
  .then(() => {
    console.log('\n✅ 批量修复成功完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 批量修复失败:', error);
    process.exit(1);
  });
