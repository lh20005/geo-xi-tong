import * as fc from 'fast-check';
import { orderService } from '../../services/OrderService';

/**
 * Feature: product-subscription-system, Property 10: 订单号唯一性
 * Validates: Requirements 3.1
 * 
 * 属性：对于任意数量的订单创建请求，生成的订单号必须唯一
 */
describe('Property Test: Order Number Uniqueness', () => {
  it('应该为所有订单生成唯一的订单号', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 100 }), // 生成10-100个订单
        (orderCount) => {
          const orderNumbers = new Set<string>();

          // 生成指定数量的订单号
          for (let i = 0; i < orderCount; i++) {
            const orderNo = orderService.generateOrderNo();
            
            // 检查订单号格式（ORD + 13位时间戳 + 8位随机数）
            expect(orderNo).toMatch(/^ORD\d{21}$/);
            
            // 检查唯一性
            expect(orderNumbers.has(orderNo)).toBe(false);
            
            orderNumbers.add(orderNo);
          }

          // 验证生成的订单号数量正确
          expect(orderNumbers.size).toBe(orderCount);
        }
      ),
      { numRuns: 100 } // 运行100次
    );
  });

  it('应该在并发场景下生成唯一的订单号', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 5, max: 20 }), // 并发数量
        async (concurrentCount) => {
          // 并发生成订单号
          const promises = Array.from({ length: concurrentCount }, () =>
            Promise.resolve(orderService.generateOrderNo())
          );

          const orderNumbers = await Promise.all(promises);
          const uniqueNumbers = new Set(orderNumbers);

          // 所有订单号应该唯一
          expect(uniqueNumbers.size).toBe(concurrentCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('应该在短时间内生成唯一的订单号', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          const orderNumbers = new Set<string>();
          const count = 50;

          // 快速连续生成订单号
          for (let i = 0; i < count; i++) {
            const orderNo = orderService.generateOrderNo();
            orderNumbers.add(orderNo);
          }

          // 8位随机数提供了100,000,000种可能，即使在短时间内也应该全部唯一
          expect(orderNumbers.size).toBe(count);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('应该生成符合格式的订单号', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          const orderNo = orderService.generateOrderNo();

          // 检查格式：ORD + 时间戳(13位) + 随机数(8位)
          expect(orderNo).toMatch(/^ORD\d{21}$/);
          
          // 检查前缀
          expect(orderNo.startsWith('ORD')).toBe(true);
          
          // 检查长度
          expect(orderNo.length).toBe(24); // ORD(3) + 时间戳(13) + 随机数(8)
        }
      ),
      { numRuns: 100 }
    );
  });
});
