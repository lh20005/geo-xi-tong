/**
 * 清除存储空间相关的 Redis 缓存
 */

import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
});

async function clearStorageCache() {
  console.log('=== 清除存储空间相关缓存 ===\n');

  try {
    // 1. 清除套餐配置缓存
    console.log('1️⃣ 清除套餐配置缓存...');
    const planKeys = await redis.keys('plan:*');
    if (planKeys.length > 0) {
      await redis.del(...planKeys);
      console.log(`✅ 已清除 ${planKeys.length} 个套餐缓存键`);
    } else {
      console.log('未找到套餐缓存');
    }
    console.log('');

    // 2. 清除用户订阅缓存
    console.log('2️⃣ 清除用户订阅缓存...');
    const subscriptionKeys = await redis.keys('user:*:subscription');
    if (subscriptionKeys.length > 0) {
      await redis.del(...subscriptionKeys);
      console.log(`✅ 已清除 ${subscriptionKeys.length} 个订阅缓存键`);
    } else {
      console.log('未找到订阅缓存');
    }
    console.log('');

    // 3. 清除用户配额缓存
    console.log('3️⃣ 清除用户配额缓存...');
    const quotaKeys = await redis.keys('user:*:quota');
    if (quotaKeys.length > 0) {
      await redis.del(...quotaKeys);
      console.log(`✅ 已清除 ${quotaKeys.length} 个配额缓存键`);
    } else {
      console.log('未找到配额缓存');
    }
    console.log('');

    // 4. 清除存储使用缓存
    console.log('4️⃣ 清除存储使用缓存...');
    const storageKeys = await redis.keys('user:*:storage');
    if (storageKeys.length > 0) {
      await redis.del(...storageKeys);
      console.log(`✅ 已清除 ${storageKeys.length} 个存储缓存键`);
    } else {
      console.log('未找到存储缓存');
    }
    console.log('');

    // 5. 清除所有用户相关缓存
    console.log('5️⃣ 清除所有用户相关缓存...');
    const userKeys = await redis.keys('user:*');
    if (userKeys.length > 0) {
      await redis.del(...userKeys);
      console.log(`✅ 已清除 ${userKeys.length} 个用户缓存键`);
    } else {
      console.log('未找到用户缓存');
    }
    console.log('');

    console.log('=== 缓存清除完成 ===');
    console.log('✅ 所有存储空间相关缓存已清除');
    console.log('');
    console.log('建议用户：');
    console.log('1. 刷新浏览器页面（Ctrl+Shift+R 或 Cmd+Shift+R）');
    console.log('2. 重新登录以获取最新配额信息');

  } catch (error) {
    console.error('清除缓存时出错:', error);
  } finally {
    await redis.quit();
  }
}

clearStorageCache();
