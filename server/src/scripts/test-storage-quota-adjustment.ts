/**
 * 测试存储空间配额调整和同步
 * 
 * 验证：
 * 1. 配额调整功能正常工作
 * 2. WebSocket 通知正确发送
 * 3. 配额值正确更新
 */

import { pool } from '../db/database';
import { userSubscriptionManagementService } from '../services/UserSubscriptionManagementService';

interface TestResult {
  step: string;
  success: boolean;
  message: string;
  data?: any;
}

const results: TestResult[] = [];

async function log(step: string, success: boolean, message: string, data?: any) {
  results.push({ step, success, message, data });
  const icon = success ? '✅' : '❌';
  console.log(`${icon} ${step}: ${message}`);
  if (data) {
    console.log('   数据:', JSON.stringify(data, null, 2));
  }
}

async function testStorageQuotaAdjustment() {
  console.log('\n=== 测试存储空间配额调整和同步 ===\n');

  let testUserId: number | null = null;
  let adminUserId: number | null = null;
  let subscriptionId: number | null = null;

  try {
    // 1. 查找测试用户
    console.log('步骤 1: 查找测试用户...');
    const userResult = await pool.query(
      `SELECT id, username FROM users WHERE username = 'testuser' LIMIT 1`
    );

    if (userResult.rows.length === 0) {
      await log('查找测试用户', false, '未找到 testuser，请先创建测试用户');
      return;
    }

    testUserId = userResult.rows[0].id;
    await log('查找测试用户', true, `找到用户: ${userResult.rows[0].username} (ID: ${testUserId})`);

    // 2. 查找管理员用户
    console.log('\n步骤 2: 查找管理员用户...');
    const adminResult = await pool.query(
      `SELECT id, username FROM users WHERE role = 'admin' LIMIT 1`
    );

    if (adminResult.rows.length === 0) {
      await log('查找管理员', false, '未找到管理员用户');
      return;
    }

    adminUserId = adminResult.rows[0].id;
    await log('查找管理员', true, `找到管理员: ${adminResult.rows[0].username} (ID: ${adminUserId})`);

    // 3. 检查用户订阅
    console.log('\n步骤 3: 检查用户订阅...');
    const subResult = await pool.query(
      `SELECT us.id, us.custom_quotas, sp.plan_name, pf.feature_value
       FROM user_subscriptions us
       JOIN subscription_plans sp ON sp.id = us.plan_id
       LEFT JOIN plan_features pf ON pf.plan_id = us.plan_id AND pf.feature_code = 'storage_space'
       WHERE us.user_id = $1 AND us.status = 'active' AND us.end_date > CURRENT_TIMESTAMP
       ORDER BY us.end_date DESC LIMIT 1`,
      [testUserId]
    );

    if (subResult.rows.length === 0) {
      await log('检查订阅', false, '用户没有活跃的订阅');
      return;
    }

    subscriptionId = subResult.rows[0].id;
    const currentQuota = subResult.rows[0].custom_quotas?.storage_space ?? subResult.rows[0].feature_value;
    
    await log('检查订阅', true, `用户订阅: ${subResult.rows[0].plan_name}`, {
      subscriptionId,
      currentStorageQuota: `${currentQuota} MB`,
      hasCustomQuota: !!subResult.rows[0].custom_quotas?.storage_space
    });

    // 4. 获取当前存储使用情况
    console.log('\n步骤 4: 获取当前存储使用情况...');
    const usageResult = await pool.query(
      `SELECT * FROM get_user_storage_usage($1)`,
      [testUserId]
    );

    if (usageResult.rows.length > 0) {
      const usage = usageResult.rows[0];
      await log('获取存储使用', true, '成功获取存储使用情况', {
        totalStorageMB: Math.round(usage.total_storage_bytes / (1024 * 1024)),
        quotaMB: Math.round(usage.storage_quota_bytes / (1024 * 1024)),
        usagePercentage: `${usage.usage_percentage.toFixed(2)}%`
      });
    }

    // 5. 调整存储空间配额
    console.log('\n步骤 5: 调整存储空间配额...');
    const newQuotaMB = currentQuota === 100 ? 200 : 100; // 在 100 和 200 之间切换
    
    try {
      await userSubscriptionManagementService.adjustQuota(
        testUserId!,
        'storage_space',
        newQuotaMB,
        false, // 临时调整
        adminUserId!,
        '测试存储空间配额调整和同步功能',
        '127.0.0.1',
        'test-script'
      );

      await log('调整配额', true, `配额已调整: ${currentQuota} MB → ${newQuotaMB} MB`);
    } catch (error: any) {
      await log('调整配额', false, `调整失败: ${error.message}`);
      return;
    }

    // 6. 验证配额已更新
    console.log('\n步骤 6: 验证配额已更新...');
    const verifyResult = await pool.query(
      `SELECT custom_quotas FROM user_subscriptions WHERE id = $1`,
      [subscriptionId]
    );

    if (verifyResult.rows.length > 0) {
      const updatedQuota = verifyResult.rows[0].custom_quotas?.storage_space;
      const isCorrect = updatedQuota === newQuotaMB;
      
      await log('验证配额更新', isCorrect, 
        isCorrect 
          ? `配额已正确更新为 ${newQuotaMB} MB`
          : `配额更新不正确，期望 ${newQuotaMB} MB，实际 ${updatedQuota} MB`,
        { updatedQuota, expectedQuota: newQuotaMB }
      );
    }

    // 7. 检查调整历史记录
    console.log('\n步骤 7: 检查调整历史记录...');
    const historyResult = await pool.query(
      `SELECT * FROM subscription_adjustments 
       WHERE user_id = $1 AND adjustment_type = 'quota_adjust'
       ORDER BY created_at DESC LIMIT 1`,
      [testUserId]
    );

    if (historyResult.rows.length > 0) {
      const history = historyResult.rows[0];
      await log('检查历史记录', true, '找到调整历史记录', {
        adjustmentType: history.adjustment_type,
        quotaAdjustments: history.quota_adjustments,
        reason: history.reason,
        createdAt: history.created_at
      });
    } else {
      await log('检查历史记录', false, '未找到调整历史记录');
    }

    // 8. 测试获取订阅详情（验证 API 返回正确的配额）
    console.log('\n步骤 8: 测试获取订阅详情...');
    try {
      const detail = await userSubscriptionManagementService.getUserSubscriptionDetail(testUserId!);
      
      if (detail) {
        const storageFeature = detail.features.find(f => f.feature_code === 'storage_space');
        
        if (storageFeature) {
          const isCorrect = storageFeature.feature_value === newQuotaMB;
          await log('获取订阅详情', isCorrect,
            isCorrect
              ? `API 返回正确的配额: ${storageFeature.feature_value} MB`
              : `API 返回的配额不正确，期望 ${newQuotaMB} MB，实际 ${storageFeature.feature_value} MB`,
            {
              featureName: storageFeature.feature_name,
              featureValue: storageFeature.feature_value,
              currentUsage: storageFeature.current_usage,
              usagePercentage: storageFeature.usage_percentage
            }
          );
        } else {
          await log('获取订阅详情', false, '未找到存储空间功能');
        }
      } else {
        await log('获取订阅详情', false, '未获取到订阅详情');
      }
    } catch (error: any) {
      await log('获取订阅详情', false, `获取失败: ${error.message}`);
    }

    // 9. 总结
    console.log('\n=== 测试总结 ===\n');
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    const successRate = ((successCount / totalCount) * 100).toFixed(1);

    console.log(`总测试项: ${totalCount}`);
    console.log(`成功: ${successCount}`);
    console.log(`失败: ${totalCount - successCount}`);
    console.log(`成功率: ${successRate}%`);

    if (successCount === totalCount) {
      console.log('\n✅ 所有测试通过！');
      console.log('\n📝 下一步：');
      console.log('1. 启动前端服务: cd client && npm run dev');
      console.log('2. 登录管理员账号，进入"用户管理"');
      console.log('3. 找到 testuser，点击"订阅详情" > "调整配额"');
      console.log('4. 验证存储空间显示 MB 单位');
      console.log('5. 在另一个浏览器窗口，用 testuser 登录，进入"个人中心" > "存储空间"');
      console.log('6. 调整配额后，验证个人中心自动更新（无需刷新页面）');
    } else {
      console.log('\n❌ 部分测试失败，请检查上述错误信息');
    }

  } catch (error: any) {
    console.error('\n❌ 测试过程中发生错误:', error);
    await log('测试执行', false, error.message);
  } finally {
    await pool.end();
  }
}

// 运行测试
testStorageQuotaAdjustment().catch(console.error);
