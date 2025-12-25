import * as fc from 'fast-check';
import { subscriptionService } from '../../services/SubscriptionService';
import { FeatureCode } from '../../config/features';
import { pool } from '../../db/database';

/**
 * Feature: product-subscription-system, Property 22: 使用量记录增量
 * Validates: Requirements 6.10
 * 
 * 属性：对于任意使用量记录操作，使用量应该按指定数量增加
 */

// Mock dependencies
jest.mock('../../db/database');
jest.mock('../../services/WebSocketService');

describe('Property Test: Usage Recording Increment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该按指定数量增加使用量', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }), // 用户ID
        fc.constantFrom('articles_per_day', 'publish_per_day', 'platform_accounts', 'keyword_distillation'),
        fc.integer({ min: 1, max: 10 }), // 增加量
        async (userId, featureCode, amount) => {
          // 重置 mock
          jest.clearAllMocks();
          
          // Mock 数据库操作
          // 1. recordUsage 的 INSERT
          (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
          // 2. getUserUsage 的 SELECT
          (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ usage_count: amount }] });

          await subscriptionService.recordUsage(userId, featureCode as FeatureCode, amount);

          // 验证 INSERT ... ON CONFLICT DO UPDATE 被调用
          expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO user_usage'),
            expect.arrayContaining([userId, featureCode, amount])
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('应该支持单次增加1的默认行为', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        fc.constantFrom('articles_per_day', 'publish_per_day', 'platform_accounts', 'keyword_distillation'),
        async (userId, featureCode) => {
          // 重置 mock
          jest.clearAllMocks();
          
          // Mock 数据库操作
          (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
          (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ usage_count: 1 }] });

          // 不传 amount 参数，默认为1
          await subscriptionService.recordUsage(userId, featureCode as FeatureCode);

          expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO user_usage'),
            expect.arrayContaining([userId, featureCode, 1]) // 默认为1
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('应该支持批量增加使用量', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        fc.constantFrom('articles_per_day', 'publish_per_day', 'platform_accounts', 'keyword_distillation'),
        fc.integer({ min: 2, max: 50 }), // 批量数量
        async (userId, featureCode, batchAmount) => {
          // 重置 mock
          jest.clearAllMocks();
          
          (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
          (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ usage_count: batchAmount }] });

          await subscriptionService.recordUsage(userId, featureCode as FeatureCode, batchAmount);

          expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO user_usage'),
            expect.arrayContaining([userId, featureCode, batchAmount])
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('应该为所有功能类型记录使用量', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 10 }),
        async (userId, amount) => {
          // 重置 mock
          jest.clearAllMocks();
          
          const features: FeatureCode[] = [
            'articles_per_day',
            'publish_per_day',
            'platform_accounts',
            'keyword_distillation',
          ];

          for (const featureCode of features) {
            (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
            (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ usage_count: amount }] });

            await subscriptionService.recordUsage(userId, featureCode, amount);

            expect(pool.query).toHaveBeenCalledWith(
              expect.stringContaining('INSERT INTO user_usage'),
              expect.arrayContaining([userId, featureCode, amount])
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('应该在记录使用量时包含正确的时间周期', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        fc.constantFrom('articles_per_day', 'publish_per_day', 'platform_accounts', 'keyword_distillation'),
        async (userId, featureCode) => {
          // 重置 mock
          jest.clearAllMocks();
          
          (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
          (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ usage_count: 1 }] });

          await subscriptionService.recordUsage(userId, featureCode as FeatureCode, 1);

          // 验证包含 period_start 和 period_end
          const call = (pool.query as jest.Mock).mock.calls[0];
          expect(call[0]).toContain('period_start');
          expect(call[0]).toContain('period_end');
          expect(call[1]).toHaveLength(5); // userId, featureCode, amount, periodStart, periodEnd
        }
      ),
      { numRuns: 100 }
    );
  });

  it('应该支持多次记录累加使用量', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        fc.constantFrom('articles_per_day', 'publish_per_day', 'platform_accounts', 'keyword_distillation'),
        fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 2, maxLength: 10 }), // 多次记录
        async (userId, featureCode, amounts) => {
          // 重置 mock
          jest.clearAllMocks();
          
          for (const amount of amounts) {
            (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

            await subscriptionService.recordUsage(userId, featureCode as FeatureCode, amount);
          }

          // 验证至少调用了数据库（每次至少1个 INSERT）
          expect(pool.query).toHaveBeenCalled();

          // 验证第一次 INSERT 调用包含正确的参数
          const firstInsertCall = (pool.query as jest.Mock).mock.calls.find(
            call => call[0].includes('INSERT INTO user_usage')
          );
          expect(firstInsertCall).toBeDefined();
          expect(firstInsertCall[1]).toContain(userId);
          expect(firstInsertCall[1]).toContain(featureCode);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('应该使用 UPSERT 语义处理并发记录', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        fc.constantFrom('articles_per_day', 'publish_per_day', 'platform_accounts', 'keyword_distillation'),
        fc.integer({ min: 1, max: 10 }),
        async (userId, featureCode, amount) => {
          // 重置 mock
          jest.clearAllMocks();
          
          (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
          (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ usage_count: amount }] });

          await subscriptionService.recordUsage(userId, featureCode as FeatureCode, amount);

          // 验证使用了 ON CONFLICT DO UPDATE
          const query = (pool.query as jest.Mock).mock.calls[0][0];
          expect(query).toContain('ON CONFLICT');
          expect(query).toContain('DO UPDATE');
          expect(query).toContain('usage_count = user_usage.usage_count');
        }
      ),
      { numRuns: 100 }
    );
  });
});
