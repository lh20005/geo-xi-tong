import { createClient } from 'redis';
import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量 - 从 server 目录读取
dotenv.config({ path: path.join(__dirname, '../../.env') });

// 创建Redis客户端
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error('❌ Redis连接失败，已达到最大重试次数');
        return new Error('Redis连接失败');
      }
      return retries * 100; // 重试延迟
    }
  }
});

// 连接事件
redisClient.on('connect', () => {
  console.log('🔄 正在连接Redis...');
});

redisClient.on('ready', () => {
  console.log('✅ Redis连接成功');
});

redisClient.on('error', (err) => {
  console.error('❌ Redis错误:', err);
});

redisClient.on('end', () => {
  console.log('🔌 Redis连接已关闭');
});

// 连接Redis
(async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    console.error('❌ Redis连接失败:', error);
  }
})();

// 优雅关闭
process.on('SIGINT', async () => {
  await redisClient.quit();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await redisClient.quit();
  process.exit(0);
});

export { redisClient };
