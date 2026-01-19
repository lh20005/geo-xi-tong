/**
 * 检查实际应用的 electron-store 数据
 */

const Store = require('electron-store');
const path = require('path');

// 模拟 Electron app 的 name
// 需要与实际应用的 app.name 一致
const appNames = [
  'ai-geo-system',
  'platform-login-manager',
  'Electron'
];

console.log('=== 检查所有可能的 Store 位置 ===\n');

for (const appName of appNames) {
  console.log(`\n📁 检查应用: ${appName}`);
  console.log('='.repeat(60));
  
  try {
    const store = new Store({
      name: 'platform-login-manager',
      encryptionKey: 'your-encryption-key-here',
      cwd: path.join(process.env.HOME, 'Library', 'Application Support', appName)
    });

    const storePath = store.path;
    console.log('Store 路径:', storePath);

    // 检查用户信息
    const user = store.get('user');
    if (user) {
      console.log('\n✅ 找到用户信息:');
      console.log(JSON.stringify(user, null, 2));
      
      // 检查 tokens
      const tokens = store.get('tokens');
      if (tokens) {
        console.log('\n✅ 找到 tokens');
        console.log(`- accessToken: ${tokens.accessToken ? '存在 (' + tokens.accessToken.substring(0, 20) + '...)' : '不存在'}`);
        console.log(`- refreshToken: ${tokens.refreshToken ? '存在' : '不存在'}`);
        if (tokens.expiresAt) {
          const expiresDate = new Date(tokens.expiresAt);
          const now = new Date();
          const isExpired = expiresDate < now;
          console.log(`- expiresAt: ${expiresDate.toLocaleString()} ${isExpired ? '❌ 已过期' : '✅ 有效'}`);
        }
      }

      // 检查配置
      const config = store.get('config');
      if (config) {
        console.log('\n⚙️ 配置信息:');
        console.log(JSON.stringify(config, null, 2));
      }

      console.log('\n🎉 这是正确的 Store！');
      break;
    } else {
      console.log('❌ 未找到用户信息');
    }
  } catch (error) {
    console.log(`❌ 错误: ${error.message}`);
  }
}

console.log('\n' + '='.repeat(60));
