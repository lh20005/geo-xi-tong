import { pool } from '../db/database';

/**
 * 修复配额问题
 * 1. 修正 user_usage 表的 period_end（应该是月底，不是每日）
 * 2. 重新计算 usage_count
 * 3. 增加套餐配额到合理值
 */
async function fixQuotaIssues() {
  console.log('=== 修复配额问题 ===\n');

  try {
    const username = process.argv[2] || 'lzc2005';
    console.log(`修复用户: ${username}\n`);

    // 1. 获取用户信息
    const userResult = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      console.log('❌ 用户不存在');
      return;
    }

    const userId = userResult.rows[0].id;
    console.log(`✅ 用户ID: ${userId}\n`);

    // 2. 修正 user_usage 表的 period_end（改为月底）
    console.log('📅 修正 user_usage 表的周期...');
    
    const updatePeriodResult = await pool.query(`
      UPDATE user_usage
      SET 
        period_start = DATE_TRUNC('month', CURRENT_DATE),
        period_end = DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month',
        last_reset_at = DATE_TRUNC('month', CURRENT_DATE)
      WHERE user_id = $1
      RETURNING feature_code, period_start, period_end
    `, [userId]);

    if (updatePeriodResult.rows.length > 0) {
      console.log('✅ 已更新周期:');
      updatePeriodResult.rows.forEach(row => {
        console.log(`   ${row.feature_code}: ${row.period_start} -> ${row.period_end}`);
      });
    }
    console.log('');

    // 3. 重新计算本月使用量
    console.log('🔢 重新计算本月使用量...');
    
    const features = ['articles_per_month', 'publish_per_month'];
    
    for (const featureCode of features) {
      // 计算本月实际使用量
      const usageResult = await pool.query(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM usage_records
        WHERE user_id = $1 
          AND feature_code = $2
          AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
      `, [userId, featureCode]);

      const actualUsage = parseInt(usageResult.rows[0].total);

      // 更新 user_usage 表
      await pool.query(`
        UPDATE user_usage
        SET usage_count = $1
        WHERE user_id = $2 AND feature_code = $3
      `, [actualUsage, userId, featureCode]);

      console.log(`   ${featureCode}: ${actualUsage}`);
    }
    console.log('');

    // 4. 增加套餐配额到合理值
    console.log('📈 增加套餐配额...');
    
    const subscriptionResult = await pool.query(
      'SELECT plan_id FROM user_subscriptions WHERE user_id = $1 AND status = $2 ORDER BY end_date DESC LIMIT 1',
      [userId, 'active']
    );

    if (subscriptionResult.rows.length > 0) {
      const planId = subscriptionResult.rows[0].plan_id;
      
      // 更新配额为合理值
      const updates = [
        { feature: 'articles_per_month', value: 100 },
        { feature: 'publish_per_month', value: 100 }
      ];

      for (const update of updates) {
        await pool.query(`
          UPDATE plan_features
          SET feature_value = $1
          WHERE plan_id = $2 AND feature_code = $3
        `, [update.value, planId, update.feature]);
        
        console.log(`   ${update.feature}: ${update.value}`);
      }
    }
    console.log('');

    // 5. 验证修复结果
    console.log('✅ 验证修复结果:\n');
    
    const quotaResult = await pool.query(
      'SELECT * FROM check_user_quota($1, $2)',
      [userId, 'articles_per_month']
    );

    if (quotaResult.rows.length > 0) {
      const quota = quotaResult.rows[0];
      console.log(`   has_quota: ${quota.has_quota}`);
      console.log(`   quota_limit: ${quota.quota_limit}`);
      console.log(`   current_usage: ${quota.current_usage}`);
      console.log(`   remaining: ${quota.remaining}`);
      console.log(`   percentage: ${quota.percentage}%\n`);

      if (quota.has_quota) {
        console.log('🎉 配额修复成功！');
      } else {
        console.log('⚠️  配额仍有问题，需要进一步检查');
      }
    }

  } catch (error) {
    console.error('修复失败:', error);
  } finally {
    await pool.end();
  }
}

fixQuotaIssues();
