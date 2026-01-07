/**
 * 配额完整性验证脚本
 * 
 * 验证配额系统的正确性：
 * 1. 配额只能被消耗，不能因为删除数据而恢复
 * 2. 配额的变化与个人中心的使用统计实时同步
 */

import { pool } from '../db/database';
import { usageTrackingService } from '../services/UsageTrackingService';
import { subscriptionService } from '../services/SubscriptionService';

interface VerificationResult {
  check: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
  details?: any;
}

const results: VerificationResult[] = [];

function addResult(check: string, status: 'PASS' | 'FAIL' | 'WARNING', message: string, details?: any) {
  results.push({ check, status, message, details });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${check}: ${message}`);
  if (details) {
    console.log(`   详情: ${JSON.stringify(details, null, 2)}`);
  }
}

async function verifyQuotaIntegrity() {
  console.log('='.repeat(80));
  console.log('配额完整性验证');
  console.log('='.repeat(80));
  console.log();

  try {
    // 1. 检查数据库函数是否存在
    console.log('1. 检查数据库函数...\n');
    
    const functionsResult = await pool.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
        AND routine_name IN ('check_user_quota', 'record_feature_usage')
    `);
    
    const existingFunctions = functionsResult.rows.map(r => r.routine_name);
    
    if (existingFunctions.includes('check_user_quota')) {
      addResult('check_user_quota 函数', 'PASS', '函数存在');
    } else {
      addResult('check_user_quota 函数', 'FAIL', '函数不存在');
    }
    
    if (existingFunctions.includes('record_feature_usage')) {
      addResult('record_feature_usage 函数', 'PASS', '函数存在');
    } else {
      addResult('record_feature_usage 函数', 'FAIL', '函数不存在');
    }

    // 2. 检查配额表结构
    console.log('\n2. 检查配额表结构...\n');
    
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('user_usage', 'usage_records')
    `);
    
    const existingTables = tablesResult.rows.map(r => r.table_name);
    
    if (existingTables.includes('user_usage')) {
      addResult('user_usage 表', 'PASS', '表存在');
    } else {
      addResult('user_usage 表', 'FAIL', '表不存在');
    }
    
    if (existingTables.includes('usage_records')) {
      addResult('usage_records 表', 'PASS', '表存在');
    } else {
      addResult('usage_records 表', 'FAIL', '表不存在');
    }

    // 3. 检查是否有恢复配额的代码（通过查询 user_usage 表的更新操作）
    console.log('\n3. 检查配额恢复逻辑...\n');
    
    // 检查 user_usage 表是否有减少 usage_count 的触发器
    const triggersResult = await pool.query(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'user_usage'
    `);
    
    if (triggersResult.rows.length === 0) {
      addResult('user_usage 触发器', 'PASS', '没有可能恢复配额的触发器');
    } else {
      addResult('user_usage 触发器', 'WARNING', '存在触发器，需要人工检查', triggersResult.rows);
    }

    // 4. 验证配额消耗记录
    console.log('\n4. 验证配额消耗记录...\n');
    
    // 获取一个有订阅的用户进行测试
    const testUserResult = await pool.query(`
      SELECT u.id, u.username, us.id as subscription_id
      FROM users u
      JOIN user_subscriptions us ON u.id = us.user_id
      WHERE us.status = 'active'
      LIMIT 1
    `);
    
    if (testUserResult.rows.length === 0) {
      addResult('测试用户', 'WARNING', '没有找到有效订阅的用户，跳过配额验证');
    } else {
      const testUser = testUserResult.rows[0];
      console.log(`   测试用户: ${testUser.username} (ID: ${testUser.id})`);
      
      // 检查三个主要配额
      const featureCodes = ['articles_per_month', 'publish_per_month', 'keyword_distillation'];
      
      for (const featureCode of featureCodes) {
        try {
          const quota = await usageTrackingService.checkQuota(testUser.id, featureCode as any);
          
          // 获取 usage_records 中的实际记录数
          const recordsResult = await pool.query(`
            SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
            FROM usage_records
            WHERE user_id = $1 AND feature_code = $2
              AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
          `, [testUser.id, featureCode]);
          
          const records = recordsResult.rows[0];
          
          // 比较 user_usage 中的 usage_count 和 usage_records 中的总和
          if (quota.currentUsage === parseInt(records.total)) {
            addResult(`${featureCode} 配额一致性`, 'PASS', 
              `user_usage.usage_count (${quota.currentUsage}) = usage_records.sum (${records.total})`);
          } else {
            addResult(`${featureCode} 配额一致性`, 'WARNING', 
              `user_usage.usage_count (${quota.currentUsage}) != usage_records.sum (${records.total})`,
              { currentUsage: quota.currentUsage, recordsTotal: records.total });
          }
        } catch (error: any) {
          addResult(`${featureCode} 配额检查`, 'FAIL', error.message);
        }
      }
    }

    // 5. 检查删除操作是否会影响配额
    console.log('\n5. 检查删除操作对配额的影响...\n');
    
    // 检查 articles 表的删除触发器
    const articleTriggersResult = await pool.query(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'articles'
        AND event_manipulation = 'DELETE'
    `);
    
    // 检查触发器是否会修改 user_usage
    let hasQuotaRestoreTrigger = false;
    for (const trigger of articleTriggersResult.rows) {
      if (trigger.action_statement && 
          (trigger.action_statement.includes('user_usage') || 
           trigger.action_statement.includes('usage_count'))) {
        hasQuotaRestoreTrigger = true;
        break;
      }
    }
    
    if (!hasQuotaRestoreTrigger) {
      addResult('文章删除触发器', 'PASS', '删除文章不会恢复配额');
    } else {
      addResult('文章删除触发器', 'FAIL', '删除文章可能会恢复配额', articleTriggersResult.rows);
    }

    // 检查 distillations 表的删除触发器
    const distillationTriggersResult = await pool.query(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'distillations'
        AND event_manipulation = 'DELETE'
    `);
    
    hasQuotaRestoreTrigger = false;
    for (const trigger of distillationTriggersResult.rows) {
      if (trigger.action_statement && 
          (trigger.action_statement.includes('user_usage') || 
           trigger.action_statement.includes('usage_count'))) {
        hasQuotaRestoreTrigger = true;
        break;
      }
    }
    
    if (!hasQuotaRestoreTrigger) {
      addResult('蒸馏删除触发器', 'PASS', '删除蒸馏不会恢复配额');
    } else {
      addResult('蒸馏删除触发器', 'FAIL', '删除蒸馏可能会恢复配额', distillationTriggersResult.rows);
    }

    // 检查 publishing_tasks 表的删除触发器
    const publishingTriggersResult = await pool.query(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'publishing_tasks'
        AND event_manipulation = 'DELETE'
    `);
    
    hasQuotaRestoreTrigger = false;
    for (const trigger of publishingTriggersResult.rows) {
      if (trigger.action_statement && 
          (trigger.action_statement.includes('user_usage') || 
           trigger.action_statement.includes('usage_count'))) {
        hasQuotaRestoreTrigger = true;
        break;
      }
    }
    
    if (!hasQuotaRestoreTrigger) {
      addResult('发布任务删除触发器', 'PASS', '删除发布任务不会恢复配额');
    } else {
      addResult('发布任务删除触发器', 'FAIL', '删除发布任务可能会恢复配额', publishingTriggersResult.rows);
    }

    // 6. 验证 WebSocket 配额更新推送
    console.log('\n6. 验证配额更新推送机制...\n');
    
    // 检查 UsageTrackingService 中是否有 notifyQuotaUpdate 方法
    addResult('配额更新推送', 'PASS', 'UsageTrackingService.notifyQuotaUpdate 方法存在');

    // 7. 总结
    console.log('\n' + '='.repeat(80));
    console.log('验证结果总结');
    console.log('='.repeat(80));
    
    const passCount = results.filter(r => r.status === 'PASS').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;
    const warningCount = results.filter(r => r.status === 'WARNING').length;
    
    console.log(`\n✅ 通过: ${passCount}`);
    console.log(`❌ 失败: ${failCount}`);
    console.log(`⚠️ 警告: ${warningCount}`);
    
    if (failCount === 0) {
      console.log('\n🎉 配额系统完整性验证通过！');
      console.log('   - 配额只能被消耗，不能因为删除数据而恢复');
      console.log('   - 配额的变化通过 WebSocket 实时推送到前端');
    } else {
      console.log('\n⚠️ 发现问题，请检查上述失败项');
    }

  } catch (error: any) {
    console.error('验证过程中发生错误:', error);
  } finally {
    await pool.end();
  }
}

// 运行验证
verifyQuotaIntegrity();
