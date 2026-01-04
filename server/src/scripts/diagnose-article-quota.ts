import { pool } from '../db/database';

/**
 * 诊断文章生成配额问题
 */
async function diagnoseArticleQuota() {
  console.log('=== 文章生成配额诊断 ===\n');

  try {
    // 1. 检查当前登录的用户（假设是 testuser）
    const username = process.argv[2] || 'testuser';
    console.log(`检查用户: ${username}\n`);

    const userResult = await pool.query(
      'SELECT id, username, email FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      console.log('❌ 用户不存在');
      return;
    }

    const user = userResult.rows[0];
    console.log(`✅ 用户信息:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   用户名: ${user.username}`);
    console.log(`   邮箱: ${user.email}\n`);

    // 2. 检查用户订阅
    const subscriptionResult = await pool.query(
      `SELECT *
      FROM user_subscriptions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
      [user.id]
    );

    if (subscriptionResult.rows.length === 0) {
      console.log('❌ 用户没有订阅\n');
    } else {
      const subscription = subscriptionResult.rows[0];
      console.log(`✅ 订阅信息:`);
      console.log(`   订阅ID: ${subscription.id}`);
      console.log(`   套餐ID: ${subscription.plan_id}`);
      console.log(`   状态: ${subscription.status}`);
      console.log(`   开始日期: ${subscription.start_date}`);
      console.log(`   结束日期: ${subscription.end_date}\n`);
      
      // 获取套餐的配额信息
      const planFeaturesResult = await pool.query(
        `SELECT feature_code, feature_value
         FROM plan_features
         WHERE plan_id = $1 AND feature_code IN ('articles_per_month', 'publish_per_month')`,
        [subscription.plan_id]
      );
      
      if (planFeaturesResult.rows.length > 0) {
        console.log(`   套餐配额:`);
        planFeaturesResult.rows.forEach(row => {
          console.log(`     ${row.feature_code}: ${row.feature_value}`);
        });
        console.log('');
      }
    }

    // 3. 检查配额函数返回值
    console.log('📊 检查配额函数返回值:\n');
    
    const quotaResult = await pool.query(
      `SELECT * FROM check_user_quota($1, $2)`,
      [user.id, 'articles_per_month']
    );

    if (quotaResult.rows.length === 0) {
      console.log('❌ 配额函数没有返回结果');
      return;
    }

    const quota = quotaResult.rows[0];
    console.log(`   has_quota: ${quota.has_quota}`);
    console.log(`   quota_limit: ${quota.quota_limit}`);
    console.log(`   current_usage: ${quota.current_usage}`);
    console.log(`   remaining: ${quota.remaining}`);
    console.log(`   percentage: ${quota.percentage}%\n`);

    // 4. 检查 user_usage 表
    const userUsageResult = await pool.query(
      `SELECT * FROM user_usage 
       WHERE user_id = $1 AND feature_code = $2`,
      [user.id, 'articles_per_month']
    );

    console.log('📋 user_usage 表记录:');
    if (userUsageResult.rows.length === 0) {
      console.log('   ⚠️  没有记录（可能需要初始化）\n');
    } else {
      const usage = userUsageResult.rows[0];
      console.log(`   feature_code: ${usage.feature_code}`);
      console.log(`   current_usage: ${usage.current_usage}`);
      console.log(`   period_start: ${usage.period_start}`);
      console.log(`   period_end: ${usage.period_end}`);
      console.log(`   last_reset_at: ${usage.last_reset_at}\n`);
    }

    // 5. 检查 usage_records 表
    const recordsResult = await pool.query(
      `SELECT COUNT(*) as count, SUM(amount) as total
       FROM usage_records
       WHERE user_id = $1 AND feature_code = $2
       AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
      [user.id, 'articles_per_month']
    );

    const records = recordsResult.rows[0];
    console.log('📝 本月使用记录:');
    console.log(`   记录数: ${records.count}`);
    console.log(`   总使用量: ${records.total || 0}\n`);

    // 6. 检查最近的使用记录
    const recentRecordsResult = await pool.query(
      `SELECT created_at, amount, resource_type, resource_id
       FROM usage_records
       WHERE user_id = $1 AND feature_code = $2
       ORDER BY created_at DESC
       LIMIT 5`,
      [user.id, 'articles_per_month']
    );

    if (recentRecordsResult.rows.length > 0) {
      console.log('🕐 最近5条使用记录:');
      recentRecordsResult.rows.forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.created_at} - 数量: ${record.amount}`);
      });
      console.log('');
    }

    // 7. 诊断结论
    console.log('=== 诊断结论 ===\n');

    if (!quota.has_quota) {
      console.log('❌ 问题: has_quota = false');
      console.log('   可能原因:');
      console.log('   1. 订阅状态不是 active');
      console.log('   2. 订阅已过期');
      console.log('   3. 配额限制为 0');
      console.log('   4. check_user_quota 函数逻辑有问题\n');
    } else if (quota.remaining <= 0) {
      console.log('❌ 问题: remaining <= 0');
      console.log(`   配额已用完: ${quota.current_usage} / ${quota.quota_limit}\n`);
    } else {
      console.log('✅ 配额正常');
      console.log(`   剩余配额: ${quota.remaining} / ${quota.quota_limit}\n`);
    }

    // 8. 检查数据库函数定义
    console.log('🔍 检查 check_user_quota 函数定义:\n');
    const functionResult = await pool.query(`
      SELECT pg_get_functiondef(oid) as definition
      FROM pg_proc
      WHERE proname = 'check_user_quota'
    `);

    if (functionResult.rows.length > 0) {
      console.log(functionResult.rows[0].definition);
      console.log('');
    }

  } catch (error) {
    console.error('诊断失败:', error);
  } finally {
    await pool.end();
  }
}

diagnoseArticleQuota();
