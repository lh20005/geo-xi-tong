/**
 * 测试用户隔离修复
 * 验证配额预警标记接口的用户隔离功能
 */

import { pool } from '../db/database';
import { quotaAlertService } from '../services/QuotaAlertService';

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

async function runTests() {
  console.log('🧪 开始测试用户隔离修复...\n');

  try {
    // 准备测试数据
    await setupTestData();

    // 测试 1: 用户只能标记自己的预警
    await testMarkOwnAlert();

    // 测试 2: 用户不能标记其他用户的预警
    await testCannotMarkOthersAlert();

    // 测试 3: 批量标记时验证权限
    await testBatchMarkWithValidation();

    // 测试 4: 不提供 userId 时的向后兼容性（内部调用）
    await testBackwardCompatibility();

    // 清理测试数据
    await cleanupTestData();

    // 输出结果
    console.log('\n📊 测试结果汇总:');
    console.log('='.repeat(60));
    
    let passedCount = 0;
    let failedCount = 0;

    results.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.testName}`);
      console.log(`   ${result.message}`);
      
      if (result.passed) {
        passedCount++;
      } else {
        failedCount++;
      }
    });

    console.log('='.repeat(60));
    console.log(`总计: ${results.length} 个测试`);
    console.log(`通过: ${passedCount} 个`);
    console.log(`失败: ${failedCount} 个`);

    if (failedCount === 0) {
      console.log('\n🎉 所有测试通过！用户隔离修复成功！');
    } else {
      console.log('\n⚠️  部分测试失败，请检查修复代码');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function setupTestData() {
  console.log('📝 准备测试数据...');

  // 创建测试用户
  await pool.query(`
    INSERT INTO users (username, email, password_hash, role)
    VALUES 
      ('test_user_1', 'test1@example.com', 'hash1', 'user'),
      ('test_user_2', 'test2@example.com', 'hash2', 'user')
    ON CONFLICT (email) DO NOTHING
  `);

  // 获取用户ID
  const user1Result = await pool.query(
    `SELECT id FROM users WHERE email = 'test1@example.com'`
  );
  const user2Result = await pool.query(
    `SELECT id FROM users WHERE email = 'test2@example.com'`
  );

  const user1Id = user1Result.rows[0].id;
  const user2Id = user2Result.rows[0].id;

  // 创建测试预警
  await pool.query(`
    INSERT INTO quota_alerts (user_id, feature_code, alert_type, threshold_percentage, current_usage, quota_limit, is_sent)
    VALUES 
      ($1, 'articles_per_month', 'warning', 80, 80, 100, FALSE),
      ($2, 'articles_per_month', 'warning', 80, 80, 100, FALSE)
  `, [user1Id, user2Id]);

  console.log('✅ 测试数据准备完成\n');
}

async function testMarkOwnAlert() {
  const testName = '测试 1: 用户可以标记自己的预警';
  
  try {
    // 获取用户1的预警
    const user1Result = await pool.query(
      `SELECT id FROM users WHERE email = 'test1@example.com'`
    );
    const user1Id = user1Result.rows[0].id;

    const alertResult = await pool.query(
      `SELECT id FROM quota_alerts WHERE user_id = $1 AND is_sent = FALSE LIMIT 1`,
      [user1Id]
    );

    if (alertResult.rows.length === 0) {
      results.push({
        testName,
        passed: false,
        message: '未找到测试预警'
      });
      return;
    }

    const alertId = alertResult.rows[0].id;

    // 尝试标记自己的预警
    await quotaAlertService.markAsSent(alertId, user1Id);

    // 验证是否标记成功
    const checkResult = await pool.query(
      `SELECT is_sent FROM quota_alerts WHERE id = $1`,
      [alertId]
    );

    const isSent = checkResult.rows[0].is_sent;

    if (isSent) {
      results.push({
        testName,
        passed: true,
        message: '用户成功标记了自己的预警'
      });
    } else {
      results.push({
        testName,
        passed: false,
        message: '预警未被标记'
      });
    }

  } catch (error: any) {
    results.push({
      testName,
      passed: false,
      message: `测试失败: ${error.message}`
    });
  }
}

async function testCannotMarkOthersAlert() {
  const testName = '测试 2: 用户不能标记其他用户的预警';
  
  try {
    // 获取用户ID
    const user1Result = await pool.query(
      `SELECT id FROM users WHERE email = 'test1@example.com'`
    );
    const user2Result = await pool.query(
      `SELECT id FROM users WHERE email = 'test2@example.com'`
    );

    const user1Id = user1Result.rows[0].id;
    const user2Id = user2Result.rows[0].id;

    // 获取用户2的预警
    const alertResult = await pool.query(
      `SELECT id FROM quota_alerts WHERE user_id = $1 AND is_sent = FALSE LIMIT 1`,
      [user2Id]
    );

    if (alertResult.rows.length === 0) {
      results.push({
        testName,
        passed: false,
        message: '未找到测试预警'
      });
      return;
    }

    const alertId = alertResult.rows[0].id;

    // 用户1尝试标记用户2的预警（应该失败）
    try {
      await quotaAlertService.markAsSent(alertId, user1Id);
      
      // 如果没有抛出错误，说明修复失败
      results.push({
        testName,
        passed: false,
        message: '用户能够标记其他用户的预警（安全漏洞未修复）'
      });
    } catch (error: any) {
      // 应该抛出"无权操作此预警"错误
      if (error.message === '无权操作此预警') {
        results.push({
          testName,
          passed: true,
          message: '正确阻止了跨用户操作'
        });
      } else {
        results.push({
          testName,
          passed: false,
          message: `抛出了错误但不是预期的错误: ${error.message}`
        });
      }
    }

  } catch (error: any) {
    results.push({
      testName,
      passed: false,
      message: `测试失败: ${error.message}`
    });
  }
}

async function testBatchMarkWithValidation() {
  const testName = '测试 3: 批量标记时验证权限';
  
  try {
    // 获取用户ID
    const user1Result = await pool.query(
      `SELECT id FROM users WHERE email = 'test1@example.com'`
    );
    const user2Result = await pool.query(
      `SELECT id FROM users WHERE email = 'test2@example.com'`
    );

    const user1Id = user1Result.rows[0].id;
    const user2Id = user2Result.rows[0].id;

    // 创建新的测试预警
    await pool.query(`
      INSERT INTO quota_alerts (user_id, feature_code, alert_type, threshold_percentage, current_usage, quota_limit, is_sent)
      VALUES 
        ($1, 'publish_per_month', 'warning', 80, 80, 100, FALSE),
        ($2, 'publish_per_month', 'warning', 80, 80, 100, FALSE)
    `, [user1Id, user2Id]);

    // 获取两个用户的预警ID
    const user1AlertResult = await pool.query(
      `SELECT id FROM quota_alerts WHERE user_id = $1 AND feature_code = 'publish_per_month' AND is_sent = FALSE`,
      [user1Id]
    );
    const user2AlertResult = await pool.query(
      `SELECT id FROM quota_alerts WHERE user_id = $1 AND feature_code = 'publish_per_month' AND is_sent = FALSE`,
      [user2Id]
    );

    const user1AlertId = user1AlertResult.rows[0].id;
    const user2AlertId = user2AlertResult.rows[0].id;

    // 用户1尝试批量标记（包含用户2的预警）
    try {
      await quotaAlertService.batchMarkAsSent([user1AlertId, user2AlertId], user1Id);
      
      results.push({
        testName,
        passed: false,
        message: '批量操作允许了跨用户操作（安全漏洞未修复）'
      });
    } catch (error: any) {
      if (error.message.includes('部分预警不存在或无权操作')) {
        results.push({
          testName,
          passed: true,
          message: '正确阻止了批量跨用户操作'
        });
      } else {
        results.push({
          testName,
          passed: false,
          message: `抛出了错误但不是预期的错误: ${error.message}`
        });
      }
    }

  } catch (error: any) {
    results.push({
      testName,
      passed: false,
      message: `测试失败: ${error.message}`
    });
  }
}

async function testBackwardCompatibility() {
  const testName = '测试 4: 向后兼容性（不提供 userId）';
  
  try {
    // 获取用户1
    const user1Result = await pool.query(
      `SELECT id FROM users WHERE email = 'test1@example.com'`
    );
    const user1Id = user1Result.rows[0].id;

    // 创建新预警
    const alertResult = await pool.query(`
      INSERT INTO quota_alerts (user_id, feature_code, alert_type, threshold_percentage, current_usage, quota_limit, is_sent)
      VALUES ($1, 'keyword_distillation', 'warning', 80, 80, 100, FALSE)
      RETURNING id
    `, [user1Id]);

    const alertId = alertResult.rows[0].id;

    // 不提供 userId 参数（内部调用场景）
    await quotaAlertService.markAsSent(alertId);

    // 验证是否标记成功
    const checkResult = await pool.query(
      `SELECT is_sent FROM quota_alerts WHERE id = $1`,
      [alertId]
    );

    const isSent = checkResult.rows[0].is_sent;

    if (isSent) {
      results.push({
        testName,
        passed: true,
        message: '向后兼容性正常，内部调用仍然有效'
      });
    } else {
      results.push({
        testName,
        passed: false,
        message: '向后兼容性失败'
      });
    }

  } catch (error: any) {
    results.push({
      testName,
      passed: false,
      message: `测试失败: ${error.message}`
    });
  }
}

async function cleanupTestData() {
  console.log('\n🧹 清理测试数据...');

  // 删除测试预警
  await pool.query(`
    DELETE FROM quota_alerts 
    WHERE user_id IN (
      SELECT id FROM users WHERE email IN ('test1@example.com', 'test2@example.com')
    )
  `);

  // 删除测试用户
  await pool.query(`
    DELETE FROM users 
    WHERE email IN ('test1@example.com', 'test2@example.com')
  `);

  console.log('✅ 测试数据清理完成');
}

// 运行测试
runTests().catch(error => {
  console.error('测试执行出错:', error);
  process.exit(1);
});
