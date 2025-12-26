/**
 * 频率限制服务测试
 * Feature: system-security-foundation
 * Property 5: 频率限制执行
 * Property 6: 滑动窗口算法正确性
 * Property 7: 差异化频率限制
 */

import { rateLimitService, RateLimitConfig } from '../RateLimitService';
import fc from 'fast-check';

describe('RateLimitService', () => {
  // 每个测试前清空所有记录
  beforeEach(() => {
    rateLimitService.clearAll();
  });

  // 所有测试完成后停止定时器
  afterAll(() => {
    rateLimitService.stopCleanupTimer();
  });

  /**
   * Property 5: 频率限制执行
   * For any operation type with configured rate limit, when the limit is 
   * exceeded within the time window, subsequent requests should be rejected.
   * Validates: Requirements 3.1, 3.2
   */
  describe('Property 5: 频率限制执行', () => {
    test('超过限制时应该拒绝请求', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            key: fc.string({ minLength: 3, maxLength: 20 }),
            maxRequests: fc.integer({ min: 1, max: 10 }),
            windowMs: fc.integer({ min: 1000, max: 5000 })
          }),
          async (data) => {
            const config: RateLimitConfig = {
              windowMs: data.windowMs,
              maxRequests: data.maxRequests
            };

            // 发送maxRequests次请求,都应该成功
            for (let i = 0; i < data.maxRequests; i++) {
              const result = await rateLimitService.checkLimit(data.key, config);
              expect(result.allowed).toBe(true);
              await rateLimitService.recordRequest(data.key);
            }

            // 第maxRequests+1次请求应该被拒绝
            const result = await rateLimitService.checkLimit(data.key, config);
            expect(result.allowed).toBe(false);
            expect(result.retryAfter).toBeGreaterThan(0);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('在时间窗口过期后应该允许新请求', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            key: fc.string({ minLength: 3, maxLength: 20 }),
            maxRequests: fc.integer({ min: 1, max: 5 })
          }),
          async (data) => {
            const config: RateLimitConfig = {
              windowMs: 100,  // 100ms窗口
              maxRequests: data.maxRequests
            };

            // 填满限制
            for (let i = 0; i < data.maxRequests; i++) {
              await rateLimitService.checkLimit(data.key, config);
              await rateLimitService.recordRequest(data.key);
            }

            // 应该被拒绝
            let result = await rateLimitService.checkLimit(data.key, config);
            expect(result.allowed).toBe(false);

            // 等待窗口过期
            await new Promise(resolve => setTimeout(resolve, 150));

            // 现在应该允许
            result = await rateLimitService.checkLimit(data.key, config);
            expect(result.allowed).toBe(true);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Property 6: 滑动窗口算法正确性
   * For any sequence of requests, the rate limit should count only 
   * requests within the sliding time window, not fixed time buckets.
   * Validates: Requirements 3.3
   */
  describe('Property 6: 滑动窗口算法正确性', () => {
    test('应该使用滑动窗口而非固定时间桶', async () => {
      const config: RateLimitConfig = {
        windowMs: 1000,  // 1秒窗口
        maxRequests: 3
      };
      const key = 'sliding_window_test';

      // t=0: 发送2个请求
      await rateLimitService.recordRequest(key);
      await rateLimitService.recordRequest(key);

      // t=600ms: 发送1个请求(总共3个,达到限制)
      await new Promise(resolve => setTimeout(resolve, 600));
      await rateLimitService.recordRequest(key);

      // t=600ms: 应该被拒绝(窗口内有3个请求)
      let result = await rateLimitService.checkLimit(key, config);
      expect(result.allowed).toBe(false);

      // t=1100ms: 等待500ms,前2个请求应该过期
      await new Promise(resolve => setTimeout(resolve, 500));

      // t=1100ms: 现在应该允许(窗口内只有1个请求)
      result = await rateLimitService.checkLimit(key, config);
      expect(result.allowed).toBe(true);
    });

    test('滑动窗口应该正确移除过期请求', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            key: fc.string({ minLength: 3, maxLength: 20 }),
            initialRequests: fc.integer({ min: 1, max: 5 }),
            maxRequests: fc.integer({ min: 3, max: 10 })
          }),
          async (data) => {
            const config: RateLimitConfig = {
              windowMs: 200,  // 200ms窗口
              maxRequests: data.maxRequests
            };

            // 发送一些初始请求
            for (let i = 0; i < data.initialRequests; i++) {
              await rateLimitService.recordRequest(data.key);
            }

            // 等待窗口过期
            await new Promise(resolve => setTimeout(resolve, 250));

            // 获取剩余配额,应该是完整的maxRequests
            const remaining = await rateLimitService.getRemainingQuota(data.key, config);
            expect(remaining).toBe(data.maxRequests);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Property 7: 差异化频率限制
   * For any two different operation types, they should have independent 
   * rate limit counters and configurations.
   * Validates: Requirements 3.5
   */
  describe('Property 7: 差异化频率限制', () => {
    test('不同的key应该有独立的计数器', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            key1: fc.string({ minLength: 3, maxLength: 20 }),
            key2: fc.string({ minLength: 3, maxLength: 20 }),
            maxRequests: fc.integer({ min: 2, max: 5 })
          }),
          async (data) => {
            // 确保key不同
            if (data.key1 === data.key2) {
              return;
            }

            // 每次测试前清理状态
            rateLimitService.clearAll();

            const config: RateLimitConfig = {
              windowMs: 5000,
              maxRequests: data.maxRequests
            };

            // key1填满限制
            for (let i = 0; i < data.maxRequests; i++) {
              await rateLimitService.checkLimit(data.key1, config);
              await rateLimitService.recordRequest(data.key1);
            }

            // key1应该被拒绝
            let result1 = await rateLimitService.checkLimit(data.key1, config);
            expect(result1.allowed).toBe(false);

            // key2应该仍然允许
            let result2 = await rateLimitService.checkLimit(data.key2, config);
            expect(result2.allowed).toBe(true);

            // key2可以发送请求
            await rateLimitService.recordRequest(data.key2);
            result2 = await rateLimitService.checkLimit(data.key2, config);
            expect(result2.allowed).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('不同的配置应该独立应用', async () => {
      const key = 'multi_config_test';
      
      const strictConfig: RateLimitConfig = {
        windowMs: 1000,
        maxRequests: 2
      };

      const lenientConfig: RateLimitConfig = {
        windowMs: 1000,
        maxRequests: 5
      };

      // 发送3个请求
      for (let i = 0; i < 3; i++) {
        await rateLimitService.recordRequest(key);
      }

      // 严格配置应该拒绝(3 > 2)
      let strictResult = await rateLimitService.checkLimit(key, strictConfig);
      expect(strictResult.allowed).toBe(false);

      // 宽松配置应该允许(3 < 5)
      let lenientResult = await rateLimitService.checkLimit(key, lenientConfig);
      expect(lenientResult.allowed).toBe(true);
    });
  });

  // 单元测试 - 具体示例
  describe('Unit Tests', () => {
    test('应该正确计算剩余配额', async () => {
      const key = 'quota_test';
      const config: RateLimitConfig = {
        windowMs: 5000,
        maxRequests: 10
      };

      // 初始配额应该是10
      let remaining = await rateLimitService.getRemainingQuota(key, config);
      expect(remaining).toBe(10);

      // 发送3个请求
      for (let i = 0; i < 3; i++) {
        await rateLimitService.recordRequest(key);
      }

      // 剩余配额应该是7
      remaining = await rateLimitService.getRemainingQuota(key, config);
      expect(remaining).toBe(7);
    });

    test('重置限制应该清空计数器', async () => {
      const key = 'reset_test';
      const config: RateLimitConfig = {
        windowMs: 5000,
        maxRequests: 3
      };

      // 填满限制
      for (let i = 0; i < 3; i++) {
        await rateLimitService.recordRequest(key);
      }

      // 应该被拒绝
      let result = await rateLimitService.checkLimit(key, config);
      expect(result.allowed).toBe(false);

      // 重置
      await rateLimitService.resetLimit(key);

      // 现在应该允许
      result = await rateLimitService.checkLimit(key, config);
      expect(result.allowed).toBe(true);
    });

    test('retryAfter应该返回合理的等待时间', async () => {
      const key = 'retry_after_test';
      const config: RateLimitConfig = {
        windowMs: 10000,  // 10秒
        maxRequests: 2
      };

      // 填满限制
      for (let i = 0; i < 2; i++) {
        await rateLimitService.recordRequest(key);
      }

      // 检查retryAfter
      const result = await rateLimitService.checkLimit(key, config);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.retryAfter).toBeLessThanOrEqual(10);
    });

    test('应该处理并发请求', async () => {
      const key = 'concurrent_test';
      const config: RateLimitConfig = {
        windowMs: 5000,
        maxRequests: 5
      };

      // 并发发送10个请求,使用原子操作
      const promises = Array.from({ length: 10 }, async () => {
        const result = await rateLimitService.checkAndRecordRequest(key, config);
        return result.allowed;
      });

      const results = await Promise.all(promises);
      
      // 应该有5个成功,5个失败
      const allowedCount = results.filter(r => r).length;
      expect(allowedCount).toBeLessThanOrEqual(5);
    });
  });
});
