/**
 * 测试套餐升级时存储配额更新
 * 
 * 测试场景：
 * 1. 查看当前各套餐的存储配额配置
 * 2. 查看指定用户的当前存储配额
 * 3. 模拟升级套餐并验证存储配额是否正确更新
 */

import { pool } from '../db/database';

async function testStorageQuotaUpgrade() {
  console.log('='.repeat(60));
  console.log('存储配额升级测试');
  console.log('='.repeat(60));

  try {
    // 1. 查看各套餐的存储配额配置
    console.log('\n📋 各套餐存储配额配置:');
    const plansResult = await pool.query(`
      SELECT 
        sp.id as plan_id,
        sp.plan_code,
        sp.plan_name,
        pf.feature_value as storage_mb,
        CASE 
          WHEN pf.feature_value = -1 THEN '无限制'
          ELSE (pf.feature_value || ' MB')
        END as storage_display
      FROM subscription_plans sp
      LEFT JOIN plan_features pf ON sp.id = pf.plan_id AND pf.feature_code = 'storage_space'
      WHERE sp.is_active = true
      ORDER BY sp.display_order
    `);

    console.log('套餐ID | 套餐代码 | 套餐名称 | 存储配额');
    console.log('-'.repeat(50));
    for (const plan of plansResult.rows) {
      console.log(`${plan.plan_id.toString().padEnd(6)} | ${plan.plan_code.padEnd(12)} | ${plan.plan_name.padEnd(10)} | ${plan.storage_display || '未配置'}`);
    }

    // 2. 查看 lzc2005 用户的当前状态
    console.log('\n📊 查找用户 lzc2005:');
    const userResult = await pool.query(`
      SELECT 
        u.id as user_id,
        u.username,
        us.id as subscription_id,
        us.plan_id,
        sp.plan_code,
        sp.plan_name,
        us.status,
        us.end_date,
        usu.storage_quota_bytes,
        usu.total_storage_bytes,
        ROUND(usu.storage_quota_bytes / 1024.0 / 1024.0, 2) as quota_mb,
        ROUND(usu.total_storage_bytes / 1024.0 / 1024.0, 2) as used_mb
      FROM users u
      LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
      LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
      LEFT JOIN user_storage_usage usu ON u.id = usu.user_id
      WHERE u.username = 'lzc2005'
    `);

    if (userResult.rows.length === 0) {
      console.log('❌ 未找到用户 lzc2005');
      
      // 列出所有用户供参考
      console.log('\n📋 现有用户列表:');
      const allUsers = await pool.query(`
        SELECT u.id, u.username, sp.plan_name, usu.storage_quota_bytes
        FROM users u
        LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
        LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
        LEFT JOIN user_storage_usage usu ON u.id = usu.user_id
        ORDER BY u.id
        LIMIT 10
      `);
      
      for (const user of allUsers.rows) {
        const quotaMB = user.storage_quota_bytes ? Math.round(user.storage_quota_bytes / 1024 / 1024) : 'N/A';
        console.log(`  ID: ${user.id}, 用户名: ${user.username}, 套餐: ${user.plan_name || '无'}, 存储配额: ${quotaMB} MB`);
      }
    } else {
      const user = userResult.rows[0];
      console.log(`  用户ID: ${user.user_id}`);
      console.log(`  用户名: ${user.username}`);
      console.log(`  当前套餐: ${user.plan_name || '无'} (ID: ${user.plan_id || 'N/A'})`);
      console.log(`  订阅状态: ${user.status || '无订阅'}`);
      console.log(`  存储配额: ${user.quota_mb || 0} MB (${user.storage_quota_bytes || 0} bytes)`);
      console.log(`  已使用: ${user.used_mb || 0} MB`);

      // 3. 检查配额是否与套餐配置一致
      if (user.plan_id) {
        const expectedQuota = await pool.query(`
          SELECT feature_value FROM plan_features 
          WHERE plan_id = $1 AND feature_code = 'storage_space'
        `, [user.plan_id]);

        if (expectedQuota.rows.length > 0) {
          const expectedMB = expectedQuota.rows[0].feature_value;
          const expectedBytes = expectedMB === -1 ? -1 : expectedMB * 1024 * 1024;
          const actualBytes = user.storage_quota_bytes || 0;

          console.log(`\n🔍 配额一致性检查:`);
          console.log(`  套餐配置: ${expectedMB === -1 ? '无限制' : expectedMB + ' MB'} (${expectedBytes} bytes)`);
          console.log(`  实际配额: ${user.quota_mb} MB (${actualBytes} bytes)`);

          if (expectedBytes === actualBytes) {
            console.log(`  ✅ 配额一致`);
          } else {
            console.log(`  ❌ 配额不一致！需要修复`);
            
            // 提供修复命令
            console.log(`\n🔧 修复命令:`);
            console.log(`  UPDATE user_storage_usage SET storage_quota_bytes = ${expectedBytes} WHERE user_id = ${user.user_id};`);
          }
        }
      }
    }

    // 4. 检查所有用户的配额一致性
    console.log('\n📊 全局配额一致性检查:');
    const inconsistentUsers = await pool.query(`
      SELECT 
        u.id as user_id,
        u.username,
        sp.plan_name,
        pf.feature_value as expected_mb,
        ROUND(usu.storage_quota_bytes / 1024.0 / 1024.0, 2) as actual_mb,
        usu.storage_quota_bytes as actual_bytes,
        CASE 
          WHEN pf.feature_value = -1 THEN -1
          ELSE pf.feature_value * 1024 * 1024
        END as expected_bytes
      FROM users u
      JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
      JOIN subscription_plans sp ON us.plan_id = sp.id
      JOIN plan_features pf ON sp.id = pf.plan_id AND pf.feature_code = 'storage_space'
      LEFT JOIN user_storage_usage usu ON u.id = usu.user_id
      WHERE usu.storage_quota_bytes IS NULL 
         OR usu.storage_quota_bytes != (
           CASE 
             WHEN pf.feature_value = -1 THEN -1
             ELSE pf.feature_value * 1024 * 1024
           END
         )
    `);

    if (inconsistentUsers.rows.length === 0) {
      console.log('✅ 所有用户的存储配额与套餐配置一致');
    } else {
      console.log(`❌ 发现 ${inconsistentUsers.rows.length} 个用户配额不一致:`);
      console.log('用户ID | 用户名 | 套餐 | 期望配额 | 实际配额');
      console.log('-'.repeat(60));
      for (const user of inconsistentUsers.rows) {
        const expectedDisplay = user.expected_mb === -1 ? '无限制' : `${user.expected_mb} MB`;
        const actualDisplay = user.actual_mb === null ? '未设置' : `${user.actual_mb} MB`;
        console.log(`${user.user_id.toString().padEnd(6)} | ${user.username.padEnd(10)} | ${user.plan_name.padEnd(8)} | ${expectedDisplay.padEnd(10)} | ${actualDisplay}`);
      }

      // 生成批量修复 SQL
      console.log('\n🔧 批量修复 SQL:');
      console.log(`
UPDATE user_storage_usage usu
SET storage_quota_bytes = (
  SELECT CASE 
    WHEN pf.feature_value = -1 THEN -1
    ELSE pf.feature_value * 1024 * 1024
  END
  FROM user_subscriptions us
  JOIN plan_features pf ON us.plan_id = pf.plan_id AND pf.feature_code = 'storage_space'
  WHERE us.user_id = usu.user_id AND us.status = 'active'
),
last_updated_at = CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1 FROM user_subscriptions us
  JOIN plan_features pf ON us.plan_id = pf.plan_id AND pf.feature_code = 'storage_space'
  WHERE us.user_id = usu.user_id AND us.status = 'active'
);
      `);
    }

    console.log('\n' + '='.repeat(60));
    console.log('测试完成');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await pool.end();
  }
}

testStorageQuotaUpgrade();
