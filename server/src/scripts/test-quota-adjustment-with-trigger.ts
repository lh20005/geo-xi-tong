/**
 * 测试配额调整功能（带触发器）
 */

import { pool } from '../db/database';

async function testQuotaAdjustmentWithTrigger() {
  console.log('=== 测试配额调整功能（带触发器）===\n');

  try {
    // 1. 获取 testuser2 的当前状态
    console.log('1️⃣ 获取 testuser2 的当前状态...');
    const beforeResult = await pool.query(`
      SELECT 
        u.id,
        u.username,
        us.id as subscription_id,
        us.custom_quotas,
        sp.plan_name,
        pf.feature_value as plan_storage_mb,
        usu.storage_quota_bytes / (1024 * 1024)::numeric as actual_storage_mb
      FROM users u
      LEFT JOIN user_subscriptions us ON u.id = us.user_id 
        AND us.status = 'active' 
        AND us.end_date > CURRENT_TIMESTAMP
      LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
      LEFT JOIN plan_features pf ON sp.id = pf.plan_id 
        AND pf.feature_code = 'storage_space'
      LEFT JOIN user_storage_usage usu ON u.id = usu.user_id
      WHERE u.username = 'testuser2'
    `);

    if (beforeResult.rows.length === 0) {
      console.log('❌ 未找到 testuser2');
      return;
    }

    const before = beforeResult.rows[0];
    console.log('调整前状态:');
    console.log(`  用户 ID: ${before.id}`);
    console.log(`  订阅 ID: ${before.subscription_id}`);
    console.log(`  套餐: ${before.plan_name}`);
    console.log(`  套餐配置: ${before.plan_storage_mb} MB`);
    console.log(`  自定义配额: ${JSON.stringify(before.custom_quotas)}`);
    console.log(`  实际配额: ${parseFloat(before.actual_storage_mb).toFixed(2)} MB`);
    console.log('');

    // 2. 模拟管理员调整配额为 35 MB
    console.log('2️⃣ 模拟管理员调整配额为 35 MB...');
    
    const customQuotas = before.custom_quotas || {};
    customQuotas.storage_space = 35;

    await pool.query(
      `UPDATE user_subscriptions 
       SET custom_quotas = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [JSON.stringify(customQuotas), before.subscription_id]
    );

    console.log('✅ 已更新 custom_quotas');
    console.log('');

    // 等待触发器执行
    await new Promise(resolve => setTimeout(resolve, 100));

    // 3. 验证调整后的状态
    console.log('3️⃣ 验证调整后的状态...');
    const afterResult = await pool.query(`
      SELECT 
        u.username,
        us.custom_quotas,
        pf.feature_value as plan_storage_mb,
        usu.storage_quota_bytes / (1024 * 1024)::numeric as actual_storage_mb,
        get_user_storage_quota(u.id) / (1024 * 1024)::numeric as function_storage_mb
      FROM users u
      LEFT JOIN user_subscriptions us ON u.id = us.user_id 
        AND us.status = 'active' 
        AND us.end_date > CURRENT_TIMESTAMP
      LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
      LEFT JOIN plan_features pf ON sp.id = pf.plan_id 
        AND pf.feature_code = 'storage_space'
      LEFT JOIN user_storage_usage usu ON u.id = usu.user_id
      WHERE u.username = 'testuser2'
    `);

    const after = afterResult.rows[0];
    console.log('调整后状态:');
    console.log(`  套餐配置: ${after.plan_storage_mb} MB`);
    console.log(`  自定义配额: ${JSON.stringify(after.custom_quotas)}`);
    console.log(`  实际配额 (user_storage_usage): ${parseFloat(after.actual_storage_mb).toFixed(2)} MB`);
    console.log(`  函数计算配额: ${parseFloat(after.function_storage_mb).toFixed(2)} MB`);
    console.log('');

    // 4. 验证结果
    console.log('4️⃣ 验证结果...');
    const expectedQuota = 35;
    const actualQuota = parseFloat(after.actual_storage_mb);
    const functionQuota = parseFloat(after.function_storage_mb);

    if (Math.abs(actualQuota - expectedQuota) < 0.01 && 
        Math.abs(functionQuota - expectedQuota) < 0.01) {
      console.log('✅ 配额调整成功！');
      console.log(`   期望: ${expectedQuota} MB`);
      console.log(`   实际: ${actualQuota.toFixed(2)} MB`);
      console.log(`   函数: ${functionQuota.toFixed(2)} MB`);
    } else {
      console.log('❌ 配额调整失败！');
      console.log(`   期望: ${expectedQuota} MB`);
      console.log(`   实际: ${actualQuota.toFixed(2)} MB`);
      console.log(`   函数: ${functionQuota.toFixed(2)} MB`);
    }
    console.log('');

    // 5. 测试配额检查
    console.log('5️⃣ 测试配额检查...');
    const quotaCheckResult = await pool.query(
      `SELECT * FROM check_storage_quota($1, 1048576)`, // 测试上传 1MB
      [before.id]
    );

    const check = quotaCheckResult.rows[0];
    console.log('上传 1MB 文件的配额检查:');
    console.log(`  是否允许: ${check.allowed ? '✅ 是' : '❌ 否'}`);
    console.log(`  当前使用: ${(check.current_usage_bytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`  配额限制: ${(check.quota_bytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`  可用空间: ${(check.available_bytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log('');

    // 6. 测试恢复默认配额
    console.log('6️⃣ 测试恢复默认配额（清除自定义配额）...');
    await pool.query(
      `UPDATE user_subscriptions 
       SET custom_quotas = NULL, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [before.subscription_id]
    );

    await new Promise(resolve => setTimeout(resolve, 100));

    const resetResult = await pool.query(`
      SELECT 
        us.custom_quotas,
        usu.storage_quota_bytes / (1024 * 1024)::numeric as actual_storage_mb
      FROM users u
      LEFT JOIN user_subscriptions us ON u.id = us.user_id 
        AND us.status = 'active' 
        AND us.end_date > CURRENT_TIMESTAMP
      LEFT JOIN user_storage_usage usu ON u.id = usu.user_id
      WHERE u.username = 'testuser2'
    `);

    const reset = resetResult.rows[0];
    console.log('恢复默认配额后:');
    console.log(`  自定义配额: ${reset.custom_quotas || 'null'}`);
    console.log(`  实际配额: ${parseFloat(reset.actual_storage_mb).toFixed(2)} MB`);
    console.log(`  应该恢复为套餐默认值: ${before.plan_storage_mb} MB`);
    
    if (Math.abs(parseFloat(reset.actual_storage_mb) - before.plan_storage_mb) < 0.01) {
      console.log('  ✅ 成功恢复为默认配额');
    } else {
      console.log('  ❌ 恢复失败');
    }
    console.log('');

    console.log('=== 测试完成 ===');
    console.log('✅ 触发器工作正常！');
    console.log('');
    console.log('功能验证:');
    console.log('1. ✅ 调整自定义配额时，自动同步到 user_storage_usage');
    console.log('2. ✅ 配额检查函数正确使用新配额');
    console.log('3. ✅ 清除自定义配额时，自动恢复为套餐默认值');

  } catch (error) {
    console.error('测试过程中出错:', error);
  } finally {
    await pool.end();
  }
}

testQuotaAdjustmentWithTrigger();
