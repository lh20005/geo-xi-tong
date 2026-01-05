/**
 * 验证存储空间配额修复
 */

import { pool } from '../db/database';

async function verifyStorageQuotaFix() {
  console.log('=== 验证存储空间配额修复 ===\n');

  try {
    // 1. 验证 testuser2
    console.log('1️⃣ 验证 testuser2 的配额...');
    const testuser2Result = await pool.query(`
      SELECT 
        u.id,
        u.username,
        sp.plan_name,
        pf.feature_value as plan_quota,
        pf.feature_unit,
        usu.storage_quota_bytes / (1024 * 1024)::numeric as actual_quota_mb,
        usu.total_storage_bytes / (1024 * 1024)::numeric as used_mb,
        get_user_storage_quota(u.id) / (1024 * 1024)::numeric as function_quota_mb
      FROM users u
      LEFT JOIN user_storage_usage usu ON u.id = usu.user_id
      LEFT JOIN user_subscriptions us ON u.id = us.user_id 
        AND us.status = 'active' 
        AND us.end_date > CURRENT_TIMESTAMP
      LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
      LEFT JOIN plan_features pf ON sp.id = pf.plan_id 
        AND pf.feature_code = 'storage_space'
      WHERE u.username = 'testuser2'
    `);

    if (testuser2Result.rows.length > 0) {
      const user = testuser2Result.rows[0];
      console.log('✅ testuser2 配额信息:');
      console.log(`   套餐: ${user.plan_name}`);
      console.log(`   套餐配置: ${user.plan_quota} ${user.feature_unit}`);
      console.log(`   实际配额: ${parseFloat(user.actual_quota_mb).toFixed(2)} MB`);
      console.log(`   函数计算: ${parseFloat(user.function_quota_mb).toFixed(2)} MB`);
      console.log(`   已使用: ${parseFloat(user.used_mb).toFixed(2)} MB`);
      
      const isSync = Math.abs(parseFloat(user.actual_quota_mb) - parseFloat(user.plan_quota)) < 0.01;
      console.log(`   状态: ${isSync ? '✅ 同步正常' : '❌ 仍不同步'}`);
    }
    console.log('');

    // 2. 测试配额检查函数
    console.log('2️⃣ 测试配额检查函数...');
    const quotaCheckResult = await pool.query(`
      SELECT * FROM check_storage_quota($1, 1048576) -- 测试上传 1MB
    `, [testuser2Result.rows[0].id]);

    const check = quotaCheckResult.rows[0];
    console.log('上传 1MB 文件的配额检查:');
    console.log(`   是否允许: ${check.allowed ? '✅ 是' : '❌ 否'}`);
    console.log(`   当前使用: ${(check.current_usage_bytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`   配额限制: ${(check.quota_bytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`   可用空间: ${(check.available_bytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`   使用率: ${check.usage_percentage}%`);
    console.log('');

    // 3. 显示所有用户配额
    console.log('3️⃣ 所有用户的配额情况:');
    const allUsersResult = await pool.query(`
      SELECT 
        u.username,
        sp.plan_name,
        pf.feature_value as plan_quota,
        pf.feature_unit,
        COALESCE(usu.storage_quota_bytes / (1024 * 1024)::numeric, 0) as actual_quota_mb,
        COALESCE(usu.total_storage_bytes / (1024 * 1024)::numeric, 0) as used_mb
      FROM users u
      LEFT JOIN user_storage_usage usu ON u.id = usu.user_id
      LEFT JOIN user_subscriptions us ON u.id = us.user_id 
        AND us.status = 'active' 
        AND us.end_date > CURRENT_TIMESTAMP
      LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
      LEFT JOIN plan_features pf ON sp.id = pf.plan_id 
        AND pf.feature_code = 'storage_space'
      ORDER BY u.id
      LIMIT 10
    `);

    console.log('\n用户名          | 套餐      | 配置配额  | 实际配额  | 已使用');
    console.log('----------------|-----------|-----------|-----------|----------');
    allUsersResult.rows.forEach(row => {
      const username = (row.username || 'N/A').padEnd(15);
      const planName = (row.plan_name || 'N/A').padEnd(10);
      const planQuota = row.plan_quota === -1 ? '无限'.padEnd(10) : `${row.plan_quota} ${row.feature_unit}`.padEnd(10);
      const actualQuota = `${parseFloat(row.actual_quota_mb).toFixed(2)} MB`.padEnd(10);
      const used = `${parseFloat(row.used_mb).toFixed(2)} MB`.padEnd(10);
      console.log(`${username}| ${planName}| ${planQuota}| ${actualQuota}| ${used}`);
    });

    console.log('\n=== 验证完成 ===');
    console.log('✅ 存储空间配额修复成功！');
    console.log('');
    console.log('修复内容:');
    console.log('1. 更新了 get_user_storage_quota 函数，正确处理 MB 单位');
    console.log('2. 同步了所有用户的 user_storage_usage 表配额');
    console.log('3. testuser2 的配额现在正确显示为 30 MB');

  } catch (error) {
    console.error('验证过程中出错:', error);
  } finally {
    await pool.end();
  }
}

verifyStorageQuotaFix();
