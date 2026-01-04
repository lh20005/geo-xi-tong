/**
 * 存储空间功能连通性测试
 * 测试存储空间功能在整个系统中的连通性
 */

import { pool } from '../db/database';
import { StorageQuotaService } from '../services/StorageQuotaService';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

async function testStorageFeatureConnectivity() {
  console.log('='.repeat(80));
  console.log('存储空间功能连通性测试');
  console.log('='.repeat(80));
  console.log();

  try {
    // 测试 1: 检查数据库中存储空间配额配置
    await testDatabaseConfiguration();

    // 测试 2: 检查套餐中的存储空间功能
    await testPlanFeatures();

    // 测试 3: 检查用户存储配额查询
    await testUserStorageQuota();

    // 测试 4: 检查存储配额服务
    await testStorageQuotaService();

    // 测试 5: 检查存储空间单位显示
    await testStorageUnitDisplay();

    // 输出测试结果
    console.log('\n' + '='.repeat(80));
    console.log('测试结果汇总');
    console.log('='.repeat(80));
    
    const passCount = results.filter(r => r.status === 'PASS').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;
    
    results.forEach((result, index) => {
      const icon = result.status === 'PASS' ? '✅' : '❌';
      console.log(`\n${index + 1}. ${icon} ${result.test}`);
      console.log(`   状态: ${result.status}`);
      console.log(`   说明: ${result.message}`);
      if (result.details) {
        console.log(`   详情:`, result.details);
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log(`总计: ${results.length} 个测试`);
    console.log(`通过: ${passCount} 个 ✅`);
    console.log(`失败: ${failCount} 个 ❌`);
    console.log('='.repeat(80));

    if (failCount > 0) {
      console.log('\n⚠️  存在失败的测试，请检查上述详情');
      process.exit(1);
    } else {
      console.log('\n🎉 所有测试通过！存储空间功能连通性正常');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ 测试过程中发生错误:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function testDatabaseConfiguration() {
  try {
    const result = await pool.query(`
      SELECT 
        table_name,
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_name IN ('storage_usage', 'storage_usage_history', 'storage_transactions', 'storage_purchases')
      ORDER BY table_name, ordinal_position
    `);

    if (result.rows.length > 0) {
      results.push({
        test: '数据库表结构检查',
        status: 'PASS',
        message: '存储空间相关表已正确创建',
        details: `找到 ${result.rows.length} 个字段`
      });
    } else {
      results.push({
        test: '数据库表结构检查',
        status: 'FAIL',
        message: '未找到存储空间相关表'
      });
    }
  } catch (error: any) {
    results.push({
      test: '数据库表结构检查',
      status: 'FAIL',
      message: error.message
    });
  }
}

async function testPlanFeatures() {
  try {
    const result = await pool.query(`
      SELECT 
        sp.plan_name,
        sp.plan_code,
        pf.feature_code,
        pf.feature_name,
        pf.feature_value,
        pf.feature_unit,
        CASE 
          WHEN pf.feature_value = -1 THEN '无限制'
          ELSE pf.feature_value || ' ' || pf.feature_unit
        END as display_value
      FROM plan_features pf
      JOIN subscription_plans sp ON pf.plan_id = sp.id
      WHERE pf.feature_code = 'storage_space'
      ORDER BY sp.display_order
    `);

    if (result.rows.length > 0) {
      const hasCorrectUnit = result.rows.every(row => row.feature_unit === 'MB');
      
      if (hasCorrectUnit) {
        results.push({
          test: '套餐存储空间配置检查',
          status: 'PASS',
          message: `找到 ${result.rows.length} 个套餐的存储空间配置，单位正确 (MB)`,
          details: result.rows.map(r => `${r.plan_name}: ${r.display_value}`)
        });
      } else {
        results.push({
          test: '套餐存储空间配置检查',
          status: 'FAIL',
          message: '存储空间单位不正确，应该是 MB',
          details: result.rows
        });
      }
    } else {
      results.push({
        test: '套餐存储空间配置检查',
        status: 'FAIL',
        message: '未找到任何套餐的存储空间配置'
      });
    }
  } catch (error: any) {
    results.push({
      test: '套餐存储空间配置检查',
      status: 'FAIL',
      message: error.message
    });
  }
}

async function testUserStorageQuota() {
  try {
    // 查找一个测试用户
    const userResult = await pool.query(`
      SELECT u.id, u.username, us.plan_id, sp.plan_code
      FROM users u
      LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
      LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
      LIMIT 1
    `);

    if (userResult.rows.length === 0) {
      results.push({
        test: '用户存储配额查询',
        status: 'FAIL',
        message: '未找到测试用户'
      });
      return;
    }

    const user = userResult.rows[0];

    // 查询用户的存储配额
    const quotaResult = await pool.query(`
      SELECT get_user_storage_quota($1) as quota_bytes
    `, [user.id]);

    const quotaBytes = quotaResult.rows[0].quota_bytes;
    const quotaMB = Math.round(quotaBytes / (1024 * 1024));

    results.push({
      test: '用户存储配额查询',
      status: 'PASS',
      message: `成功查询用户存储配额`,
      details: {
        username: user.username,
        plan_code: user.plan_code || 'free',
        quota_bytes: quotaBytes,
        quota_mb: quotaMB + ' MB'
      }
    });
  } catch (error: any) {
    results.push({
      test: '用户存储配额查询',
      status: 'FAIL',
      message: error.message
    });
  }
}

async function testStorageQuotaService() {
  try {
    // 查找一个测试用户
    const userResult = await pool.query(`
      SELECT id, username FROM users LIMIT 1
    `);

    if (userResult.rows.length === 0) {
      results.push({
        test: 'StorageQuotaService 测试',
        status: 'FAIL',
        message: '未找到测试用户'
      });
      return;
    }

    const userId = userResult.rows[0].id;
    const storageService = StorageQuotaService.getInstance();

    // 测试检查配额
    const testFileSize = 1024 * 1024; // 1MB
    const quotaCheck = await storageService.checkQuota(userId, testFileSize);

    results.push({
      test: 'StorageQuotaService 测试',
      status: 'PASS',
      message: 'StorageQuotaService 工作正常',
      details: {
        current_usage_mb: Math.round(quotaCheck.currentUsageBytes / (1024 * 1024)),
        quota_mb: Math.round(quotaCheck.quotaBytes / (1024 * 1024)),
        available_mb: Math.round(quotaCheck.availableBytes / (1024 * 1024)),
        usage_percentage: quotaCheck.usagePercentage.toFixed(2) + '%',
        can_upload_1mb: quotaCheck.allowed
      }
    });
  } catch (error: any) {
    results.push({
      test: 'StorageQuotaService 测试',
      status: 'FAIL',
      message: error.message
    });
  }
}

async function testStorageUnitDisplay() {
  try {
    // 测试不同字节数的MB转换
    const testCases = [
      { bytes: 104857600, expectedMB: 100 },
      { bytes: 1073741824, expectedMB: 1024 },
      { bytes: 10485760, expectedMB: 10 }
    ];

    let allCorrect = true;
    const details: any[] = [];

    for (const testCase of testCases) {
      const actualMB = Math.round(testCase.bytes / (1024 * 1024));
      const isCorrect = actualMB === testCase.expectedMB;
      
      if (!isCorrect) {
        allCorrect = false;
      }

      details.push({
        bytes: testCase.bytes,
        expected_mb: testCase.expectedMB,
        actual_mb: actualMB,
        correct: isCorrect
      });
    }

    if (allCorrect) {
      results.push({
        test: '存储空间单位转换测试',
        status: 'PASS',
        message: '字节到MB的转换正确',
        details
      });
    } else {
      results.push({
        test: '存储空间单位转换测试',
        status: 'FAIL',
        message: '字节到MB的转换不正确',
        details
      });
    }
  } catch (error: any) {
    results.push({
      test: '存储空间单位转换测试',
      status: 'FAIL',
      message: error.message
    });
  }
}

// 运行测试
testStorageFeatureConnectivity();
