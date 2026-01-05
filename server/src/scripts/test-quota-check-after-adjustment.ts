/**
 * 测试配额调整后的检查
 * 模拟用户调整配额后，在文章生成页面检查配额的场景
 */

import { pool } from '../db/database';
import { redisClient } from '../db/redis';

async function testQuotaCheck() {
  console.log('========================================');
  console.log('测试配额调整后的检查');
  console.log('========================================\n');

  try {
    // 使用 lzc2005 用户进行测试
    const userId = 1;
    const username = 'lzc2005';

    console.log(`测试用户: ${username} (ID: ${userId})\n`);

    // 1. 查看当前 custom_quotas
    console.log('1. 当前自定义配额 (user_subscriptions.custom_quotas):');
    const sub = await pool.query(`
      SELECT custom_quotas, status, end_date
      FROM user_subscriptions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [userId]);

    if (sub.rows.length > 0) {
      console.log(JSON.stringify(sub.rows[0].custom_quotas, null, 2));
      console.log(`状态: ${sub.rows[0].status}`);
      console.log(`到期: ${sub.rows[0].end_date}\n`);
    }

    // 2. 清除 Redis 缓存（模拟配额调整后应该做的操作）
    console.log('2. 清除 Redis 缓存...');
    const cacheKeys = [
      `user:${userId}:subscription`,
      `user:${userId}:quotas`,
      `user:${userId}:storage`,
      `storage:usage:${userId}`
    ];

    for (const key of cacheKeys) {
      const deleted = await redisClient.del(key);
      if (deleted > 0) {
        console.log(`   ✅ 已删除: ${key}`);
      } else {
        console.log(`   ⚪ 不存在: ${key}`);
      }
    }
    console.log();

    // 3. 调用 check_user_quota 函数（模拟文章生成页面的检查）
    console.log('3. 检查文章生成配额 (check_user_quota):');
    const quotaCheck = await pool.query(`
      SELECT * FROM check_user_quota($1, $2)
    `, [userId, 'articles_per_month']);

    if (quotaCheck.rows.length > 0) {
      const quota = quotaCheck.rows[0];
      console.log(`   配额限制: ${quota.quota_limit}`);
      console.log(`   当前使用: ${quota.current_usage}`);
      console.log(`   剩余配额: ${quota.remaining}`);
      console.log(`   有配额: ${quota.has_quota ? '✅ 是' : '❌ 否'}`);
      console.log(`   使用百分比: ${quota.percentage}%\n`);

      // 对比 custom_quotas
      if (sub.rows.length > 0 && sub.rows[0].custom_quotas) {
        const customValue = sub.rows[0].custom_quotas.articles_per_month;
        console.log(`4. 配额一致性检查:`);
        console.log(`   custom_quotas 中的值: ${customValue}`);
        console.log(`   check_user_quota 返回的值: ${quota.quota_limit}`);
        
        if (quota.quota_limit === customValue) {
          console.log(`   ✅ 一致\n`);
        } else {
          console.log(`   ❌ 不一致！这就是问题所在！\n`);
          
          // 诊断原因
          console.log('5. 诊断不一致的原因:');
          
          // 检查 check_user_quota 函数的逻辑
          console.log('   检查 check_user_quota 函数是否正确读取 custom_quotas...');
          
          // 直接查询看函数内部逻辑
          const directQuery = await pool.query(`
            SELECT 
              us.custom_quotas,
              us.custom_quotas->>'articles_per_month' as custom_articles,
              sp.plan_code
            FROM user_subscriptions us
            LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
            WHERE us.user_id = $1
              AND us.status = 'active'
              AND us.end_date > CURRENT_TIMESTAMP
            ORDER BY us.created_at DESC
            LIMIT 1
          `, [userId]);
          
          if (directQuery.rows.length > 0) {
            const row = directQuery.rows[0];
            console.log(`   custom_quotas 字段: ${JSON.stringify(row.custom_quotas)}`);
            console.log(`   提取的 articles_per_month: ${row.custom_articles}`);
            console.log(`   套餐代码: ${row.plan_code}\n`);
          }
        }
      }
    } else {
      console.log('   ❌ 没有返回配额信息\n');
    }

    // 6. 模拟文章生成请求
    console.log('6. 模拟文章生成请求（需要 3 篇文章）:');
    const articleCount = 3;
    
    if (quotaCheck.rows.length > 0) {
      const quota = quotaCheck.rows[0];
      
      if (!quota.has_quota || quota.remaining < articleCount) {
        console.log(`   ❌ 配额不足！`);
        console.log(`   需要: ${articleCount} 篇`);
        console.log(`   剩余: ${quota.remaining} 篇`);
        console.log(`   总配额: ${quota.quota_limit} 篇`);
        console.log(`\n   这就是用户看到的错误！\n`);
      } else {
        console.log(`   ✅ 配额充足`);
        console.log(`   需要: ${articleCount} 篇`);
        console.log(`   剩余: ${quota.remaining} 篇\n`);
      }
    }

    // 7. 检查 check_user_quota 函数定义
    console.log('7. 检查 check_user_quota 函数定义:');
    const funcDef = await pool.query(`
      SELECT pg_get_functiondef(oid) as definition
      FROM pg_proc
      WHERE proname = 'check_user_quota'
      LIMIT 1
    `);

    if (funcDef.rows.length > 0) {
      const def = funcDef.rows[0].definition;
      
      // 检查函数是否包含 custom_quotas 逻辑
      if (def.includes('custom_quotas')) {
        console.log('   ✅ 函数包含 custom_quotas 逻辑');
      } else {
        console.log('   ❌ 函数不包含 custom_quotas 逻辑！这是问题根源！');
      }
      
      // 检查函数是否优先使用 custom_quotas
      if (def.includes('custom_quotas') && def.match(/custom_quotas.*THEN/)) {
        console.log('   ✅ 函数优先使用 custom_quotas');
      } else {
        console.log('   ⚠️  函数可能没有优先使用 custom_quotas');
      }
      
      console.log('\n   函数定义（前500字符）:');
      console.log('   ' + def.substring(0, 500).replace(/\n/g, '\n   '));
    }

    console.log('\n========================================');
    console.log('测试完成');
    console.log('========================================\n');

  } catch (error) {
    console.error('测试失败:', error);
    throw error;
  } finally {
    await pool.end();
    await redisClient.quit();
  }
}

testQuotaCheck().catch(console.error);
