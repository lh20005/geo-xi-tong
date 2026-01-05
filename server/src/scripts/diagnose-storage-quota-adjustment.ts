/**
 * 诊断存储空间配额调整问题
 * 检查 testuser2 的存储空间配额为什么无法修改
 */

import { pool } from '../db/database';

async function diagnoseStorageQuotaAdjustment() {
  console.log('=== 诊断存储空间配额调整问题 ===\n');

  try {
    // 1. 查找 testuser2
    console.log('1️⃣ 查找 testuser2 用户信息...');
    const userResult = await pool.query(
      'SELECT id, username, email, role FROM users WHERE username = $1',
      ['testuser2']
    );

    if (userResult.rows.length === 0) {
      console.log('❌ 未找到 testuser2 用户');
      return;
    }

    const user = userResult.rows[0];
    console.log('✅ 找到用户:', user);
    console.log('');

    // 2. 检查用户订阅信息
    console.log('2️⃣ 检查用户订阅信息...');
    const subscriptionResult = await pool.query(
      `SELECT us.*, sp.plan_name, sp.plan_code
       FROM user_subscriptions us
       JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE us.user_id = $1
       ORDER BY us.created_at DESC
       LIMIT 5`,
      [user.id]
    );

    console.log(`找到 ${subscriptionResult.rows.length} 条订阅记录:`);
    subscriptionResult.rows.forEach((sub, index) => {
      console.log(`\n订阅 ${index + 1}:`);
      console.log(`  - 套餐: ${sub.plan_name} (${sub.plan_code})`);
      console.log(`  - 状态: ${sub.status}`);
      console.log(`  - 开始时间: ${sub.start_date}`);
      console.log(`  - 结束时间: ${sub.end_date}`);
      console.log(`  - 是否激活: ${sub.status === 'active' && new Date(sub.end_date) > new Date()}`);
    });
    console.log('');

    // 3. 检查套餐的存储空间配置
    console.log('3️⃣ 检查套餐的存储空间配置...');
    const planFeaturesResult = await pool.query(
      `SELECT pf.*, sp.plan_name, sp.plan_code
       FROM plan_features pf
       JOIN subscription_plans sp ON pf.plan_id = sp.id
       WHERE pf.feature_code = 'storage_space'
       ORDER BY sp.display_order`
    );

    console.log('所有套餐的存储空间配置:');
    planFeaturesResult.rows.forEach(feature => {
      console.log(`  - ${feature.plan_name}: ${feature.feature_value} ${feature.feature_unit}`);
    });
    console.log('');

    // 4. 检查 user_storage_usage 表
    console.log('4️⃣ 检查 user_storage_usage 表...');
    const storageUsageResult = await pool.query(
      `SELECT * FROM user_storage_usage WHERE user_id = $1`,
      [user.id]
    );

    if (storageUsageResult.rows.length === 0) {
      console.log('❌ 未找到存储使用记录');
    } else {
      const storage = storageUsageResult.rows[0];
      console.log('存储使用情况:');
      console.log(`  - 配额 (storage_quota_bytes): ${storage.storage_quota_bytes} bytes (${(storage.storage_quota_bytes / (1024 * 1024)).toFixed(2)} MB)`);
      console.log(`  - 购买的存储 (purchased_storage_bytes): ${storage.purchased_storage_bytes} bytes`);
      console.log(`  - 图片存储: ${storage.image_storage_bytes} bytes`);
      console.log(`  - 文档存储: ${storage.document_storage_bytes} bytes`);
      console.log(`  - 文章存储: ${storage.article_storage_bytes} bytes`);
      console.log(`  - 总使用: ${storage.total_storage_bytes} bytes (${(storage.total_storage_bytes / (1024 * 1024)).toFixed(2)} MB)`);
      console.log(`  - 最后更新: ${storage.last_updated_at}`);
    }
    console.log('');

    // 5. 测试 get_user_storage_quota 函数
    console.log('5️⃣ 测试 get_user_storage_quota 函数...');
    const quotaFunctionResult = await pool.query(
      `SELECT get_user_storage_quota($1) as quota_bytes`,
      [user.id]
    );
    const quotaBytes = quotaFunctionResult.rows[0].quota_bytes;
    console.log(`函数返回的配额: ${quotaBytes} bytes (${(quotaBytes / (1024 * 1024)).toFixed(2)} MB)`);
    console.log('');

    // 6. 检查配额调整历史
    console.log('6️⃣ 检查配额调整历史...');
    const adjustmentResult = await pool.query(
      `SELECT * FROM quota_adjustments 
       WHERE user_id = $1 AND feature_code = 'storage_space'
       ORDER BY created_at DESC
       LIMIT 5`,
      [user.id]
    );

    if (adjustmentResult.rows.length === 0) {
      console.log('未找到配额调整记录');
    } else {
      console.log(`找到 ${adjustmentResult.rows.length} 条调整记录:`);
      adjustmentResult.rows.forEach((adj, index) => {
        console.log(`\n调整 ${index + 1}:`);
        console.log(`  - 旧值: ${adj.old_value} ${adj.value_unit}`);
        console.log(`  - 新值: ${adj.new_value} ${adj.value_unit}`);
        console.log(`  - 原因: ${adj.reason}`);
        console.log(`  - 时间: ${adj.created_at}`);
      });
    }
    console.log('');

    // 7. 检查 Redis 缓存
    console.log('7️⃣ 检查可能的缓存问题...');
    console.log('提示: 如果前端显示的值与数据库不一致，可能是缓存问题');
    console.log('建议清除 Redis 缓存键:');
    console.log(`  - user:${user.id}:subscription`);
    console.log(`  - user:${user.id}:quota`);
    console.log(`  - user:${user.id}:storage`);
    console.log('');

    // 8. 诊断结论
    console.log('=== 诊断结论 ===');
    
    const activeSubscription = subscriptionResult.rows.find(
      sub => sub.status === 'active' && new Date(sub.end_date) > new Date()
    );

    if (!activeSubscription) {
      console.log('⚠️  用户没有激活的订阅');
    } else {
      const planFeature = planFeaturesResult.rows.find(
        f => f.plan_code === activeSubscription.plan_code
      );
      
      if (planFeature) {
        const expectedQuotaMB = planFeature.feature_value;
        const actualQuotaMB = quotaBytes / (1024 * 1024);
        
        console.log(`\n当前套餐: ${activeSubscription.plan_name}`);
        console.log(`套餐配置的存储空间: ${expectedQuotaMB} MB`);
        console.log(`函数计算的配额: ${actualQuotaMB.toFixed(2)} MB`);
        console.log(`user_storage_usage 表中的配额: ${(storageUsageResult.rows[0]?.storage_quota_bytes / (1024 * 1024)).toFixed(2)} MB`);
        
        if (Math.abs(actualQuotaMB - expectedQuotaMB) > 1) {
          console.log('\n❌ 问题: 配额不同步！');
          console.log('可能原因:');
          console.log('  1. user_storage_usage 表未更新');
          console.log('  2. get_user_storage_quota 函数逻辑有问题');
          console.log('  3. 缓存未清除');
        } else {
          console.log('\n✅ 配额同步正常');
        }
      }
    }

  } catch (error) {
    console.error('诊断过程中出错:', error);
  } finally {
    await pool.end();
  }
}

diagnoseStorageQuotaAdjustment();
