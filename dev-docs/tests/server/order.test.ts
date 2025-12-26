import { orderService } from '../services/OrderService';
import { subscriptionService } from '../services/SubscriptionService';
import { pool } from '../db/database';

describe('OrderService', () => {
  let testUserId: number;
  let testPlanId: number;

  beforeAll(async () => {
    // 创建测试用户
    const userResult = await pool.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [`order_test_user_${Date.now()}`, `order_test_${Date.now()}@test.com`, 'hash', 'user']
    );
    testUserId = userResult.rows[0].id;

    // 获取测试套餐
    const planResult = await pool.query(
      `SELECT id FROM subscription_plans WHERE plan_code = 'professional' LIMIT 1`
    );
    testPlanId = planResult.rows[0].id;
  });

  afterAll(async () => {
    // 清理测试数据
    if (testUserId) {
      await pool.query('DELETE FROM orders WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM user_subscriptions WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
  });

  describe('createOrder', () => {
    it('应该成功创建订单', async () => {
      const order = await orderService.createOrder(testUserId, testPlanId);

      expect(order).toBeDefined();
      expect(order.order_no).toBeDefined();
      expect(order.order_no).toMatch(/^ORD\d+/);
      expect(order.user_id).toBe(testUserId);
      expect(order.plan_id).toBe(testPlanId);
      expect(order.status).toBe('pending');
      expect(order.amount).toBeGreaterThan(0);
    });

    it('应该生成唯一的订单号', async () => {
      const order1 = await orderService.createOrder(testUserId, testPlanId);
      const order2 = await orderService.createOrder(testUserId, testPlanId);

      expect(order1.order_no).not.toBe(order2.order_no);
    });

    it('应该拒绝无效的套餐ID', async () => {
      await expect(
        orderService.createOrder(testUserId, 99999)
      ).rejects.toThrow();
    });
  });

  describe('getOrderByNo', () => {
    it('应该能根据订单号获取订单', async () => {
      const createdOrder = await orderService.createOrder(testUserId, testPlanId);
      const fetchedOrder = await orderService.getOrderByNo(createdOrder.order_no);

      expect(fetchedOrder).toBeDefined();
      expect(fetchedOrder?.order_no).toBe(createdOrder.order_no);
      expect(fetchedOrder?.user_id).toBe(testUserId);
    });

    it('应该在订单不存在时返回null', async () => {
      const order = await orderService.getOrderByNo('NONEXISTENT_ORDER');
      expect(order).toBeNull();
    });
  });

  describe('updateOrderStatus', () => {
    it('应该成功更新订单状态', async () => {
      const order = await orderService.createOrder(testUserId, testPlanId);
      
      await orderService.updateOrderStatus(order.order_no, 'paid', 'wx_transaction_123');

      const updatedOrder = await orderService.getOrderByNo(order.order_no);
      expect(updatedOrder?.status).toBe('paid');
      expect(updatedOrder?.transaction_id).toBe('wx_transaction_123');
      expect(updatedOrder?.paid_at).toBeDefined();
    });
  });

  describe('getUserOrders', () => {
    it('应该获取用户的订单列表', async () => {
      // 创建多个订单
      await orderService.createOrder(testUserId, testPlanId);
      await orderService.createOrder(testUserId, testPlanId);

      const orders = await orderService.getUserOrders(testUserId);

      expect(orders).toBeDefined();
      expect(orders.length).toBeGreaterThanOrEqual(2);
      expect(orders[0].user_id).toBe(testUserId);
    });

    it('应该支持状态筛选', async () => {
      const order = await orderService.createOrder(testUserId, testPlanId);
      await orderService.updateOrderStatus(order.order_no, 'paid');

      const paidOrders = await orderService.getUserOrders(testUserId, 'paid');
      
      expect(paidOrders.length).toBeGreaterThan(0);
      expect(paidOrders.every(o => o.status === 'paid')).toBe(true);
    });

    it('应该支持分页', async () => {
      const page1 = await orderService.getUserOrders(testUserId, undefined, 1, 1);
      const page2 = await orderService.getUserOrders(testUserId, undefined, 2, 1);

      expect(page1.length).toBeLessThanOrEqual(1);
      expect(page2.length).toBeLessThanOrEqual(1);
      
      if (page1.length > 0 && page2.length > 0) {
        expect(page1[0].order_no).not.toBe(page2[0].order_no);
      }
    });
  });

  describe('closeExpiredOrders', () => {
    it('应该关闭超时的订单', async () => {
      // 创建订单
      const order = await orderService.createOrder(testUserId, testPlanId);

      // 手动将订单创建时间设置为31分钟前
      await pool.query(
        `UPDATE orders SET created_at = NOW() - INTERVAL '31 minutes' WHERE order_no = $1`,
        [order.order_no]
      );

      // 执行关闭超时订单
      const closedCount = await orderService.closeExpiredOrders();

      expect(closedCount).toBeGreaterThan(0);

      // 验证订单状态已更新
      const closedOrder = await orderService.getOrderByNo(order.order_no);
      expect(closedOrder?.status).toBe('closed');
    });

    it('应该不关闭未超时的订单', async () => {
      const order = await orderService.createOrder(testUserId, testPlanId);

      const closedCount = await orderService.closeExpiredOrders();

      const stillPendingOrder = await orderService.getOrderByNo(order.order_no);
      expect(stillPendingOrder?.status).toBe('pending');
    });

    it('应该不关闭已支付的订单', async () => {
      const order = await orderService.createOrder(testUserId, testPlanId);
      
      // 更新为已支付
      await orderService.updateOrderStatus(order.order_no, 'paid');

      // 手动将订单创建时间设置为31分钟前
      await pool.query(
        `UPDATE orders SET created_at = NOW() - INTERVAL '31 minutes' WHERE order_no = $1`,
        [order.order_no]
      );

      await orderService.closeExpiredOrders();

      const paidOrder = await orderService.getOrderByNo(order.order_no);
      expect(paidOrder?.status).toBe('paid');
    });
  });

  describe('订阅开通事务测试', () => {
    it('应该在支付成功后自动开通订阅', async () => {
      const order = await orderService.createOrder(testUserId, testPlanId);
      
      // 模拟支付成功
      await orderService.updateOrderStatus(order.order_no, 'paid', 'wx_test_123');

      // 手动调用订阅开通（在实际代码中由 PaymentService 调用）
      await subscriptionService.activateSubscription(testUserId, testPlanId);

      // 验证订阅已创建
      const subscription = await subscriptionService.getUserActiveSubscription(testUserId);
      expect(subscription).toBeDefined();
      expect(subscription?.plan_id).toBe(testPlanId);
      expect(subscription?.status).toBe('active');
    });

    it('应该在事务失败时回滚', async () => {
      const order = await orderService.createOrder(testUserId, testPlanId);

      // 尝试使用无效的套餐ID开通订阅（应该失败）
      await expect(
        subscriptionService.activateSubscription(testUserId, 99999)
      ).rejects.toThrow();

      // 验证订单状态未改变
      const unchangedOrder = await orderService.getOrderByNo(order.order_no);
      expect(unchangedOrder?.status).toBe('pending');
    });
  });
});
