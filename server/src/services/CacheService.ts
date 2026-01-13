/**
 * 统一缓存服务
 * 提供 Redis 缓存的统一管理，支持多种缓存策略
 */

import Redis from 'ioredis';

// 缓存 TTL 配置（秒）
export const CACHE_TTL = {
  PLAN: 3600,           // 套餐配置 1小时
  PLAN_LIST: 1800,      // 套餐列表 30分钟（套餐很少变化）
  BOOSTER_STATS: 120,   // 加量包统计 2分钟
  USER_QUOTA: 300,      // 用户配额 5分钟
  USER_USAGE: 60,       // 用户使用量 1分钟
  DASHBOARD: 120,       // Dashboard 数据 2分钟
  PLATFORM_CONFIG: 1800, // 平台配置 30分钟
  USER_SUBSCRIPTION: 300, // 用户订阅 5分钟
  USER_STATUS: 60,      // 用户状态（订阅+折扣）1分钟
  DISCOUNT_ELIGIBILITY: 300, // 折扣资格 5分钟
  ARTICLE_LIST: 60,     // 文章列表 1分钟
  TASK_LIST: 30,        // 任务列表 30秒
};

// 缓存 Key 前缀
export const CACHE_PREFIX = {
  PLAN: 'plan:',
  PLAN_LIST: 'plans:list:',
  BOOSTER_STATS: 'booster:stats',
  USER_QUOTA: 'quota:',
  USER_USAGE: 'usage:',
  DASHBOARD_METRICS: 'dash:metrics:',
  DASHBOARD_TRENDS: 'dash:trends:',
  DASHBOARD_PLATFORM: 'dash:platform:',
  PLATFORM_CONFIG: 'platform:config:',
  USER_SUBSCRIPTION: 'sub:',
  USER_STATUS: 'user:status:',        // 用户状态（订阅+折扣）
  DISCOUNT_ELIGIBILITY: 'discount:',  // 折扣资格
  ARTICLE_COUNT: 'article:count:',
  TASK_COUNT: 'task:count:',
};

class CacheService {
  private redis: Redis;
  private isConnected: boolean = false;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => {
        if (times > 10) {
          console.error('❌ Redis 连接失败，已达到最大重试次数');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
      lazyConnect: true,
    });

    this.redis.on('connect', () => {
      this.isConnected = true;
      console.log('✅ CacheService: Redis 连接成功');
    });

    this.redis.on('error', (err) => {
      this.isConnected = false;
      console.error('❌ CacheService: Redis 错误:', err.message);
    });

    this.redis.on('close', () => {
      this.isConnected = false;
    });

    // 立即连接
    this.redis.connect().catch((err) => {
      console.error('❌ CacheService: Redis 初始连接失败:', err.message);
    });
  }

  /**
   * 获取缓存
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) return null;
    
    try {
      const data = await this.redis.get(key);
      if (data) {
        return JSON.parse(data) as T;
      }
      return null;
    } catch (error) {
      console.error(`[Cache] GET 失败 key=${key}:`, error);
      return null;
    }
  }

  /**
   * 设置缓存
   */
  async set(key: string, value: any, ttlSeconds: number): Promise<boolean> {
    if (!this.isConnected) return false;
    
    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`[Cache] SET 失败 key=${key}:`, error);
      return false;
    }
  }

  /**
   * 删除缓存
   */
  async del(key: string): Promise<boolean> {
    if (!this.isConnected) return false;
    
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.error(`[Cache] DEL 失败 key=${key}:`, error);
      return false;
    }
  }

  /**
   * 批量删除缓存（按前缀）
   */
  async delByPrefix(prefix: string): Promise<number> {
    if (!this.isConnected) return 0;
    
    try {
      const keys = await this.redis.keys(`${prefix}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      return keys.length;
    } catch (error) {
      console.error(`[Cache] DEL BY PREFIX 失败 prefix=${prefix}:`, error);
      return 0;
    }
  }

  /**
   * 获取或设置缓存（缓存穿透保护）
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number
  ): Promise<T> {
    // 尝试从缓存获取
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // 从数据源获取
    const data = await fetcher();
    
    // 写入缓存
    await this.set(key, data, ttlSeconds);
    
    return data;
  }

  /**
   * 使用户相关缓存失效
   */
  async invalidateUserCache(userId: number): Promise<void> {
    const prefixes = [
      `${CACHE_PREFIX.USER_QUOTA}${userId}`,
      `${CACHE_PREFIX.USER_USAGE}${userId}`,
      `${CACHE_PREFIX.DASHBOARD_METRICS}${userId}`,
      `${CACHE_PREFIX.DASHBOARD_TRENDS}${userId}`,
      `${CACHE_PREFIX.DASHBOARD_PLATFORM}${userId}`,
      `${CACHE_PREFIX.USER_SUBSCRIPTION}${userId}`,
      `${CACHE_PREFIX.ARTICLE_COUNT}${userId}`,
      `${CACHE_PREFIX.TASK_COUNT}${userId}`,
    ];

    for (const prefix of prefixes) {
      await this.delByPrefix(prefix);
    }
  }

  /**
   * 使套餐相关缓存失效
   */
  async invalidatePlanCache(): Promise<void> {
    await this.delByPrefix(CACHE_PREFIX.PLAN_LIST);
    await this.del(CACHE_PREFIX.BOOSTER_STATS);
  }

  /**
   * 预热套餐缓存
   */
  async warmupPlanCache(plans: any[]): Promise<void> {
    for (const plan of plans) {
      await this.set(
        `${CACHE_PREFIX.PLAN}${plan.plan_code}`,
        plan,
        CACHE_TTL.PLAN
      );
    }
    console.log(`[Cache] 预热套餐缓存完成，共 ${plans.length} 个套餐`);
  }

  /**
   * 获取缓存统计
   */
  async getStats(): Promise<{
    connected: boolean;
    keyCount: number;
    memoryUsage: string;
  }> {
    if (!this.isConnected) {
      return { connected: false, keyCount: 0, memoryUsage: '0' };
    }

    try {
      const info = await this.redis.info('memory');
      const keyCount = await this.redis.dbsize();
      
      const memoryMatch = info.match(/used_memory_human:(\S+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1] : 'unknown';

      return {
        connected: true,
        keyCount,
        memoryUsage,
      };
    } catch (error) {
      return { connected: false, keyCount: 0, memoryUsage: '0' };
    }
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

// 导出单例
export const cacheService = new CacheService();
