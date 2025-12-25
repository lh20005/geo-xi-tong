/**
 * 手动测试脚本 - 安全配置服务
 * 用于验证 SecurityConfigService 的基本功能
 */

import { securityConfigService } from '../services/SecurityConfigService';
import { pool } from '../db/database';

async function testSecurityConfigService() {
  console.log('=== 开始测试 SecurityConfigService ===\n');

  try {
    // Test 1: 获取所有配置
    console.log('Test 1: 获取所有配置');
    const allConfigs = await securityConfigService.getAllConfigs();
    console.log(`✅ 成功获取 ${allConfigs.length} 个配置项`);
    console.log('前3个配置:', allConfigs.slice(0, 3).map(c => c.config_key));
    console.log('');

    // Test 2: 获取单个配置
    console.log('Test 2: 获取单个配置');
    const loginRateLimit = await securityConfigService.getConfig('rate_limit.login.max_requests');
    if (loginRateLimit) {
      console.log(`✅ 成功获取配置: ${loginRateLimit.config_key} = ${loginRateLimit.config_value}`);
    } else {
      console.log('❌ 配置不存在');
    }
    console.log('');

    // Test 3: 获取配置值（已解析）
    console.log('Test 3: 获取配置值（已解析）');
    const maxRequests = await securityConfigService.getConfigValue<number>('rate_limit.login.max_requests');
    console.log(`✅ 登录频率限制: ${maxRequests} 次 (类型: ${typeof maxRequests})`);
    console.log('');

    // Test 4: 更新配置
    console.log('Test 4: 更新配置');
    const oldValue = loginRateLimit?.config_value || '5';
    const newValue = '10';
    const updated = await securityConfigService.updateConfig(
      'rate_limit.login.max_requests',
      newValue,
      1, // admin_id = 1
      '测试更新'
    );
    console.log(`✅ 配置已更新: ${oldValue} -> ${updated.config_value}`);
    console.log('');

    // Test 5: 获取配置历史
    console.log('Test 5: 获取配置历史');
    const history = await securityConfigService.getConfigHistory('rate_limit.login.max_requests', 5);
    console.log(`✅ 获取到 ${history.length} 条历史记录`);
    if (history.length > 0) {
      console.log('最新记录:', {
        old_value: history[0].old_value,
        new_value: history[0].new_value,
        version: history[0].version
      });
    }
    console.log('');

    // Test 6: 恢复原值
    console.log('Test 6: 恢复原值');
    await securityConfigService.updateConfig(
      'rate_limit.login.max_requests',
      oldValue,
      1,
      '恢复原值'
    );
    console.log(`✅ 配置已恢复: ${oldValue}`);
    console.log('');

    // Test 7: 导出配置
    console.log('Test 7: 导出配置');
    const exportData = await securityConfigService.exportConfigs();
    console.log(`✅ 导出成功: ${exportData.configs.length} 个配置项`);
    console.log('导出版本:', exportData.version);
    console.log('');

    // Test 8: 验证功能（测试无效值）
    console.log('Test 8: 验证功能（测试无效值）');
    try {
      await securityConfigService.updateConfig(
        'rate_limit.login.max_requests',
        'invalid',
        1,
        '测试无效值'
      );
      console.log('❌ 应该抛出验证错误');
    } catch (error) {
      console.log(`✅ 正确拒绝无效值: ${(error as Error).message}`);
    }
    console.log('');

    console.log('=== 所有测试完成 ===');
  } catch (error) {
    console.error('❌ 测试失败:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// 运行测试
testSecurityConfigService()
  .then(() => {
    console.log('\n✅ 测试成功完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  });
