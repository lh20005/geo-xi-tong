/**
 * 修复存储配额显示问题
 * 
 * 问题：
 * 1. plan_features 表中 storage_space 的 feature_value 显示为 20（应该是字节数）
 * 2. 用户中心显示 0/20 而不是正确的存储空间
 * 3. 需要将配额值从错误的数字修正为正确的字节数
 */

import { pool } from '../db/database';

async function fixStorageQuotaDisplay() {
  console.log('='.repeat(80));
  console.log('修复存储配额显示问题');
  console.log('='.repeat(80));
  console.log();

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // 1. 检查当前的 plan_features 配置
    console.log('📊 1. 检查当前的套餐存储配额配置');
    console.log('-'.repeat(80));
    
    const currentConfig = await client.query(`
      SELECT 
        sp.id as plan_id,
        sp.plan_name,
        sp.plan_code,
        pf.feature_code,
        pf.feature_name,
        pf.feature_value,
        pf.feature_unit
      FROM subscription_plans sp
      LEFT JOIN plan_features pf ON sp.id = pf.plan_id AND pf.feature_code = 'storage_space'
      ORDER BY sp.id
    `);

    console.log('\n当前配置:');
    for (const row of currentConfig.rows) {
      console.log(`  ${row.plan_name} (${row.plan_code}):`);
      if (row.feature_value !== null) {
        console.log(`    存储配额: ${formatBytes(Number(row.feature_value))} (原始值: ${row.feature_value} ${row.feature_unit})`);
      } else {
        console.log(`    ⚠️  未配置存储配额`);
      }
    }

    // 2. 修复套餐配额
    console.log('\n\n🔧 2. 修复套餐存储配额');
    console.log('-'.repeat(80));

    const fixes = [
      { plan_code: 'free', quota_bytes: 100 * 1024 * 1024, name: '体验版 (100MB)' },
      { plan_code: 'professional', quota_bytes: 1 * 1024 * 1024 * 1024, name: '专业版 (1GB)' },
      { plan_code: 'enterprise', quota_bytes: -1, name: '企业版 (无限)' }
    ];

    for (const fix of fixes) {
      console.log(`\n修复 ${fix.name}:`);
      
      // 获取套餐 ID
      const planResult = await client.query(
        'SELECT id FROM subscription_plans WHERE plan_code = $1',
        [fix.plan_code]
      );

      if (planResult.rows.length === 0) {
        console.log(`  ⚠️  套餐 ${fix.plan_code} 不存在，跳过`);
        continue;
      }

      const planId = planResult.rows[0].id;

      // 更新或插入配额
      const updateResult = await client.query(`
        INSERT INTO plan_features (plan_id, feature_code, feature_name, feature_value, feature_unit)
        VALUES ($1, 'storage_space', '存储空间', $2, 'bytes')
        ON CONFLICT (plan_id, feature_code) 
        DO UPDATE SET 
          feature_value = $2,
          feature_unit = 'bytes'
        RETURNING feature_value
      `, [planId, fix.quota_bytes]);

      console.log(`  ✅ 已更新: ${formatBytes(fix.quota_bytes)}`);
    }

    // 3. 更新用户存储配额
    console.log('\n\n🔄 3. 更新用户存储配额');
    console.log('-'.repeat(80));

    // 更新所有有活跃订阅的用户
    const updateUsersResult = await client.query(`
      WITH active_subscriptions AS (
        SELECT DISTINCT ON (us.user_id)
          us.user_id,
          us.plan_id,
          pf.feature_value as new_quota
        FROM user_subscriptions us
        JOIN plan_features pf ON us.plan_id = pf.plan_id AND pf.feature_code = 'storage_space'
        WHERE us.status = 'active'
          AND us.end_date > CURRENT_TIMESTAMP
        ORDER BY us.user_id, us.end_date DESC
      )
      UPDATE user_storage_usage usu
      SET 
        storage_quota_bytes = asub.new_quota,
        last_updated_at = CURRENT_TIMESTAMP
      FROM active_subscriptions asub
      WHERE usu.user_id = asub.user_id
        AND usu.storage_quota_bytes != asub.new_quota
      RETURNING usu.user_id, usu.storage_quota_bytes
    `);

    console.log(`\n✅ 已更新 ${updateUsersResult.rows.length} 个用户的存储配额`);
    
    if (updateUsersResult.rows.length > 0) {
      console.log('\n更新的用户:');
      for (const row of updateUsersResult.rows) {
        const userResult = await client.query('SELECT username FROM users WHERE id = $1', [row.user_id]);
        const username = userResult.rows[0]?.username || 'Unknown';
        console.log(`  - ${username} (ID: ${row.user_id}): ${formatBytes(Number(row.storage_quota_bytes))}`);
      }
    }

    // 4. 更新管理员用户的配额
    console.log('\n\n👑 4. 更新管理员用户配额');
    console.log('-'.repeat(80));

    const adminUpdateResult = await client.query(`
      UPDATE user_storage_usage
      SET 
        storage_quota_bytes = 1073741824,  -- 1GB
        last_updated_at = CURRENT_TIMESTAMP
      WHERE user_id IN (SELECT id FROM users WHERE role = 'admin')
        AND storage_quota_bytes != 1073741824
      RETURNING user_id
    `);

    console.log(`\n✅ 已更新 ${adminUpdateResult.rows.length} 个管理员的存储配额为 1GB`);

    // 5. 验证修复结果
    console.log('\n\n✅ 5. 验证修复结果');
    console.log('-'.repeat(80));

    const verifyResult = await client.query(`
      SELECT 
        sp.plan_name,
        sp.plan_code,
        pf.feature_value,
        COUNT(DISTINCT us.user_id) as user_count
      FROM subscription_plans sp
      LEFT JOIN plan_features pf ON sp.id = pf.plan_id AND pf.feature_code = 'storage_space'
      LEFT JOIN user_subscriptions us ON sp.id = us.plan_id AND us.status = 'active'
      GROUP BY sp.id, sp.plan_name, sp.plan_code, pf.feature_value
      ORDER BY sp.id
    `);

    console.log('\n修复后的配置:');
    for (const row of verifyResult.rows) {
      console.log(`  ${row.plan_name} (${row.plan_code}):`);
      console.log(`    存储配额: ${formatBytes(Number(row.feature_value))}`);
      console.log(`    活跃用户数: ${row.user_count}`);
    }

    // 6. 清除 Redis 缓存
    console.log('\n\n🗑️  6. 清除 Redis 缓存');
    console.log('-'.repeat(80));
    
    const Redis = require('ioredis');
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });

    try {
      // 清除所有存储相关的缓存
      const keys = await redis.keys('storage:user:*');
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`\n✅ 已清除 ${keys.length} 个存储缓存`);
      } else {
        console.log('\n✅ 没有需要清除的缓存');
      }
      await redis.quit();
    } catch (error) {
      console.log('\n⚠️  清除缓存失败（可能 Redis 未运行）:', error);
    }

    await client.query('COMMIT');
    console.log('\n\n✅ 所有修复已提交');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ 修复失败，已回滚:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

function formatBytes(bytes: number): string {
  if (bytes === -1) return '无限';
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// 运行修复
fixStorageQuotaDisplay()
  .then(() => {
    console.log('\n✅ 修复完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 修复失败:', error);
    process.exit(1);
  });
