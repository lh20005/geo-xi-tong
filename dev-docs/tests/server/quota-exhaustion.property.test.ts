import * as fc from 'fast-check';
import { subscriptionService } from '../../services/SubscriptionService';
import { FeatureCode } from '../../config/features';
import { pool } from '../../db/database';

/**
 * Feature: product-subscription-system, Property 20: 配额耗尽拒绝请求
 * Validates: Requirements 6.2, 6.4, 6.6, 6.8
 * 
 * 属性：对于任意功能，当配额耗尽时，系统必须拒绝请求
 */

// Mock dependencies
jest.mock('../../db/database');

describe('Property Test: Quota Exhaustion Rejection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该在配额完全耗尽时拒绝所有请求', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }), // 用户ID
        fc.constantFrom('articles_per_day', 'publish_per_day', 'platform_accounts', 'keyword_distillation'),
        fc.integer({ min: 1, max: 100 }), // 配额限制
        async (userId, featureCode, quota) => {
          // Mock 配额耗尽的场景
          (pool.query as jest.Mock)
            .mockResolvedValueOnce({
              rows: [{
                id: 1,
                user_id: userId,
                plan_id: 1,
                status: 'active',
                start_date: new Date(),
                end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              }],
            })
            .mockResolvedValueOnce({
              rows: [{
                id: 1,
                plan_code: 'professional',
                plan_name: '专业版',
                price: 99,
              }],
            })
            .mockResolvedValueOnce({
              rows: [{
                feature_code: featureCode,
                feature_value: quota,
              }],
            })
            .mockResolvedValueOnce({
              rows: [{
                usage_count: quota, // 使用量等于配额
              }],
            });

          const canPerform = await subscriptionService.canUserPerformAction(
            userId,
            featureCode as FeatureCode
          );

          // 配额耗尽必须拒绝
          expect(canPerform).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('应该在配额超出时拒绝请求', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        fc.constantFrom('articles_per_day', 'publish_per_day', 'platform_accounts', 'keyword_distillation'),
        fc.integer({ min: 1, max: 100 }), // 配额
        fc.integer({ min: 1, max: 100 }), // 超出量
        async (userId, featureCode, quota, excess) => {
          (pool.query as jest.Mock)
            .mockResolvedValueOnce({
              rows: [{
                id: 1,
                user_id: userId,
                plan_id: 1,
                status: 'active',
                start_date: new Date(),
                end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              }],
            })
            .mockResolvedValueOnce({
              rows: [{
                id: 1,
                plan_code: 'professional',
                plan_name: '专业版',
                price: 99,
              }],
            })
            .mockResolvedValueOnce({
              rows: [{
                feature_code: featureCode,
                feature_value: quota,
              }],
            })
            .mockResolvedValueOnce({
              rows: [{
                usage_count: quota + excess,
              }],
            });

          const canPerform = await subscriptionService.canUserPerformAction(
            userId,
            featureCode as FeatureCode
          );

          // 超出配额必须拒绝
          expect(canPerform).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('应该在配额剩余1时允许最后一次请求', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        fc.constantFrom('articles_per_day', 'publish_per_day', 'platform_accounts', 'keyword_distillation'),
        fc.integer({ min: 2, max: 100 }), // 配额至少为2
        async (userId, featureCode, quota) => {
          (pool.query as jest.Mock)
            .mockResolvedValueOnce({
              rows: [{
                id: 1,
                user_id: userId,
                plan_id: 1,
                status: 'active',
                start_date: new Date(),
                end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              }],
            })
            .mockResolvedValueOnce({
              rows: [{
                id: 1,
                plan_code: 'professional',
                plan_name: '专业版',
                price: 99,
              }],
            })
            .mockResolvedValueOnce({
              rows: [{
                feature_code: featureCode,
                feature_value: quota,
              }],
            })
            .mockResolvedValueOnce({
              rows: [{
                usage_count: quota - 1, // 还剩1次
              }],
            });

          const canPerform = await subscriptionService.canUserPerformAction(
            userId,
            featureCode as FeatureCode
          );

          // 还有剩余应该允许
          expect(canPerform).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('应该对所有功能类型一致地应用配额限制', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 100 }),
        async (userId, quota) => {
          const features: FeatureCode[] = [
            'articles_per_day',
            'publish_per_day',
            'platform_accounts',
            'keyword_distillation',
          ];

          for (const featureCode of features) {
            // Mock 配额耗尽
            (pool.query as jest.Mock)
              .mockResolvedValueOnce({
                rows: [{
                  id: 1,
                  user_id: userId,
                  plan_id: 1,
                  status: 'active',
                  start_date: new Date(),
                  end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                }],
              })
              .mockResolvedValueOnce({
                rows: [{
                  id: 1,
                  plan_code: 'professional',
                  plan_name: '专业版',
                  price: 99,
                }],
              })
              .mockResolvedValueOnce({
                rows: [{
                  feature_code: featureCode,
                  feature_value: quota,
                }],
              })
              .mockResolvedValueOnce({
                rows: [{
                  usage_count: quota,
                }],
              });

            const canPerform = await subscriptionService.canUserPerformAction(
              userId,
              featureCode
            );

            // 所有功能类型都应该一致地拒绝
            expect(canPerform).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('应该在没有订阅时拒绝请求', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        fc.constantFrom('articles_per_day', 'publish_per_day', 'platform_accounts', 'keyword_distillation'),
        async (userId, featureCode) => {
          // Mock 没有订阅
          (pool.query as jest.Mock).mockResolvedValueOnce({
            rows: [], // 没有订阅记录
          });

          const canPerform = await subscriptionService.canUserPerformAction(
            userId,
            featureCode as FeatureCode
          );

          // 没有订阅应该拒绝
          expect(canPerform).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('应该在订阅过期时拒绝请求', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        fc.constantFrom('articles_per_day', 'publish_per_day', 'platform_accounts', 'keyword_distillation'),
        async (userId, featureCode) => {
          // Mock 订阅已过期
          (pool.query as jest.Mock).mockResolvedValueOnce({
            rows: [{
              id: 1,
              user_id: userId,
              plan_id: 1,
              status: 'expired', // 已过期
              start_date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
              end_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            }],
          });

          const canPerform = await subscriptionService.canUserPerformAction(
            userId,
            featureCode as FeatureCode
          );

          // 订阅过期应该拒绝
          expect(canPerform).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
