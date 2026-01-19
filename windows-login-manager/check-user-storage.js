/**
 * 检查 electron-store 中的用户数据
 */

const Store = require('electron-store');
const path = require('path');
const os = require('os');

// 创建 store 实例（与应用使用相同的配置）
const store = new Store({
  name: 'platform-login-manager',
  encryptionKey: 'your-encryption-key-here',
});

console.log('=== Electron Store 用户数据检查 ===\n');

// 获取 store 文件路径
const storePath = store.path;
console.log('📁 Store 文件路径:', storePath);
console.log('');

// 检查用户信息
const user = store.get('user');
console.log('👤 用户信息:');
if (user) {
  console.log(JSON.stringify(user, null, 2));
  console.log('');
  console.log('✅ 用户已登录');
  console.log(`- ID: ${user.id}`);
  console.log(`- 用户名: ${user.username}`);
  console.log(`- 角色: ${user.role}`);
} else {
  console.log('❌ 未找到用户信息');
  console.log('');
  console.log('可能原因:');
  console.log('1. 用户未登录');
  console.log('2. Store 文件损坏');
  console.log('3. 应用未正确保存用户信息');
}

console.log('');
console.log('='.repeat(60));

// 检查 tokens
const tokens = store.get('tokens');
console.log('\n🔑 Token 信息:');
if (tokens) {
  console.log('✅ 找到 tokens');
  console.log(`- accessToken: ${tokens.accessToken ? '存在' : '不存在'}`);
  console.log(`- refreshToken: ${tokens.refreshToken ? '存在' : '不存在'}`);
  console.log(`- expiresAt: ${tokens.expiresAt ? new Date(tokens.expiresAt).toLocaleString() : '未设置'}`);
} else {
  console.log('❌ 未找到 tokens');
}

console.log('');
console.log('='.repeat(60));

// 检查配置
const config = store.get('config');
console.log('\n⚙️ 配置信息:');
if (config) {
  console.log(JSON.stringify(config, null, 2));
} else {
  console.log('❌ 未找到配置');
}

console.log('');
console.log('='.repeat(60));

// 列出所有存储的键
console.log('\n📋 所有存储的键:');
const allKeys = Object.keys(store.store);
console.log(allKeys.join(', '));

console.log('');
