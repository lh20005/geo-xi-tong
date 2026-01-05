/**
 * 诊断配额同步问题
 * 检查所有配额相关的数据表和缓存，找出不同步的原因
 */

import { pool } from '../db/database';
import { redisClient } from '../db/redis';

interface DiagnosticResult {
  category: string;
  item: string;
  status: 'OK' | 'WARNING' | 'ERROR';
  details: string;
  data?: any;
}

const results: DiagnosticResult[] = [];

function addResult(category: string, item: string, status: 'OK' | 'WARNING' | 'ERROR', details: string, data?: any) {
  results.push({ category, item, status, details, data });
  const icon = status === 'OK' ? '✅' : status === 'WARNING' ? '⚠️' : '❌';
  console.log(`${icon} [${category}] ${item}: ${details}`);
  if (data) {
    console.log('   数据:', JSON.stringify(data, null, 2));
  }
}

async function diagnoseQuotaSync() {
  console.log('========================================');
  console.log('配额同步诊断工具');
  console.log('========================================\n');

  try {
    // 1. 检查测试用户
    console.log('1. 检查测试用户配额数据...\n');
    
    const testUsers = await pool.query(`
      SELECT id, username, email 
      FROM users 
      WHERE username IN ('testuser', 'testuser2', 'lzc2005')
      ORDER BY id
    `);

    if (testUsers.rows.length === 0) {
      addResult('用户检查', '测试用户', 'WARNING', '未找到测试用户');
    } else {
      addResult('用户检查', '测试用户', 'OK', `找到 ${testUsers.rows.length} 个测试用户`);
      
      for (const user of testUsers.rows) {
        console.log(`\n--- 用户: ${user.username} (ID: ${user.id}) ---\n`);
        
        // 2. 检查订阅信息
        const subscription = await pool.query(`
          SELECT 
            us.id,
            us.plan_id,
            p.plan_name,
            p.plan_code,
            us.status,
            us.start_date,
            us.end_date,
            us.custom_quotas,
            us.created_at,
            us.updated_at
          FROM user_subscriptions us
          LEFT JOIN subscription_plans p ON us.id = p.id
          WHERE us.user_id = $1
          ORDER BY us.created_at DESC
          LIMIT 1
        `, [user.id]);

        if (subscription.rows.length === 0) {
          addResult('订阅信息', user.username, 'ERROR', '没有订阅记录');
          continue;
        }

        const sub = subscription.rows[0];
        addResult('订阅信息', user.username, 'OK', `套餐: ${sub.plan_name} (${sub.plan_code}), 状态: ${sub.status}`);
        
        if (sub.custom_quotas) {
          console.log('   自定义配额:', sub.custom_quotas);
        }

        // 3. 检查套餐默认配额
        const planQuotas = await pool.query(`
          SELECT feature_code, quota_value
          FROM subscription_plan_quotas
          WHERE plan_id = $1
        `, [sub.plan_id]);

        console.log('\n   套餐默认配额:');
        const quotaMap: Record<string, number> = {};
        for (const q of planQuotas.rows) {
          quotaMap[q.feature_code] = q.quota_value;
          console.log(`     ${q.feature_code}: ${q.quota_value}`);
        }

        // 4. 检查 custom_quotas 表
        const customQuotas = await pool.query(`
          SELECT feature_code, quota_value, is_permanent
          FROM custom_quotas
          WHERE user_id = $1
        `, [user.id]);

        if (customQuotas.rows.length > 0) {
          console.log('\n   custom_quotas 表:');
          for (const cq of customQuotas.rows) {
            console.log(`     ${cq.feature_code}: ${cq.quota_value} (永久: ${cq.is_permanent})`);
          }
        }

        // 5. 检查 user_usage 表（当前周期使用量）
        const userUsage = await pool.query(`
          SELECT feature_code, current_usage, period_start, period_end
          FROM user_usage
          WHERE user_id = $1
        `, [user.id]);

        console.log('\n   user_usage 表（当前周期使用量）:');
        if (userUsage.rows.length === 0) {
          console.log('     无记录');
        } else {
          for (const uu of userUsage.rows) {
            console.log(`     ${uu.feature_code}: ${uu.current_usage} (周期: ${uu.period_start} ~ ${uu.period_end})`);
          }
        }

        // 6. 调用 check_user_quota 函数检查各项配额
        console.log('\n   check_user_quota 函数结果:');
        const featureCodes = [
          'articles_per_month',
          'publish_per_month',
          'platform_accounts',
          'keyword_distillation',
          'gallery_albums',
          'knowledge_bases'
        ];

        const quotaChecks: Record<string, any> = {};
        for (const featureCode of featureCodes) {
          const checkResult = await pool.query(`
            SELECT * FROM check_user_quota($1, $2)
          `, [user.id, featureCode]);

          if (checkResult.rows.length > 0) {
            const check = checkResult.rows[0];
            quotaChecks[featureCode] = check;
            console.log(`     ${featureCode}:`);
            console.log(`       配额限制: ${check.quota_limit}`);
            console.log(`       当前使用: ${check.current_usage}`);
            console.log(`       剩余: ${check.remaining}`);
            console.log(`       有配额: ${check.has_quota}`);
          }
        }

        // 7. 检查存储配额
        const storageUsage = await pool.query(`
          SELECT 
            storage_quota_bytes,
            purchased_storage_bytes,
            used_storage_bytes,
            last_updated_at
          FROM user_storage_usage
          WHERE user_id = $1
        `, [user.id]);

        if (storageUsage.rows.length > 0) {
          const storage = storageUsage.rows[0];
          console.log('\n   存储配额:');
          console.log(`     配额: ${(storage.storage_quota_bytes / 1024 / 1024).toFixed(2)} MB`);
          console.log(`     已购买: ${(storage.purchased_storage_bytes / 1024 / 1024).toFixed(2)} MB`);
          console.log(`     已使用: ${(storage.used_storage_bytes / 1024 / 1024).toFixed(2)} MB`);
          console.log(`     更新时间: ${storage.last_updated_at}`);
        }

        // 8. 检查 Redis 缓存
        console.log('\n   Redis 缓存:');
        const cacheKeys = [
          `user:${user.id}:subscription`,
          `user:${user.id}:quotas`,
          `user:${user.id}:storage`,
          `storage:usage:${user.id}`
        ];

        for (const key of cacheKeys) {
          const cached = await redisClient.get(key);
          if (cached) {
            console.log(`     ${key}: 存在`);
            try {
              const data = JSON.parse(cached);
              console.log(`       数据:`, data);
            } catch (e) {
              console.log(`       数据:`, cached);
            }
          } else {
            console.log(`     ${key}: 不存在`);
          }
        }

        // 9. 对比分析
        console.log('\n   配额一致性分析:');
        
        // 检查 custom_quotas 是否与 check_user_quota 结果一致
        if (sub.custom_quotas) {
          for (const [featureCode, customValue] of Object.entries(sub.custom_quotas)) {
            const checkResult = quotaChecks[featureCode];
            if (checkResult) {
              if (checkResult.quota_limit === customValue) {
                addResult('配额一致性', `${user.username} - ${featureCode}`, 'OK', 
                  `自定义配额 (${customValue}) 与检查结果一致`);
              } else {
                addResult('配额一致性', `${user.username} - ${featureCode}`, 'ERROR', 
                  `不一致！自定义配额: ${customValue}, 检查结果: ${checkResult.quota_limit}`,
                  { customValue, checkResult: checkResult.quota_limit });
              }
            }
          }
        }

        // 检查存储配额是否与 custom_quotas 一致
        if (sub.custom_quotas && sub.custom_quotas.storage_space && storageUsage.rows.length > 0) {
          const customStorageMB = sub.custom_quotas.storage_space;
          const actualStorageMB = storageUsage.rows[0].storage_quota_bytes / 1024 / 1024;
          
          if (Math.abs(customStorageMB - actualStorageMB) < 0.01) {
            addResult('存储配额一致性', user.username, 'OK', 
              `自定义配额 (${customStorageMB} MB) 与实际配额一致`);
          } else {
            addResult('存储配额一致性', user.username, 'ERROR', 
              `不一致！自定义配额: ${customStorageMB} MB, 实际配额: ${actualStorageMB.toFixed(2)} MB`,
              { customStorageMB, actualStorageMB });
          }
        }
      }
    }

    // 10. 检查触发器和函数
    console.log('\n\n2. 检查数据库触发器和函数...\n');
    
    const triggers = await pool.query(`
      SELECT tgname, tgenabled
      FROM pg_trigger
      WHERE tgname IN ('trigger_sync_storage_quota', 'trigger_sync_custom_quotas')
    `);

    for (const trigger of triggers.rows) {
      const enabled = trigger.tgenabled === 'O';
      addResult('触发器', trigger.tgname, enabled ? 'OK' : 'ERROR', 
        enabled ? '已启用' : '已禁用');
    }

    const functions = await pool.query(`
      SELECT proname
      FROM pg_proc
      WHERE proname IN (
        'check_user_quota',
        'get_user_storage_quota',
        'sync_storage_quota_on_custom_quota_change',
        'get_user_quota_period'
      )
    `);

    for (const func of functions.rows) {
      addResult('数据库函数', func.proname, 'OK', '存在');
    }

    // 11. 生成报告
    console.log('\n\n========================================');
    console.log('诊断报告汇总');
    console.log('========================================\n');

    const errorCount = results.filter(r => r.status === 'ERROR').length;
    const warningCount = results.filter(r => r.status === 'WARNING').length;
    const okCount = results.filter(r => r.status === 'OK').length;

    console.log(`总检查项: ${results.length}`);
    console.log(`✅ 正常: ${okCount}`);
    console.log(`⚠️  警告: ${warningCount}`);
    console.log(`❌ 错误: ${errorCount}\n`);

    if (errorCount > 0) {
      console.log('错误详情:');
      results.filter(r => r.status === 'ERROR').forEach(r => {
        console.log(`  - [${r.category}] ${r.item}: ${r.details}`);
      });
    }

    if (warningCount > 0) {
      console.log('\n警告详情:');
      results.filter(r => r.status === 'WARNING').forEach(r => {
        console.log(`  - [${r.category}] ${r.item}: ${r.details}`);
      });
    }

  } catch (error) {
    console.error('诊断过程出错:', error);
    throw error;
  } finally {
    await pool.end();
    await redisClient.quit();
  }
}

// 运行诊断
diagnoseQuotaSync().catch(console.error);
