/**
 * 测试头条号 API 配置返回
 * 验证 GET /api/platforms/toutiao 返回正确的配置
 */

import { pool } from '../db/database';

interface PlatformConfig {
  platform_id: string;
  platform_name: string;
  icon_url: string;
  login_url: string;
  selectors: {
    username: string[];
    loginSuccess: string[];
    successUrls?: string[];
  };
  enabled: boolean;
}

async function testToutiaoAPI() {
  console.log('=== 测试头条号 API 配置返回 ===\n');

  try {
    // 模拟 API 查询
    const result = await pool.query(
      'SELECT * FROM platforms_config WHERE platform_id = $1 AND is_enabled = true',
      ['toutiao']
    );

    if (result.rows.length === 0) {
      console.error('❌ 错误：未找到头条号配置或平台未启用');
      return false;
    }

    const row = result.rows[0];
    const platform: PlatformConfig = {
      platform_id: row.platform_id,
      platform_name: row.platform_name,
      icon_url: row.icon_url,
      login_url: row.login_url,
      selectors: row.selectors || {
        username: [],
        loginSuccess: []
      },
      enabled: row.is_enabled
    };

    console.log('✅ API 返回配置：\n');
    console.log(JSON.stringify(platform, null, 2));
    console.log('');

    // 验证响应格式
    let allChecksPass = true;

    // 检查 selectors 对象存在
    if (!platform.selectors) {
      console.error('❌ selectors 对象不存在');
      allChecksPass = false;
    } else {
      console.log('✅ selectors 对象存在');
    }

    // 检查 username 选择器
    if (!platform.selectors.username || !Array.isArray(platform.selectors.username)) {
      console.error('❌ selectors.username 不存在或不是数组');
      allChecksPass = false;
    } else if (platform.selectors.username.length < 7) {
      console.warn(`⚠️  selectors.username 数量不足 (期望: 7, 实际: ${platform.selectors.username.length})`);
      allChecksPass = false;
    } else {
      console.log(`✅ selectors.username 包含 ${platform.selectors.username.length} 个选择器`);
    }

    // 检查 loginSuccess 选择器
    if (!platform.selectors.loginSuccess || !Array.isArray(platform.selectors.loginSuccess)) {
      console.error('❌ selectors.loginSuccess 不存在或不是数组');
      allChecksPass = false;
    } else if (platform.selectors.loginSuccess.length < 3) {
      console.warn(`⚠️  selectors.loginSuccess 数量不足 (期望: 3, 实际: ${platform.selectors.loginSuccess.length})`);
      allChecksPass = false;
    } else {
      console.log(`✅ selectors.loginSuccess 包含 ${platform.selectors.loginSuccess.length} 个选择器`);
    }

    // 检查 successUrls
    if (!platform.selectors.successUrls || !Array.isArray(platform.selectors.successUrls)) {
      console.error('❌ selectors.successUrls 不存在或不是数组');
      allChecksPass = false;
    } else if (platform.selectors.successUrls.length < 2) {
      console.warn(`⚠️  selectors.successUrls 数量不足 (期望: 2, 实际: ${platform.selectors.successUrls.length})`);
      allChecksPass = false;
    } else {
      console.log(`✅ selectors.successUrls 包含 ${platform.selectors.successUrls.length} 个 URL 模式`);
    }

    // 检查 login_url
    const expectedLoginUrl = 'https://mp.toutiao.com/auth/page/login';
    if (platform.login_url !== expectedLoginUrl) {
      console.error(`❌ login_url 不正确 (期望: ${expectedLoginUrl}, 实际: ${platform.login_url})`);
      allChecksPass = false;
    } else {
      console.log('✅ login_url 正确');
    }

    console.log('\n=== API 配置测试完成 ===');
    if (allChecksPass) {
      console.log('✅ 所有检查通过！API 返回正确的配置');
    } else {
      console.log('❌ 部分检查失败，请查看上面的错误信息');
    }

    return allChecksPass;

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
    return false;
  }
}

// 运行测试
testToutiaoAPI()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
