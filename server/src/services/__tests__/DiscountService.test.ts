import fc from 'fast-check';
import { DiscountService } from '../DiscountService';
import { pool } from '../../db/database';

// Mock database
jest.mock('../../db/database', () => ({
  pool: {
    query: jest.fn()
  }
}));

describe('DiscountService', () => {
  const discountService = new DiscountService();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Property 1: 折扣比例输入验证', () => {
    it('should accept valid discount rates (1-100)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (rate) => {
            const result = discountService.validateDiscountRate(rate);
            return result.valid === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject discount rates less than 1', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000, max: 0 }),
          (rate) => {
            const result = discountService.validateDiscountRate(rate);
            return result.valid === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject discount rates greater than 100', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 101, max: 1000 }),
          (rate) => {
            const result = discountService.validateDiscountRate(rate);
            return result.valid === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject non-integer discount rates', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1.1, max: 99.9, noNaN: true }),
          (rate) => {
            // 确保不是整数
            if (Number.isInteger(rate)) return true;
            const result = discountService.validateDiscountRate(rate);
            return result.valid === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4: 折扣价格计算准确性', () => {
    it('should calculate discounted price correctly', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 10000, noNaN: true }),
          fc.integer({ min: 1, max: 100 }),
          (originalPrice, discountRate) => {
            const discountedPrice = discountService.calculateDiscountedPrice(originalPrice, discountRate);
            
            // 计算期望值
            const expected = Math.max(0.01, Math.round(originalPrice * discountRate) / 100);
            
            // 允许浮点数精度误差
            return Math.abs(discountedPrice - expected) < 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return original price when discount rate is 100', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 10000, noNaN: true }),
          (originalPrice) => {
            const discountedPrice = discountService.calculateDiscountedPrice(originalPrice, 100);
            return discountedPrice === originalPrice;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never return less than 0.01', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.001, max: 0.1, noNaN: true }),
          fc.integer({ min: 1, max: 10 }),
          (originalPrice, discountRate) => {
            const discountedPrice = discountService.calculateDiscountedPrice(originalPrice, discountRate);
            return discountedPrice >= 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should throw error for invalid discount rates', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 100, noNaN: true }),
          fc.oneof(
            fc.integer({ min: -100, max: 0 }),
            fc.integer({ min: 101, max: 200 })
          ),
          (originalPrice, invalidRate) => {
            try {
              discountService.calculateDiscountedPrice(originalPrice, invalidRate);
              return false; // 应该抛出错误
            } catch (error) {
              return true;
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should round to 2 decimal places', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 10000, noNaN: true }),
          fc.integer({ min: 1, max: 99 }),
          (originalPrice, discountRate) => {
            const discountedPrice = discountService.calculateDiscountedPrice(originalPrice, discountRate);
            // 检查是否最多两位小数
            const decimalPlaces = (discountedPrice.toString().split('.')[1] || '').length;
            return decimalPlaces <= 2;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('折扣价格计算边界情况', () => {
    it('should handle 1% discount (rate = 1)', () => {
      const price = 100;
      const result = discountService.calculateDiscountedPrice(price, 1);
      expect(result).toBe(1); // 100 * 0.01 = 1
    });

    it('should handle 50% discount (rate = 50)', () => {
      const price = 100;
      const result = discountService.calculateDiscountedPrice(price, 50);
      expect(result).toBe(50); // 100 * 0.50 = 50
    });

    it('should handle 80% discount (rate = 80, 8折)', () => {
      const price = 100;
      const result = discountService.calculateDiscountedPrice(price, 80);
      expect(result).toBe(80); // 100 * 0.80 = 80
    });

    it('should handle very small prices', () => {
      const price = 0.01;
      const result = discountService.calculateDiscountedPrice(price, 50);
      expect(result).toBe(0.01); // 最小值保护
    });

    it('should handle large prices', () => {
      const price = 9999.99;
      const result = discountService.calculateDiscountedPrice(price, 80);
      expect(result).toBeCloseTo(7999.99, 2);
    });
  });

  describe('Property 3: 折扣资格判断', () => {
    it('should grant eligibility when user is invited by agent, first purchase, and not used discount', async () => {
      // Mock: user invited by agent, no paid orders, discount not used
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{ invited_by_agent: 123, first_purchase_discount_used: false }]
        })
        .mockResolvedValueOnce({
          rows: [{ count: '0' }] // No paid orders
        });

      const result = await discountService.checkDiscountEligibility(1);
      
      expect(result.eligible).toBe(true);
      expect(result.invitedByAgent).toBe(true);
      expect(result.isFirstPurchase).toBe(true);
      expect(result.discountUsed).toBe(false);
    });

    it('should deny eligibility when user is not invited by agent', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ invited_by_agent: null, first_purchase_discount_used: false }]
      });

      const result = await discountService.checkDiscountEligibility(1);
      
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('not_invited_by_agent');
      expect(result.invitedByAgent).toBe(false);
    });

    it('should deny eligibility when discount already used', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ invited_by_agent: 123, first_purchase_discount_used: true }]
      });

      const result = await discountService.checkDiscountEligibility(1);
      
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('discount_already_used');
      expect(result.discountUsed).toBe(true);
    });

    it('should deny eligibility when user has paid orders', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{ invited_by_agent: 123, first_purchase_discount_used: false }]
        })
        .mockResolvedValueOnce({
          rows: [{ count: '1' }] // Has paid orders
        });

      const result = await discountService.checkDiscountEligibility(1);
      
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('not_first_purchase');
      expect(result.isFirstPurchase).toBe(false);
    });
  });

  describe('Property 5: 订单折扣应用完整性', () => {
    it('should calculate complete order discount info for eligible user', async () => {
      const originalPrice = 299;
      const discountRate = 80;
      
      // Mock eligibility check
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{ invited_by_agent: 123, first_purchase_discount_used: false }]
        })
        .mockResolvedValueOnce({
          rows: [{ count: '0' }]
        })
        .mockResolvedValueOnce({
          rows: [{ discount_rate: discountRate }]
        });

      const result = await discountService.calculateOrderDiscount(1, 1, originalPrice);
      
      expect(result.originalPrice).toBe(originalPrice);
      expect(result.discountRate).toBe(discountRate);
      expect(result.isAgentDiscount).toBe(true);
      expect(result.finalPrice).toBe(discountService.calculateDiscountedPrice(originalPrice, discountRate));
      expect(result.savedAmount).toBeCloseTo(originalPrice - result.finalPrice, 2);
    });

    it('should return no discount for ineligible user', async () => {
      const originalPrice = 299;
      
      // Mock: user not invited by agent
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ invited_by_agent: null, first_purchase_discount_used: false }]
      });

      const result = await discountService.calculateOrderDiscount(1, 1, originalPrice);
      
      expect(result.originalPrice).toBe(originalPrice);
      expect(result.discountRate).toBe(100);
      expect(result.isAgentDiscount).toBe(false);
      expect(result.finalPrice).toBe(originalPrice);
      expect(result.savedAmount).toBe(0);
    });

    it('should return no discount when plan has no discount (rate = 100)', async () => {
      const originalPrice = 299;
      
      // Mock eligibility check - eligible user
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{ invited_by_agent: 123, first_purchase_discount_used: false }]
        })
        .mockResolvedValueOnce({
          rows: [{ count: '0' }]
        })
        .mockResolvedValueOnce({
          rows: [{ discount_rate: 100 }] // No discount
        });

      const result = await discountService.calculateOrderDiscount(1, 1, originalPrice);
      
      expect(result.isAgentDiscount).toBe(false);
      expect(result.finalPrice).toBe(originalPrice);
    });
  });

  describe('Property 6: 首次购买折扣状态管理', () => {
    it('should mark discount as used', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await discountService.markFirstPurchaseDiscountUsed(1);
      
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        [1]
      );
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('first_purchase_discount_used = TRUE'),
        expect.any(Array)
      );
    });
  });

  describe('Property 7: 折扣统计准确性', () => {
    it('should calculate discount statistics correctly', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          total_orders: '5',
          total_amount: '1000.00',
          total_saved: '200.00'
        }]
      });

      const stats = await discountService.getDiscountStatistics();
      
      expect(stats.totalDiscountOrders).toBe(5);
      expect(stats.totalDiscountAmount).toBe(1000);
      expect(stats.totalSavedAmount).toBe(200);
    });

    it('should handle empty statistics', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          total_orders: '0',
          total_amount: '0',
          total_saved: '0'
        }]
      });

      const stats = await discountService.getDiscountStatistics();
      
      expect(stats.totalDiscountOrders).toBe(0);
      expect(stats.totalDiscountAmount).toBe(0);
      expect(stats.totalSavedAmount).toBe(0);
    });
  });

  describe('Property 8: 代理商状态不影响用户折扣', () => {
    it('should grant eligibility even if agent is suspended (only checks invited_by_agent)', async () => {
      // The eligibility check only verifies invited_by_agent is not null
      // It does NOT check the agent's current status
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{ invited_by_agent: 123, first_purchase_discount_used: false }]
        })
        .mockResolvedValueOnce({
          rows: [{ count: '0' }]
        });

      const result = await discountService.checkDiscountEligibility(1);
      
      // User should still be eligible - agent status is not checked
      expect(result.eligible).toBe(true);
      expect(result.invitedByAgent).toBe(true);
    });
  });

  describe('Property 9: 折扣比例快照', () => {
    it('should use discount rate at order creation time', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.double({ min: 0.01, max: 10000, noNaN: true }),
          fc.integer({ min: 1, max: 99 }),
          async (originalPrice, discountRate) => {
            // Mock eligibility and plan discount
            (pool.query as jest.Mock)
              .mockResolvedValueOnce({
                rows: [{ invited_by_agent: 123, first_purchase_discount_used: false }]
              })
              .mockResolvedValueOnce({
                rows: [{ count: '0' }]
              })
              .mockResolvedValueOnce({
                rows: [{ discount_rate: discountRate }]
              });

            const result = await discountService.calculateOrderDiscount(1, 1, originalPrice);
            
            // The discount rate should be exactly what was queried
            return result.discountRate === discountRate;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('边界情况处理', () => {
    it('should treat NULL discount rate as 100 (no discount)', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ discount_rate: 100 }] // COALESCE returns 100 for NULL
      });

      const rate = await discountService.getPlanDiscountRate(1);
      expect(rate).toBe(100);
    });

    it('should return 100 for non-existent plan', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: []
      });

      const rate = await discountService.getPlanDiscountRate(999);
      expect(rate).toBe(100);
    });
  });
});
