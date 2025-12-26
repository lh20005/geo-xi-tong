import * as fc from 'fast-check';
import { productService } from '../../services/ProductService';
import { pool } from '../../db/database';

/**
 * Feature: product-subscription-system, Property 25: 配置回滚恢复旧值
 * Validates: Requirements 8.3, 8.5
 * 
 * 属性：对于任意配置回滚操作，系统必须恢复到历史记录中的旧值
 */

// Mock dependencies
jest.mock('../../db/database');
jest.mock('../../services/SubscriptionService');

describe('Property Test: Config Rollback Restores Old Value', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该将价格回滚到旧值', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }), // 历史记录ID
        fc.integer({ min: 1, max: 100 }), // 套餐ID
        fc.integer({ min: 1, max: 10 }), // 管理员ID
        fc.float({ min: 1, max: 1000 }), // 旧价格
        fc.float({ min: 1, max: 1000 }), // 新价格
        async (historyId, planId, adminId, oldPrice, newPrice) => {
          const mockClient = {
            query: jest.fn(),
            release: jest.fn(),
          };

          // Mock pool.connect
          (pool.connect as jest.Mock).mockResolvedValueOnce(mockClient);

          // Mock 历史记录查询
          mockClient.query
            .mockResolvedValueOnce({ rows: [] }) // BEGIN
            .mockResolvedValueOnce({
              // 获取历史记录
              rows: [{
                id: historyId,
                plan_id: planId,
                changed_by: adminId,
                change_type: 'price',
                field_name: 'price',
                old_value: oldPrice.toString(),
                new_value: newPrice.toString(),
              }],
            })
            .mockResolvedValueOnce({ rows: [] }) // UPDATE price
            .mockResolvedValueOnce({ rows: [] }) // INSERT history
            .mockResolvedValueOnce({ rows: [] }) // COMMIT
            .mockResolvedValueOnce({
              // 获取 plan_code
              rows: [{ plan_code: 'professional' }],
            });

          await productService.rollbackConfig(historyId, adminId, '127.0.0.1', 'test');

          // 验证价格被回滚到旧值
          const updateCall = mockClient.query.mock.calls.find((call: any) =>
            call[0].includes('UPDATE subscription_plans') && call[0].includes('price')
          );

          expect(updateCall).toBeDefined();
          expect(updateCall[1]).toContain(oldPrice); // 回滚到旧值
          expect(updateCall[1]).toContain(planId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('应该将状态回滚到旧值', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 10 }),
        fc.boolean(), // 旧状态
        fc.boolean(), // 新状态
        async (historyId, planId, adminId, oldStatus, newStatus) => {
          const mockClient = {
            query: jest.fn(),
            release: jest.fn(),
          };

          (pool.connect as jest.Mock).mockResolvedValueOnce(mockClient);

          mockClient.query
            .mockResolvedValueOnce({ rows: [] }) // BEGIN
            .mockResolvedValueOnce({
              rows: [{
                id: historyId,
                plan_id: planId,
                changed_by: adminId,
                change_type: 'status',
                field_name: 'is_active',
                old_value: oldStatus.toString(),
                new_value: newStatus.toString(),
              }],
            })
            .mockResolvedValueOnce({ rows: [] }) // UPDATE status
            .mockResolvedValueOnce({ rows: [] }) // INSERT history
            .mockResolvedValueOnce({ rows: [] }) // COMMIT
            .mockResolvedValueOnce({
              rows: [{ plan_code: 'professional' }],
            });

          await productService.rollbackConfig(historyId, adminId, '127.0.0.1', 'test');

          // 验证状态被回滚
          const updateCall = mockClient.query.mock.calls.find((call: any) =>
            call[0].includes('UPDATE subscription_plans') && call[0].includes('is_active')
          );

          expect(updateCall).toBeDefined();
          expect(updateCall[1]).toContain(oldStatus);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('应该将功能配额回滚到旧值', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 10 }),
        fc.constantFrom('articles_per_day', 'publish_per_day', 'platform_accounts', 'keyword_distillation'),
        fc.integer({ min: 1, max: 100 }), // 旧配额
        fc.integer({ min: 1, max: 100 }), // 新配额
        async (historyId, planId, adminId, featureCode, oldQuota, newQuota) => {
          const mockClient = {
            query: jest.fn(),
            release: jest.fn(),
          };

          (pool.connect as jest.Mock).mockResolvedValueOnce(mockClient);

          mockClient.query
            .mockResolvedValueOnce({ rows: [] }) // BEGIN
            .mockResolvedValueOnce({
              rows: [{
                id: historyId,
                plan_id: planId,
                changed_by: adminId,
                change_type: 'feature',
                field_name: featureCode,
                old_value: oldQuota.toString(),
                new_value: newQuota.toString(),
              }],
            })
            .mockResolvedValueOnce({ rows: [] }) // UPDATE feature
            .mockResolvedValueOnce({ rows: [] }) // INSERT history
            .mockResolvedValueOnce({ rows: [] }) // COMMIT
            .mockResolvedValueOnce({
              rows: [{ plan_code: 'professional' }],
            });

          await productService.rollbackConfig(historyId, adminId, '127.0.0.1', 'test');

          // 验证功能配额被回滚
          const updateCall = mockClient.query.mock.calls.find((call: any) =>
            call[0].includes('UPDATE plan_features')
          );

          expect(updateCall).toBeDefined();
          expect(updateCall[1]).toContain(oldQuota);
          expect(updateCall[1]).toContain(planId);
          expect(updateCall[1]).toContain(featureCode);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('应该在回滚时创建新的历史记录', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 10 }),
        async (historyId, planId, adminId) => {
          const mockClient = {
            query: jest.fn(),
            release: jest.fn(),
          };

          (pool.connect as jest.Mock).mockResolvedValueOnce(mockClient);

          mockClient.query
            .mockResolvedValueOnce({ rows: [] }) // BEGIN
            .mockResolvedValueOnce({
              rows: [{
                id: historyId,
                plan_id: planId,
                changed_by: adminId,
                change_type: 'price',
                field_name: 'price',
                old_value: '100',
                new_value: '200',
              }],
            })
            .mockResolvedValueOnce({ rows: [] }) // UPDATE
            .mockResolvedValueOnce({ rows: [] }) // INSERT history (rollback record)
            .mockResolvedValueOnce({ rows: [] }) // COMMIT
            .mockResolvedValueOnce({
              rows: [{ plan_code: 'professional' }],
            });

          await productService.rollbackConfig(historyId, adminId, '127.0.0.1', 'test');

          // 验证创建了回滚历史记录
          const historyCall = mockClient.query.mock.calls.find((call: any) =>
            call[0].includes('INSERT INTO product_config_history')
          );

          expect(historyCall).toBeDefined();
          expect(historyCall[1]).toContain(planId);
          expect(historyCall[1]).toContain(adminId);
          expect(historyCall[1]).toContain('rollback');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('应该在回滚失败时回滚事务', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 10 }),
        async (historyId, planId, adminId) => {
          const mockClient = {
            query: jest.fn(),
            release: jest.fn(),
          };

          (pool.connect as jest.Mock).mockResolvedValueOnce(mockClient);

          mockClient.query
            .mockResolvedValueOnce({ rows: [] }) // BEGIN
            .mockResolvedValueOnce({
              rows: [{
                id: historyId,
                plan_id: planId,
                changed_by: adminId,
                change_type: 'price',
                field_name: 'price',
                old_value: '100',
                new_value: '200',
              }],
            })
            .mockRejectedValueOnce(new Error('Update failed')) // UPDATE 失败
            .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

          await expect(
            productService.rollbackConfig(historyId, adminId, '127.0.0.1', 'test')
          ).rejects.toThrow();

          // 验证调用了 ROLLBACK
          const rollbackCall = mockClient.query.mock.calls.find((call: any) =>
            call[0] === 'ROLLBACK'
          );

          expect(rollbackCall).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('应该拒绝回滚不存在的历史记录', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 10 }),
        async (historyId, adminId) => {
          const mockClient = {
            query: jest.fn(),
            release: jest.fn(),
          };

          (pool.connect as jest.Mock).mockResolvedValueOnce(mockClient);

          mockClient.query
            .mockResolvedValueOnce({ rows: [] }) // BEGIN
            .mockResolvedValueOnce({ rows: [] }) // 历史记录不存在
            .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

          await expect(
            productService.rollbackConfig(historyId, adminId, '127.0.0.1', 'test')
          ).rejects.toThrow('历史记录不存在');
        }
      ),
      { numRuns: 100 }
    );
  });
});
