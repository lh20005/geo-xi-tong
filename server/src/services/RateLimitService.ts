/**
 * 频率限制服务
 * 使用滑动窗口算法实现频率限制
 * 当前使用内存存储,生产环境可替换为Redis
 */

export interface RateLimitConfig {
  windowMs: number;      // 时间窗口(毫秒)
  maxRequests: number;   // 最大请求数
}

interface RequestRecord {
  timestamps: number[];  // 请求时间戳数组
}

export class RateLimitService {
  private static instance: RateLimitService;
  private records: Map<string, RequestRecord>;
  private cleanupTimer?: NodeJS.Timeout;

  private constructor() {
    this.records = new Map();
    
    // 定期清理过期记录(每5分钟)
    // 使用 unref() 防止阻止进程退出
    this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    this.cleanupTimer.unref();
  }

  public static getInstance(): RateLimitService {
    if (!RateLimitService.instance) {
      RateLimitService.instance = new RateLimitService();
    }
    return RateLimitService.instance;
  }

  /**
   * 检查是否超过频率限制
   * 使用滑动窗口算法
   */
  async checkLimit(
    key: string,
    config: RateLimitConfig
  ): Promise<{ allowed: boolean; retryAfter?: number }> {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // 获取或创建记录
    let record = this.records.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.records.set(key, record);
    }

    // 移除窗口外的旧请求
    record.timestamps = record.timestamps.filter(ts => ts > windowStart);

    // 检查是否超过限制
    if (record.timestamps.length >= config.maxRequests) {
      // 计算需要等待的时间
      const oldestTimestamp = record.timestamps[0];
      const retryAfter = Math.ceil((oldestTimestamp + config.windowMs - now) / 1000);
      
      console.log(`[RateLimit] 超过限制: key=${key}, count=${record.timestamps.length}, max=${config.maxRequests}`);
      
      return {
        allowed: false,
        retryAfter: Math.max(retryAfter, 1)
      };
    }

    return { allowed: true };
  }

  /**
   * 检查并记录请求(原子操作,用于并发场景)
   * 如果允许则记录请求,否则拒绝
   */
  async checkAndRecordRequest(
    key: string,
    config: RateLimitConfig
  ): Promise<{ allowed: boolean; retryAfter?: number }> {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // 获取或创建记录
    let record = this.records.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.records.set(key, record);
    }

    // 移除窗口外的旧请求
    record.timestamps = record.timestamps.filter(ts => ts > windowStart);

    // 检查是否超过限制
    if (record.timestamps.length >= config.maxRequests) {
      // 计算需要等待的时间
      const oldestTimestamp = record.timestamps[0];
      const retryAfter = Math.ceil((oldestTimestamp + config.windowMs - now) / 1000);
      
      console.log(`[RateLimit] 超过限制: key=${key}, count=${record.timestamps.length}, max=${config.maxRequests}`);
      
      return {
        allowed: false,
        retryAfter: Math.max(retryAfter, 1)
      };
    }

    // 允许请求,立即记录
    record.timestamps.push(now);
    console.log(`[RateLimit] 允许并记录请求: key=${key}, count=${record.timestamps.length}`);

    return { allowed: true };
  }

  /**
   * 记录请求
   */
  async recordRequest(key: string): Promise<void> {
    const now = Date.now();

    let record = this.records.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.records.set(key, record);
    }

    record.timestamps.push(now);
    
    console.log(`[RateLimit] 记录请求: key=${key}, count=${record.timestamps.length}`);
  }

  /**
   * 获取剩余配额
   */
  async getRemainingQuota(key: string, config: RateLimitConfig): Promise<number> {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    const record = this.records.get(key);
    if (!record) {
      return config.maxRequests;
    }

    // 计算窗口内的请求数
    const validTimestamps = record.timestamps.filter(ts => ts > windowStart);
    const remaining = Math.max(0, config.maxRequests - validTimestamps.length);

    return remaining;
  }

  /**
   * 重置限制
   */
  async resetLimit(key: string): Promise<void> {
    this.records.delete(key);
    console.log(`[RateLimit] 重置限制: key=${key}`);
  }

  /**
   * 清理过期记录
   * 删除超过1小时没有活动的记录
   */
  public async cleanup(): Promise<number> {
    const now = Date.now();
    const expiryTime = 60 * 60 * 1000; // 1小时

    let cleanedCount = 0;
    for (const [key, record] of this.records.entries()) {
      // 如果最后一个请求超过1小时,删除记录
      if (record.timestamps.length === 0 || 
          now - record.timestamps[record.timestamps.length - 1] > expiryTime) {
        this.records.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[RateLimit] 清理了 ${cleanedCount} 条过期记录`);
    }

    return cleanedCount;
  }

  /**
   * 获取当前记录数(用于测试)
   */
  getRecordCount(): number {
    return this.records.size;
  }

  /**
   * 清空所有记录(用于测试)
   */
  clearAll(): void {
    this.records.clear();
  }

  /**
   * 停止清理定时器(用于测试清理)
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }
}

export const rateLimitService = RateLimitService.getInstance();
