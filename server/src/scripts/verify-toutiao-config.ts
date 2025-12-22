/**
 * 验证头条号数据库配置
 * 检查 platforms_config 表是否包含完整的头条号配置
 */

import { pool } from '../db/database';

interface PlatformConfig {
  platform_id: string;
  platform_name: string;
  login_url: string | null;
  selectors: {
    username?: string[];
    loginSuccess?: string[];
    successUrls?: string[];
  } | null;
}

async function verifyToutiaoConfig() {
  console.log('=== 验证头条号数据库配置 ===\n');

  try {
    // 查询头条号配置
    const result = await pool.query<PlatformConfig>(
      'SELECT platform_id, platform_name, login_url, selectors FROM platforms_config WHERE platform_id = $1',
      ['toutiao']
    );

    if (result.rows.length === 0) {
      console.error('❌ 错误：未找到头条号配置记录');
      return false;
    }

    const config = result.rows[0];
    console.log('✅ 找到头条号配置记录');
    console.log(`   平台ID: ${config.platform_id}`);
    console.log(`   平台名称: ${config.platform_name}`);
    console.log(`   登录URL: ${config.login_url || '未设置'}\n`);

    // 验证 login_url
    const expectedLoginUrl = 'https://mp.toutiao.com/auth/page/login';
    if (config.login_url !== expectedLoginUrl) {
      console.error(`❌ login_url 不正确`);
      console.error(`   期望: ${expectedLoginUrl}`);
      console.error(`   实际: ${config.login_url}`);
      return false;
    }
    console.log('✅ login_url 正确');

    // 验证 selectors 字段存在
    if (!config.selectors) {
      console.error('❌ 错误：selectors 字段不存在或为空');
      return false;
    }
    console.log('✅ selectors 字段存在\n');

    // 验证 username 选择器
    if (!config.selectors.username || !Array.isArray(config.selectors.username)) {
      console.error('❌ 错误：selectors.username 不存在或不是数组');
      return false;
    }
    console.log(`✅ selectors.username 存在 (${config.selectors.username.length} 个选择器)`);
    if (config.selectors.username.length < 7) {
      console.warn(`⚠️  警告：username 选择器数量少于预期 (期望: 7, 实际: ${config.selectors.username.length})`);
    }
    config.selectors.username.forEach((selector: string, index: number) => {
      console.log(`   ${index + 1}. ${selector}`);
    });
    console.log('');

    // 验证 loginSuccess 选择器
    if (!config.selectors.loginSuccess || !Array.isArray(config.selectors.loginSuccess)) {
      console.error('❌ 错误：selectors.loginSuccess 不存在或不是数组');
      return false;
    }
    console.log(`✅ selectors.loginSuccess 存在 (${config.selectors.loginSuccess.length} 个选择器)`);
    if (config.selectors.loginSuccess.length < 3) {
      console.warn(`⚠️  警告：loginSuccess 选择器数量少于预期 (期望: 3, 实际: ${config.selectors.loginSuccess.length})`);
    }
    config.selectors.loginSuccess.forEach((selector: string, index: number) => {
      console.log(`   ${index + 1}. ${selector}`);
    });
    console.log('');

    // 验证 successUrls
    if (!config.selectors.successUrls || !Array.isArray(config.selectors.successUrls)) {
      console.error('❌ 错误：selectors.successUrls 不存在或不是数组');
      console.error('   这是登录检测的关键配置，需要执行 010 迁移脚本');
      return false;
    }
    console.log(`✅ selectors.successUrls 存在 (${config.selectors.successUrls.length} 个URL模式)`);
    if (config.selectors.successUrls.length < 2) {
      console.warn(`⚠️  警告：successUrls 数量少于预期 (期望: 2, 实际: ${config.selectors.successUrls.length})`);
    }
    config.selectors.successUrls.forEach((url: string, index: number) => {
      console.log(`   ${index + 1}. ${url}`);
    });
    console.log('');

    // 验证 successUrls 内容
    const expectedUrls = ['mp.toutiao.com/profile_v4', 'mp.toutiao.com/creator'];
    const hasAllUrls = expectedUrls.every(url => config.selectors?.successUrls?.includes(url));
    if (!hasAllUrls) {
      console.warn('⚠️  警告：successUrls 内容与预期不完全匹配');
      console.warn(`   期望包含: ${expectedUrls.join(', ')}`);
      console.warn(`   实际包含: ${config.selectors?.successUrls?.join(', ') || '无'}`);
    } else {
      console.log('✅ successUrls 内容正确');
    }

    console.log('\n=== 配置验证完成 ===');
    console.log('✅ 所有必需字段都存在且格式正确');
    return true;

  } catch (error) {
    console.error('❌ 验证过程中发生错误:', error);
    return false;
  }
}

// 运行验证
verifyToutiaoConfig()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
