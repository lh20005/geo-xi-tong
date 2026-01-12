/**
 * 简化的配额同步检查
 * 专注于检查配额调整后的同步问题
 */

import { pool } from '../db/database';
import { redisClient } from '../db/redis';

async function checkQuotaSync() {
  console.log('========================================');
  console.log('配额同步检查');
  console.log('========================================\n');

  try {
    // 1. 获取测试用户
    const users = await pool.query(`
      SELECT id, username FROM users 
      WHERE username IN ('testuser', 'testuser2', 'lzc2005')
      ORDER BY id
    `);

    for (const user of users.rows) {
      console.log(`\n--- 用户: ${user.username} (ID: ${user.id}) ---\n`);

      // 2. 检查 user_subscriptions.custom_quotas
      const subscription = await pool.query(`
        SELECT custom_quotas, status, end_date
        FROM user_subscriptions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `, [user.id]);

      if (subscription.rows.length === 0) {
        console.log('❌ 没有订阅记录\n');
        continue;
      }

      const sub = subscription.rows[0];
      console.log('1. user_subscriptions.custom_quotas:');
      console.log(JSON.stringify(sub.custom_quotas, null, 2));

      // 3. 检查 user_usage 表（当前使用量）
      const userUsage = await pool.query(`
        SELECT feature_code, current_usage, period_start, period_end
        FROM user_usage
        WHERE user_id = $1
      `, [user.id]);

      console.log('\n2. user_usage 表（当前使用量）:');
      if (userUsage.rows.length === 0) {
        console.log('   无记录');
      } else {
        userUsage.rows.forEach(row => {
          console.log(`   ${row.feature_code}: 使用 ${row.current_usage} (周期: ${row.period_start?.toISOString().split('T')[0]} ~ ${row.period_end?.toISOString().split('T')[0]})`);
        });
      }

      // 4. 调用 check_user_quota 检查各项配额
      console.log('\n3. check_user_quota 函数结果:');
      const features = [
        'articles_per_month',
        'publish_per_month',
        'platform_accounts',
        'keyword_distillation'
      ];

      for (const feature of features) {
        const result = await pool.query(`
          SELECT * FROM check_user_quota($1, $2)
        `, [user.id, feature]);

        if (result.rows.length > 0) {
          const quota = result.rows[0];
          console.log(`   ${feature}:`);
          console.log(`     限制: ${quota.quota_limit}, 使用: ${quota.current_usage}, 剩余: ${quota.remaining}`);
          
          // 对比 custom_quotas
          if (sub.custom_quotas && sub.custom_quotas[feature] !== undefined) {
            const customValue = sub.custom_quotas[feature];
            if (quota.quota_limit !== customValue) {
              console.log(`     ⚠️  不一致！custom_quotas: ${customValue}, 实际: ${quota.quota_limit}`);
            }
          }
        }
      }

      // 5. 检查存储配额
      const storage = await pool.query(`
        SELECT storage_quota_bytes, used_storage_bytes
        FROM user_storage_usage
        WHERE user_id = $1
      `, [user.id]);

      if (storage.rows.length > 0) {
        const storageMB = storage.rows[0].storage_quota_bytes / 1024 / 1024;
        console.log(`\n4. 存储配额: ${storageMB.toFixed(2)} MB`);
        
        if (sub.custom_quotas && sub.custom_quotas.storage_space !== undefined) {
          const customStorageMB = sub.custom_quotas.storage_space;
          if (Math.abs(storageMB - customStorageMB) > 0.01) {
            console.log(`   ⚠️  不一致！custom_quotas: ${customStorageMB} MB, 实际: ${storageMB.toFixed(2)} MB`);
          }
        }
      }

      // 6. 检查 Redis 缓存
      console.log('\n5. Redis 缓存:');
      const cacheKey = `user:${user.id}:quotas`;
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log(`   ${cacheKey}: 存在（可能导致旧数据）`);
        console.log('   建议清除缓存');
      } else {
        console.log(`   ${cacheKey}: 不存在（正常）`);
      }
    }

    // 7. 检查触发器状态
    console.log('\n\n========================================');
    console.log('触发器检查');
    console.log('========================================\n');

    const triggers = await pool.query(`
      SELECT 
        t.tgname as trigger_name,
        c.relname as table_name,
        t.tgenabled as enabled
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      WHERE t.tgname LIKE '%quota%' OR t.tgname LIKE '%sync%'
      ORDER BY c.relname, t.tgname
    `);

    triggers.rows.forEach(row => {
      const status = row.enabled === 'O' ? '✅ 启用' : '❌ 禁用';
      console.log(`${status} - ${row.table_name}.${row.trigger_name}`);
    });

    console.log('\n========================================');
    console.log('检查完成');
    console.log('========================================\n');

  } catch (error) {
    console.error('检查失败:', error);
    throw error;
  } finally {
    await pool.end();
    await redisClient.quit();
  }
}

checkQuotaSync().catch(console.error);
