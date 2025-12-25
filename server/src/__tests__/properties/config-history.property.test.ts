import * as fc from 'fast-check';
import { productService } from '../../services/ProductService';
import { pool } from '../../db/database';

/**
 * Feature: product-subscription-system, Property 23: 配置变更创建历史记录
 * Validates: Requirements 8.1
 * 
 * 属性：对于任意配置变更，系统必须创建历史记录
 */

// Mock dependencies
jest.mock('../../db/database');

describe('Property Test: Config Change History Creation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该为每次配置变更创建历史记录', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }), // 套餐ID
        fc.integer({ min: 1, max: 10 }), // 管理员ID
        fc.constantFrom('price', 'status', 'feature'), // 变更类型
        fc.string({ minLength: 1, maxLength: 50 }), // 字段名
        fc.string({ minLength: 1, maxLength: 100 }), // 旧值
        fc.string({ minLength: 1, maxLength: 100 }), // 新值
        async (planId, adminId, changeType, fieldName, oldValue, newValue) => {
          (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

          await productService.recordConfigChange({
            planId,
            changedBy: adminId,
            changeType,
            fieldName,
            oldValue,
            newValue,
            ipAddress: '127.0.0.1',
            userAgent: 'test-agent',
          });

          // 验证历史记录被创建
          expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO product_config_history'),
            expect.arrayContaining([
              planId,
              adminId,
              changeType,
              fieldName,
              oldValue,
              newValue,
              '127.0.0.1',
              'test-agent',
            ])
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('应该记录所有必需的变更信息', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 10 }),
        fc.constantFrom('price', 'status', 'feature'),
        async (planId, adminId, changeType) => {
          (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

          await productService.recordConfigChange({
            planId,
            changedBy: adminId,
            changeType,
            fieldName: 'test_field',
            oldValue: 'old',
            newValue: 'new',
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
          });

          const call = (pool.query as jest.Mock).mock.calls[0];
          const params = call[1];

          // 验证所有必需字段都被记录
          expect(params).toContain(planId);
          expect(params).toContain(adminId);
          expect(params).toContain(changeType);
          expect(params).toContain('test_field');
          expect(params).toContain('old');
          expect(params).toContain('new');
          expect(params).toContain('192.168.1.1');
          expect(params).toContain('Mozilla/5.0');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('应该为不同类型的变更创建历史记录', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 10 }),
        async (planId, adminId) => {
          const changeTypes = ['price', 'status', 'feature'];

          for (const changeType of changeTypes) {
            (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

            await productService.recordConfigChange({
              planId,
              changedBy: adminId,
              changeType,
              fieldName: `${changeType}_field`,
              oldValue: 'old',
              newValue: 'new',
              ipAddress: '127.0.0.1',
              userAgent: 'test',
            });
          }

          // 验证为每种类型都创建了记录
          expect(pool.query).toHaveBeenCalledTimes(changeTypes.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('应该支持多次变更同一字段', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 10 }),
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 10 }),
        async (planId, adminId, values) => {
          // 重置 mock
          jest.clearAllMocks();
          
          // 模拟多次变更
          for (let i = 0; i < values.length - 1; i++) {
            (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

            await productService.recordConfigChange({
              planId,
              changedBy: adminId,
              changeType: 'price',
              fieldName: 'price',
              oldValue: values[i],
              newValue: values[i + 1],
              ipAddress: '127.0.0.1',
              userAgent: 'test',
            });
          }

          // 验证每次变更都被记录
          expect(pool.query).toHaveBeenCalledTimes(values.length - 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('应该记录 IP 地址和用户代理', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 10 }),
        fc.ipV4(), // 生成随机 IPv4 地址
        fc.string({ minLength: 10, maxLength: 100 }), // 用户代理
        async (planId, adminId, ipAddress, userAgent) => {
          // 重置 mock
          jest.clearAllMocks();
          
          (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

          await productService.recordConfigChange({
            planId,
            changedBy: adminId,
            changeType: 'price',
            fieldName: 'price',
            oldValue: '100',
            newValue: '200',
            ipAddress,
            userAgent,
          });

          const params = (pool.query as jest.Mock).mock.calls[0][1];
          expect(params).toContain(ipAddress);
          expect(params).toContain(userAgent);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('应该保持历史记录的时间顺序', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 3, max: 10 }), // 变更次数
        async (planId, adminId, changeCount) => {
          const mockHistory: any[] = [];

          // 模拟多次变更
          for (let i = 0; i < changeCount; i++) {
            const record = {
              id: i + 1,
              plan_id: planId,
              changed_by: adminId,
              change_type: 'price',
              field_name: 'price',
              old_value: `${i * 100}`,
              new_value: `${(i + 1) * 100}`,
              created_at: new Date(Date.now() + i * 1000),
            };
            mockHistory.push(record);
          }

          // Mock 获取历史记录
          (pool.query as jest.Mock).mockResolvedValueOnce({
            rows: mockHistory.reverse(), // 按时间倒序
          });

          const history = await productService.getConfigHistory(planId, 50);

          // 验证历史记录按时间倒序排列
          for (let i = 0; i < history.length - 1; i++) {
            const current = new Date(history[i].created_at).getTime();
            const next = new Date(history[i + 1].created_at).getTime();
            expect(current).toBeGreaterThanOrEqual(next);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
