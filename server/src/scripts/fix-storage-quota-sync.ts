/**
 * 修复存储空间配额同步问题
 * 1. 更新 get_user_storage_quota 函数以正确处理 MB 单位
 * 2. 同步 user_storage_usage 表中的配额值
 */

import { pool } from '../db/database';

async function fixStorageQuotaSync() {
  console.log('=== 修复存储空间配额同步问题 ===\n');

  try {
    // 1. 更新 get_user_storage_quota 函数
    console.log('1️⃣ 更新 get_user_storage_quota 函数...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION get_user_storage_quota(p_user_id INTEGER)
      RETURNS BIGINT AS $$
      DECLARE
        v_plan_id INTEGER;
        v_quota_value BIGINT;
        v_quota_unit VARCHAR(20);
        v_quota_bytes BIGINT;
        v_user_role VARCHAR(50);
      BEGIN
        -- 检查用户角色
        SELECT role INTO v_user_role FROM users WHERE id = p_user_id;
        
        -- 管理员获得 1GB 存储
        IF v_user_role = 'admin' THEN
          RETURN 1073741824; -- 1GB in bytes
        END IF;
        
        -- 获取用户当前订阅的套餐
        SELECT us.plan_id INTO v_plan_id
        FROM user_subscriptions us
        WHERE us.user_id = p_user_id 
          AND us.status = 'active'
          AND us.end_date > CURRENT_TIMESTAMP
        ORDER BY us.end_date DESC
        LIMIT 1;
        
        -- 如果没有订阅，返回默认 10MB
        IF v_plan_id IS NULL THEN
          RETURN 10485760; -- 10MB in bytes
        END IF;
        
        -- 获取套餐的存储配额（值和单位）
        SELECT pf.feature_value, pf.feature_unit 
        INTO v_quota_value, v_quota_unit
        FROM plan_features pf
        WHERE pf.plan_id = v_plan_id AND pf.feature_code = 'storage_space';
        
        -- 如果套餐没有定义存储配额，返回默认 10MB
        IF v_quota_value IS NULL THEN
          RETURN 10485760;
        END IF;
        
        -- 无限制配额
        IF v_quota_value = -1 THEN
          RETURN -1;
        END IF;
        
        -- 根据单位转换为字节
        IF v_quota_unit = 'MB' THEN
          v_quota_bytes := v_quota_value * 1024 * 1024;
        ELSIF v_quota_unit = 'GB' THEN
          v_quota_bytes := v_quota_value * 1024 * 1024 * 1024;
        ELSIF v_quota_unit = 'bytes' THEN
          v_quota_bytes := v_quota_value;
        ELSE
          -- 默认假设是 MB
          v_quota_bytes := v_quota_value * 1024 * 1024;
        END IF;
        
        RETURN v_quota_bytes;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ 函数已更新\n');

    // 2. 同步所有用户的存储配额
    console.log('2️⃣ 同步所有用户的存储配额...');
    const result = await pool.query(`
      UPDATE user_storage_usage
      SET storage_quota_bytes = get_user_storage_quota(user_id),
          last_updated_at = CURRENT_TIMESTAMP
      WHERE user_id IN (SELECT id FROM users)
      RETURNING user_id, storage_quota_bytes;
    `);

    console.log(`✅ 已更新 ${result.rows.length} 个用户的存储配额\n`);

    // 3. 验证 testuser2 的配额
    console.log('3️⃣ 验证 testuser2 的配额...');
    const testuser2Result = await pool.query(`
      SELECT 
        u.id,
        u.username,
        usu.storage_quota_bytes,
        usu.storage_quota_bytes / (1024 * 1024) as quota_mb,
        get_user_storage_quota(u.id) as function_quota_bytes,
        get_user_storage_quota(u.id) / (1024 * 1024) as function_quota_mb,
        sp.plan_name,
        pf.feature_value as plan_feature_value,
        pf.feature_unit as plan_feature_unit
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
      console.log('testuser2 配额信息:');
      console.log(`  - 用户名: ${user.username}`);
      console.log(`  - 当前套餐: ${user.plan_name || '无'}`);
      console.log(`  - 套餐配置: ${user.plan_feature_value} ${user.plan_feature_unit}`);
      console.log(`  - user_storage_usage 表配额: ${user.quota_mb} MB`);
      console.log(`  - 函数计算配额: ${user.function_quota_mb} MB`);
      
      if (Math.abs(user.quota_mb - user.function_quota_mb) < 0.01) {
        console.log('  ✅ 配额同步正常！');
      } else {
        console.log('  ❌ 配额仍不同步');
      }
    }
    console.log('');

    // 4. 显示所有用户的配额情况
    console.log('4️⃣ 所有用户的配额情况:');
    const allUsersResult = await pool.query(`
      SELECT 
        u.username,
        sp.plan_name,
        pf.feature_value as plan_quota,
        pf.feature_unit,
        usu.storage_quota_bytes / (1024 * 1024) as actual_quota_mb,
        usu.total_storage_bytes / (1024 * 1024) as used_mb
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

    console.log('\n用户名 | 套餐 | 配置配额 | 实际配额 | 已使用');
    console.log('------|------|---------|---------|--------');
    allUsersResult.rows.forEach(row => {
      const planQuota = row.plan_quota === -1 ? '无限' : `${row.plan_quota} ${row.feature_unit}`;
      const actualQuota = row.actual_quota_mb ? `${row.actual_quota_mb.toFixed(2)} MB` : 'N/A';
      const used = row.used_mb ? `${row.used_mb.toFixed(2)} MB` : '0 MB';
      console.log(`${row.username} | ${row.plan_name || 'N/A'} | ${planQuota} | ${actualQuota} | ${used}`);
    });

    console.log('\n=== 修复完成 ===');

  } catch (error) {
    console.error('修复过程中出错:', error);
  } finally {
    await pool.end();
  }
}

fixStorageQuotaSync();
