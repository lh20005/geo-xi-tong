import { schedulerService } from '../services/SchedulerService';
import { orderService } from '../services/OrderService';
import { subscriptionService } from '../services/SubscriptionService';
import { pool } from '../db/database';

describe('SchedulerService', () => {
  let testUserId: number;
  let testPlanId: number;

  beforeAll(async () => {
    // 创建测试用户
    const userResult = await pool.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [`scheduler_test_user_${Date.now()}`, `scheduler_test_${Date.now()}@test.com`, 'hash', 'user']
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
      await pool.query('DELETE FROM user_usage WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM orders WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM user_subscriptions WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
  });

  describe('订单超时关闭任务', () => {
    it('应该关闭超过30分钟的pending订单', async () => {
      // 创建订单
      const order = await orderService.createOrder(testUserId, testPlanId);

      // 手动将订单创建时间设置为31分钟前
      await pool.query(
        `UPDATE orders SET created_at = NOW() - INTERVAL '31 minutes' WHERE order_no = $1`,
        [order.order_no]
      );

      // 执行关闭任务
      const closedCount = await orderService.closeExpiredOrders();

      expect(closedCount).toBeGreaterThan(0);

      // 验证订单已关闭
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

  describe('每日配额重置任务', () => {
    it('应该重置每日配额（articles_per_day, publish_per_day）', async () => {
      // 先开通订阅
      await subscriptionService.activateSubscription(testUserId, testPlanId);

      // 记录使用量
      await subscriptionService.recordUsage(testUserId, 'articles_per_day', 5);
      await subscriptionService.recordUsage(testUserId, 'publish_per_day', 3);

      // 验证使用量已记录
      const usageBefore = await subscriptionService.getUserUsage(testUserId, 'articles_per_day');
      expect(usageBefore).toBe(5);

      // 手动将使用记录的period_start设置为昨天
      await pool.query(
        `UPDATE user_usage 
         SET period_start = CURRENT_DATE - INTERVAL '1 day'
         WHERE user_id = $1 AND feature_code IN ('articles_per_day', 'publish_per_day')`,
        [testUserId]
      );

      // 执行重置任务
      await pool.query(`
        DELETE FROM user_usage 
        WHERE feature_code IN ('articles_per_day', 'publish_per_day')
        AND period_start < CURRENT_DATE
      `);

      // 验证配额已重置
      const usageAfter = await subscriptionService.getUserUsage(testUserId, 'articles_per_day');
      expect(usageAfter).toBe(0);
    });

    it('应该不重置当天的配额', async () => {
      await subscriptionService.recordUsage(testUserId, 'articles_per_day', 3);

      const usageBefore = await subscriptionService.getUserUsage(testUserId, 'articles_per_day');

      // 执行重置任务（不应该删除当天的记录）
      await pool.query(`
        DELETE FROM user_usage 
        WHERE feature_code IN ('articles_per_day', 'publish_per_day')
        AND period_start < CURRENT_DATE
      `);

      const usageAfter = await subscriptionService.getUserUsage(testUserId, 'articles_per_day');
      expect(usageAfter).toBe(usageBefore);
    });
  });

  describe('每月配额重置任务', () => {
    it('应该重置每月配额（keyword_distillation）', async () => {
      // 记录使用量
      await subscriptionService.recordUsage(testUserId, 'keyword_distillation', 10);

      const usageBefore = await subscriptionService.getUserUsage(testUserId, 'keyword_distillation');
      expect(usageBefore).toBe(10);

      // 手动将使用记录的period_start设置为上个月
      await pool.query(
        `UPDATE user_usage 
         SET period_start = DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
         WHERE user_id = $1 AND feature_code = 'keyword_distillation'`,
        [testUserId]
      );

      // 执行重置任务
      await pool.query(`
        DELETE FROM user_usage 
        WHERE feature_code = 'keyword_distillation'
        AND period_start < DATE_TRUNC('month', CURRENT_DATE)
      `);

      // 验证配额已重置
      const usageAfter = await subscriptionService.getUserUsage(testUserId, 'keyword_distillation');
      expect(usageAfter).toBe(0);
    });

    it('应该不重置当月的配额', async () => {
      await subscriptionService.recordUsage(testUserId, 'keyword_distillation', 5);

      const usageBefore = await subscriptionService.getUserUsage(testUserId, 'keyword_distillation');

      // 执行重置任务（不应该删除当月的记录）
      await pool.query(`
        DELETE FROM user_usage 
        WHERE feature_code = 'keyword_distillation'
        AND period_start < DATE_TRUNC('month', CURRENT_DATE)
      `);

      const usageAfter = await subscriptionService.getUserUsage(testUserId, 'keyword_distillation');
      expect(usageAfter).toBe(usageBefore);
    });
  });

  describe('订阅到期检查任务', () => {
    it('应该检测即将到期的订阅（7天内）', async () => {
      // 创建一个即将到期的订阅
      const subscription = await subscriptionService.activateSubscription(testUserId, testPlanId);

      // 手动将到期时间设置为5天后
      await pool.query(
        `UPDATE user_subscriptions 
         SET end_date = CURRENT_DATE + INTERVAL '5 days'
         WHERE id = $1`,
        [subscription.id]
      );

      // 查询即将到期的订阅
      const expiringSubscriptions = await pool.query(`
        SELECT * FROM user_subscriptions
        WHERE status = 'active'
        AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
        AND auto_renew = false
      `);

      expect(expiringSubscriptions.rows.length).toBeGreaterThan(0);
      expect(expiringSubscriptions.rows.some(s => s.id === subscription.id)).toBe(true);
    });

    it('应该自动降级已到期的订阅', async () => {
      // 创建订阅
      const subscription = await subscriptionService.activateSubscription(testUserId, testPlanId);

      // 手动将到期时间设置为昨天
      await pool.query(
        `UPDATE user_subscriptions 
         SET end_date = CURRENT_DATE - INTERVAL '1 day'
         WHERE id = $1`,
        [subscription.id]
      );

      // 执行到期检查任务
      const expiredResult = await pool.query(`
        UPDATE user_subscriptions 
        SET status = 'expired', updated_at = CURRENT_TIMESTAMP
        WHERE status = 'active'
        AND end_date < CURRENT_DATE
        RETURNING id
      `);

      expect(expiredResult.rowCount).toBeGreaterThan(0);

      // 验证订阅已过期
      const expiredSub = await pool.query(
        'SELECT status FROM user_subscriptions WHERE id = $1',
        [subscription.id]
      );
      expect(expiredSub.rows[0].status).toBe('expired');
    });

    it('应该不影响未到期的订阅', async () => {
      // 创建订阅（默认1个月后到期）
      const subscription = await subscriptionService.activateSubscription(testUserId, testPlanId);

      // 执行到期检查任务
      await pool.query(`
        UPDATE user_subscriptions 
        SET status = 'expired', updated_at = CURRENT_TIMESTAMP
        WHERE status = 'active'
        AND end_date < CURRENT_DATE
      `);

      // 验证订阅仍然是active
      const activeSub = await pool.query(
        'SELECT status FROM user_subscriptions WHERE id = $1',
        [subscription.id]
      );
      expect(activeSub.rows[0].status).toBe('active');
    });

    it('应该不影响已开启自动续费的订阅', async () => {
      // 创建订阅并开启自动续费
      const subscription = await subscriptionService.activateSubscription(testUserId, testPlanId);
      await pool.query(
        'UPDATE user_subscriptions SET auto_renew = true WHERE id = $1',
        [subscription.id]
      );

      // 手动将到期时间设置为5天后
      await pool.query(
        `UPDATE user_subscriptions 
         SET end_date = CURRENT_DATE + INTERVAL '5 days'
         WHERE id = $1`,
        [subscription.id]
      );

      // 查询即将到期的订阅（不包括自动续费的）
      const expiringSubscriptions = await pool.query(`
        SELECT * FROM user_subscriptions
        WHERE status = 'active'
        AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
        AND auto_renew = false
      `);

      // 不应该包含这个订阅
      expect(expiringSubscriptions.rows.some(s => s.id === subscription.id)).toBe(false);
    });
  });

  describe('调度器生命周期', () => {
    it('应该能启动调度器', () => {
      expect(() => schedulerService.start()).not.toThrow();
    });

    it('应该能停止调度器', () => {
      expect(() => schedulerService.stop()).not.toThrow();
    });

    it('应该能重启调度器', () => {
      schedulerService.stop();
      expect(() => schedulerService.start()).not.toThrow();
      schedulerService.stop(); // 清理
    });
  });
});
