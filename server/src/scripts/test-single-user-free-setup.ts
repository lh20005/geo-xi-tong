/**
 * 测试单个用户的免费版订阅配置
 * 
 * 使用方法:
 * npx ts-node src/scripts/test-single-user-free-setup.ts <username>
 */

import { pool } from '../db/database';

async function testUserSetup(username: string) {
  console.log('========================================');
  console.log(`测试用户 ${username} 的免费版配置`);
  console.log('========================================\n');

  try {
    // 1. 查找用户
    const userResult = await pool.query(
      'SELECT id, username, email, created_at FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      console.log(`❌ 用户 ${username} 不存在\n`);
      return;
    }

    const user = userResult.rows[0];
    console.log('用户信息:');
    console.log(`  ID: ${user.id}`);
    console.log(`  用户名: ${user.username}`);
    console.log(`  邮箱: ${user.email || '未设置'}`);
    console.log(`  注册时间: ${user.created_at.toISOString()}\n`);

    // 2. 检查订阅状态
    console.log('订阅状态:');
    const subscriptionResult = await pool.query(`
      SELECT 
        us.id,
        sp.plan_name,
        sp.plan_code,
        us.status,
        us.start_date,
        us.end_date,
        us.is_gift,
        us.gift_reason
      FROM user_subscriptions us
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.user_id = $1
      ORDER BY us.created_at DESC
      LIMIT 1
    `, [user.id]);

    if (subscriptionResult.rows.length === 0) {
      console.log('  ❌ 没有订阅记录\n');
    } else {
      const sub = subscriptionResult.rows[0];
      const isActive = sub.status === 'active' && new Date(sub.end_date) > new Date();
      
      console.log(`  ${isActive ? '✅' : '❌'} 订阅ID: ${sub.id}`);
      console.log(`  套餐: ${sub.plan_name} (${sub.plan_code})`);
      console.log(`  状态: ${sub.status}`);
      console.log(`  有效期: ${sub.start_date.toISOString().split('T')[0]} 至 ${sub.end_date.toISOString().split('T')[0]}`);
      console.log(`  是否赠送: ${sub.is_gift ? '是' : '否'}`);
      if (sub.gift_reason) {
        console.log(`  赠送原因: ${sub.gift_reason}`);
      }
      console.log('');
    }

    // 3. 检查功能配额
    console.log('功能配额:');
    const quotaResult = await pool.query(`
      SELECT 
        uu.feature_code,
        uu.usage_count,
        uu.period_start,
        uu.period_end,
        pf.feature_name,
        pf.feature_value as quota_limit,
        pf.feature_unit
      FROM user_usage uu
      LEFT JOIN user_subscriptions us ON uu.user_id = us.user_id
      LEFT JOIN plan_features pf ON us.plan_id = pf.plan_id AND uu.feature_code = pf.feature_code
      WHERE uu.user_id = $1
        AND us.status = 'active'
        AND us.end_date > CURRENT_TIMESTAMP
      ORDER BY uu.feature_code
    `, [user.id]);

    if (quotaResult.rows.length === 0) {
      console.log('  ❌ 没有配额记录\n');
    } else {
      for (const quota of quotaResult.rows) {
        const percentage = quota.quota_limit > 0 
          ? ((quota.usage_count / quota.quota_limit) * 100).toFixed(1)
          : '0.0';
        
        console.log(`  ${quota.feature_name || quota.feature_code}:`);
        console.log(`    已使用: ${quota.usage_count} / ${quota.quota_limit} ${quota.feature_unit} (${percentage}%)`);
        console.log(`    周期: ${quota.period_start.toISOString().split('T')[0]} 至 ${quota.period_end.toISOString().split('T')[0]}`);
      }
      console.log('');
    }

    // 4. 检查存储空间
    console.log('存储空间:');
    const storageResult = await pool.query(`
      SELECT 
        storage_quota_bytes,
        purchased_storage_bytes,
        image_storage_bytes,
        document_storage_bytes,
        article_storage_bytes,
        last_updated_at
      FROM user_storage_usage
      WHERE user_id = $1
    `, [user.id]);

    if (storageResult.rows.length === 0) {
      console.log('  ❌ 没有存储记录\n');
    } else {
      const storage = storageResult.rows[0];
      const totalQuota = storage.storage_quota_bytes + storage.purchased_storage_bytes;
      const totalUsed = storage.image_storage_bytes + storage.document_storage_bytes + storage.article_storage_bytes;
      const percentage = totalQuota > 0 ? ((totalUsed / totalQuota) * 100).toFixed(1) : '0.0';
      
      console.log(`  总配额: ${(totalQuota / (1024 * 1024)).toFixed(2)} MB`);
      console.log(`    - 套餐配额: ${(storage.storage_quota_bytes / (1024 * 1024)).toFixed(2)} MB`);
      console.log(`    - 购买配额: ${(storage.purchased_storage_bytes / (1024 * 1024)).toFixed(2)} MB`);
      console.log(`  已使用: ${(totalUsed / (1024 * 1024)).toFixed(2)} MB (${percentage}%)`);
      console.log(`    - 图片: ${(storage.image_storage_bytes / (1024 * 1024)).toFixed(2)} MB`);
      console.log(`    - 文档: ${(storage.document_storage_bytes / (1024 * 1024)).toFixed(2)} MB`);
      console.log(`    - 文章: ${(storage.article_storage_bytes / (1024 * 1024)).toFixed(2)} MB`);
      console.log(`  最后更新: ${storage.last_updated_at.toISOString()}`);
      console.log('');
    }

    // 5. 总结
    console.log('========================================');
    console.log('配置检查总结');
    console.log('========================================');
    
    const hasSubscription = subscriptionResult.rows.length > 0 && 
                           subscriptionResult.rows[0].status === 'active' &&
                           new Date(subscriptionResult.rows[0].end_date) > new Date();
    const hasQuota = quotaResult.rows.length > 0;
    const hasStorage = storageResult.rows.length > 0;
    
    console.log(`订阅状态: ${hasSubscription ? '✅ 正常' : '❌ 缺失'}`);
    console.log(`功能配额: ${hasQuota ? '✅ 已配置' : '❌ 未配置'}`);
    console.log(`存储空间: ${hasStorage ? '✅ 已配置' : '❌ 未配置'}`);
    
    if (hasSubscription && hasQuota && hasStorage) {
      console.log('\n✅ 用户配置完整，可以正常使用系统');
    } else {
      console.log('\n⚠️  用户配置不完整，建议运行以下命令修复:');
      console.log('   npx ts-node src/scripts/reset-users-to-free-subscription.ts');
    }
    console.log('');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// 从命令行参数获取用户名
const username = process.argv[2];

if (!username) {
  console.error('❌ 请提供用户名');
  console.error('使用方法: npx ts-node src/scripts/test-single-user-free-setup.ts <username>');
  process.exit(1);
}

testUserSetup(username);
