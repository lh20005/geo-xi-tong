import { orderService } from '../services/OrderService';
import { pool } from '../db/database';

// Mock pool
jest.mock('../db/database', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

describe('OrderService - Admin Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllOrders', () => {
    it('应该获取所有订单', async () => {
      const mockOrders = [
        { id: 1, order_no: 'ORDER001', username: 'user1', plan_name: '专业版', amount: 99, status: 'paid' },
        { id: 2, order_no: 'ORDER002', username: 'user2', plan_name: '企业版', amount: 299, status: 'pending' },
      ];

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: 2 }] })
        .mockResolvedValueOnce({ rows: mockOrders });

      const result = await orderService.getAllOrders(1, 10);

      expect(result.orders).toEqual(mockOrders);
      expect(result.total).toBe(2);
    });

    it('应该支持状态筛选', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'paid' }] });

      await orderService.getAllOrders(1, 10, 'paid');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('o.status = $1'),
        expect.arrayContaining(['paid'])
      );
    });

    it('应该支持日期范围筛选', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await orderService.getAllOrders(1, 10, undefined, '2024-12-01', '2024-12-31');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('o.created_at >='),
        expect.arrayContaining(['2024-12-01', '2024-12-31'])
      );
    });
  });

  describe('getOrderStats', () => {
    it('应该返回订单统计数据', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ revenue: 500, count: 5 }] }) // 今日
        .mockResolvedValueOnce({ rows: [{ revenue: 2000, count: 20 }] }) // 本月
        .mockResolvedValueOnce({ rows: [{ count: 3 }] }); // 待支付

      const stats = await orderService.getOrderStats();

      expect(stats.todayRevenue).toBe(500);
      expect(stats.todayOrders).toBe(5);
      expect(stats.monthRevenue).toBe(2000);
      expect(stats.monthOrders).toBe(20);
      expect(stats.pendingOrders).toBe(3);
    });
  });

  describe('handleAbnormalOrder', () => {
    it('应该能够退款订单', async () => {
      const mockOrder = { id: 1, order_no: 'ORDER001', status: 'paid' };

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockOrder] }) // getOrderByNo
        .mockResolvedValueOnce({ rows: [] }) // 更新订单状态
        .mockResolvedValueOnce({ rows: [] }); // 记录日志

      await orderService.handleAbnormalOrder('ORDER001', 'refund', 1, '用户申请退款');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('status = \'refunded\''),
        ['ORDER001']
      );

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO admin_logs'),
        expect.arrayContaining([1, 'refund_order', 'order', 1])
      );
    });

    it('应该能够手动完成订单', async () => {
      const mockOrder = { id: 1, order_no: 'ORDER001', status: 'pending' };

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockOrder] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await orderService.handleAbnormalOrder('ORDER001', 'complete', 1, '线下支付');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('status = \'paid\''),
        ['ORDER001']
      );

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO admin_logs'),
        expect.arrayContaining([1, 'complete_order', 'order', 1])
      );
    });

    it('订单不存在时应该抛出错误', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(
        orderService.handleAbnormalOrder('INVALID', 'refund', 1)
      ).rejects.toThrow('订单不存在');
    });
  });
});
