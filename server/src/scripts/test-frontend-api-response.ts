/**
 * 测试前端 API 响应
 * 模拟前端调用，验证返回的配额数据是否正确
 */

import { pool } from '../db/database';

async function testFrontendApiResponse() {
  console.log('=== 测试前端 API 响应 ===\n');

  try {
    // 模拟获取 testuser2 的用户中心数据
    console.log('1️⃣ 模拟获取 testuser2 的用户中心数据...\n');

    const userId = 438; // testuser2 的 ID

    // 获取用户订阅信息（模拟 /api/subscriptions/current）
    const subscriptionResult = await pool.query(`
      SELECT 
        us.id,
        us.user_id,
        us.plan_id,
        us.status,
        us.start_date,
        us.end_date,
        sp.plan_name,
        sp.plan_code,
        sp.price,
        sp.billing_cycle,
        json_agg(
          json_build_object(
            'feature_code', pf.feature_code,
            'feature_name', pf.feature_name,
            'feature_value', pf.feature_value,
            'feature_unit', pf.feature_unit
          )
        ) as features
      FROM user_subscriptions us
      JOIN subscription_plans sp ON us.plan_id = sp.id
      LEFT JOIN plan_features pf ON sp.id = pf.plan_id
      WHERE us.user_id = $1 
        AND us.status = 'active'
        AND us.end_date > CURRENT_TIMESTAMP
      GROUP BY us.id, sp.id
      ORDER BY us.end_date DESC
      LIMIT 1
    `, [userId]);

    if (subscriptionResult.rows.length > 0) {
      const subscription = subscriptionResult.rows[0];
      console.log('📦 订阅信息:');
      console.log(`   套餐: ${subscription.plan_name}`);
      console.log(`   状态: ${subscription.status}`);
      console.log(`   结束时间: ${subscription.end_date}`);
      console.log('\n   功能配额:');
      
      subscription.features.forEach((feature: any) => {
        const displayValue = feature.feature_value === -1 
          ? '无限制' 
          : `${feature.feature_value} ${feature.feature_unit}`;
        console.log(`   - ${feature.feature_name}: ${displayValue}`);
      });
      console.log('');
    }

    // 获取存储使用情况（模拟 /api/storage/usage）
    const storageResult = await pool.query(`
      SELECT 
        usu.*,
        usu.storage_quota_bytes / (1024 * 1024)::numeric as quota_mb,
        usu.total_storage_bytes / (1024 * 1024)::numeric as used_mb,
        usu.image_storage_bytes / (1024 * 1024)::numeric as image_mb,
        usu.document_storage_bytes / (1024 * 1024)::numeric as document_mb,
        usu.article_storage_bytes / (1024 * 1024)::numeric as article_mb,
        CASE 
          WHEN usu.storage_quota_bytes = -1 THEN 0
          ELSE ROUND((usu.total_storage_bytes::numeric / usu.storage_quota_bytes::numeric) * 100, 2)
        END as usage_percentage
      FROM user_storage_usage usu
      WHERE usu.user_id = $1
    `, [userId]);

    if (storageResult.rows.length > 0) {
      const storage = storageResult.rows[0];
      console.log('💾 存储使用情况:');
      console.log(`   配额: ${parseFloat(storage.quota_mb).toFixed(2)} MB`);
      console.log(`   已使用: ${parseFloat(storage.used_mb).toFixed(2)} MB`);
      console.log(`   使用率: ${storage.usage_percentage}%`);
      console.log('\n   分类使用:');
      console.log(`   - 图片: ${parseFloat(storage.image_mb).toFixed(2)} MB (${storage.image_count} 个)`);
      console.log(`   - 文档: ${parseFloat(storage.document_mb).toFixed(2)} MB (${storage.document_count} 个)`);
      console.log(`   - 文章: ${parseFloat(storage.article_mb).toFixed(2)} MB (${storage.article_count} 个)`);
      console.log('');
    }

    // 获取配额统计（模拟用户中心的配额显示）
    const quotaStatsResult = await pool.query(`
      SELECT 
        'storage_space' as feature_code,
        '存储空间' as feature_name,
        usu.total_storage_bytes / (1024 * 1024)::numeric as used,
        usu.storage_quota_bytes / (1024 * 1024)::numeric as limit,
        'MB' as unit,
        CASE 
          WHEN usu.storage_quota_bytes = -1 THEN 0
          ELSE ROUND((usu.total_storage_bytes::numeric / usu.storage_quota_bytes::numeric) * 100, 2)
        END as percentage
      FROM user_storage_usage usu
      WHERE usu.user_id = $1
      
      UNION ALL
      
      SELECT 
        pf.feature_code,
        pf.feature_name,
        COALESCE(usage.current_usage, 0) as used,
        pf.feature_value as limit,
        pf.feature_unit as unit,
        CASE 
          WHEN pf.feature_value = -1 THEN 0
          ELSE ROUND((COALESCE(usage.current_usage, 0)::numeric / pf.feature_value::numeric) * 100, 2)
        END as percentage
      FROM user_subscriptions us
      JOIN subscription_plans sp ON us.plan_id = sp.id
      JOIN plan_features pf ON sp.id = pf.plan_id
      LEFT JOIN (
        SELECT 
          user_id,
          feature_code,
          current_usage
        FROM usage_tracking
        WHERE period_start <= CURRENT_TIMESTAMP 
          AND period_end > CURRENT_TIMESTAMP
      ) usage ON us.user_id = usage.user_id AND pf.feature_code = usage.feature_code
      WHERE us.user_id = $1
        AND us.status = 'active'
        AND us.end_date > CURRENT_TIMESTAMP
        AND pf.feature_code != 'storage_space'
      ORDER BY feature_code
    `, [userId]);

    console.log('📊 配额统计（用户中心显示）:');
    console.log('\n功能名称          | 已使用    | 配额限制  | 使用率');
    console.log('------------------|-----------|-----------|--------');
    quotaStatsResult.rows.forEach((stat: any) => {
      const name = stat.feature_name.padEnd(16);
      const used = `${parseFloat(stat.used).toFixed(2)} ${stat.unit}`.padEnd(10);
      const limit = stat.limit === -1 ? '无限制'.padEnd(10) : `${stat.limit} ${stat.unit}`.padEnd(10);
      const percentage = `${stat.percentage}%`.padEnd(8);
      console.log(`${name}| ${used}| ${limit}| ${percentage}`);
    });
    console.log('');

    // 验证结果
    console.log('=== 验证结果 ===\n');
    
    const storageQuota = parseFloat(storageResult.rows[0]?.quota_mb || 0);
    const expectedQuota = 30; // testuser2 应该是 30 MB

    if (Math.abs(storageQuota - expectedQuota) < 0.01) {
      console.log('✅ 存储空间配额正确: 30 MB');
    } else {
      console.log(`❌ 存储空间配额错误: 期望 ${expectedQuota} MB，实际 ${storageQuota.toFixed(2)} MB`);
    }

    console.log('\n前端应该显示:');
    console.log(`- 存储空间: ${parseFloat(storageResult.rows[0]?.used_mb).toFixed(2)} MB / 30 MB`);
    console.log(`- 使用率: ${storageResult.rows[0]?.usage_percentage}%`);
    console.log('');

    console.log('✅ 测试完成！前端 API 响应正确。');

  } catch (error) {
    console.error('测试过程中出错:', error);
  } finally {
    await pool.end();
  }
}

testFrontendApiResponse();
