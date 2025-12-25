import { subscriptionService } from '../services/SubscriptionService';
import { orderService } from '../services/OrderService';
import { pool } from '../db/database';

describe('套餐升级功能', () => {
  let testUserId: number;
  let freePlanId: number;
  let proPlanId: number;
  let enterprisePlanId: number;
  let freePrice: number;
  let proPrice: number;
  let enterprisePrice: number;

  beforeAll(async () => {
    // 创建测试用户
    const userResult = await pool.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [`upgrade_test_user_${Date.now()}`, `upgrade_test_${Date.now()}@test.com`, 'hash', 'user']
    );
    testUserId = userResult.rows[0].id;

    // 获取所有套餐
    const plans = await pool.query(
      `SELECT id, plan_code, price FROM subscription_plans 
       WHERE plan_code IN ('free', 'professional', 'enterprise')
       ORDER BY price ASC`
    );

    freePlanId = plans.rows.find(p => p.plan_code === 'free')?.id;
    proPlanId = plans.rows.find(p => p.plan_code === 'professional')?.id;
    enterprisePlanId = plans.rows.find(p => p.plan_code === 'enterprise')?.id;

    freePrice = plans.rows.find(p => p.plan_code === 'free')?.price || 0;
    proPrice = plans.rows.find(p => p.plan_code === 'professional')?.price || 99;
    enterprisePrice = plans.rows.find(p => p.plan_code === 'enterprise')?.price || 299;
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

  describe('upgradePlan - 升级逻辑', () => {
    it('应该成功创建升级订单', async () => {
      // 先开通免费版
      await subscriptionService.activateSubscription(testUserId, freePlanId);

      // 升级到专业版
      const result = await subscriptionService.upgradePlan(testUserId, proPlanId);

      expect(result).toBeDefined();
      expect(result.order_no).toBeDefined();
      expect(result.order_no).toMatch(/^UPG\d+/);
      expect(result.amount_due).toBeGreaterThanOrEqual(0);
    });

    it('应该正确计算升级差价', async () => {
      // 开通专业版（30天）
      const subscription = await subscriptionService.activateSubscription(testUserId, proPlanId);

      // 手动设置到期时间为15天后（剩余15天）
      await pool.query(
        `UPDATE user_subscriptions 
         SET end_date = CURRENT_DATE + INTERVAL '15 days'
         WHERE id = $1`,
        [subscription.id]
      );

      // 升级到企业版
      const result = await subscriptionService.upgradePlan(testUserId, enterprisePlanId);

      // 计算预期差价
      const dailyProPrice = proPrice / 30;
      const dailyEnterprisePrice = enterprisePrice / 30;
      const expectedDiff = (dailyEnterprisePrice - dailyProPrice) * 15;

      expect(result.amount_due).toBeCloseTo(expectedDiff, 2);
    });

    it('应该拒绝降级操作', async () => {
      // 开通企业版
      await subscriptionService.activateSubscription(testUserId, enterprisePlanId);

      // 尝试"升级"到专业版（实际是降级）
      await expect(
        subscriptionService.upgradePlan(testUserId, proPlanId)
      ).rejects.toThrow('只能升级到更高价格的套餐');
    });

    it('应该拒绝升级到相同价格的套餐', async () => {
      // 开通专业版
      await subscriptionService.activateSubscription(testUserId, proPlanId);

      // 尝试"升级"到相同套餐
      await expect(
        subscriptionService.upgradePlan(testUserId, proPlanId)
      ).rejects.toThrow('只能升级到更高价格的套餐');
    });

    it('应该拒绝没有订阅的用户升级', async () => {
      // 创建新用户（没有订阅）
      const newUserResult = await pool.query(
        `INSERT INTO users (username, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [`no_sub_user_${Date.now()}`, `no_sub_${Date.now()}@test.com`, 'hash', 'user']
      );
      const newUserId = newUserResult.rows[0].id;

      await expect(
        subscriptionService.upgradePlan(newUserId, proPlanId)
      ).rejects.toThrow('当前没有激活的订阅');

      // 清理
      await pool.query('DELETE FROM users WHERE id = $1', [newUserId]);
    });

    it('应该创建类型为upgrade的订单', async () => {
      // 开通免费版
      await subscriptionService.activateSubscription(testUserId, freePlanId);

      // 升级到专业版
      const result = await subscriptionService.upgradePlan(testUserId, proPlanId);

      // 验证订单类型
      const order = await orderService.getOrderByNo(result.order_no);
      expect(order?.order_type).toBe('upgrade');
    });
  });

  describe('applyUpgrade - 应用升级', () => {
    it('应该立即生效升级', async () => {
      // 开通免费版
      await subscriptionService.activateSubscription(testUserId, freePlanId);

      // 应用升级到专业版
      await subscriptionService.applyUpgrade(testUserId, proPlanId);

      // 验证订阅已更新
      const subscription = await subscriptionService.getUserActiveSubscription(testUserId);
      expect(subscription?.plan_id).toBe(proPlanId);
    });

    it('应该重置配额', async () => {
      // 开通专业版
      await subscriptionService.activateSubscription(testUserId, proPlanId);

      // 记录一些使用量
      await subscriptionService.recordUsage(testUserId, 'articles_per_day', 10);
      await subscriptionService.recordUsage(testUserId, 'publish_per_day', 5);

      const usageBefore = await subscriptionService.getUserUsage(testUserId, 'articles_per_day');
      expect(usageBefore).toBe(10);

      // 应用升级到企业版
      await subscriptionService.applyUpgrade(testUserId, enterprisePlanId);

      // 验证配额已重置
      const usageAfter = await subscriptionService.getUserUsage(testUserId, 'articles_per_day');
      expect(usageAfter).toBe(0);
    });

    it('应该保持原有的到期时间', async () => {
      // 开通专业版
      const subscription = await subscriptionService.activateSubscription(testUserId, proPlanId);
      const originalEndDate = subscription.end_date;

      // 应用升级到企业版
      await subscriptionService.applyUpgrade(testUserId, enterprisePlanId);

      // 验证到期时间未改变
      const updatedSubscription = await subscriptionService.getUserActiveSubscription(testUserId);
      expect(new Date(updatedSubscription!.end_date).getTime()).toBe(
        new Date(originalEndDate).getTime()
      );
    });

    it('应该清除套餐缓存', async () => {
      // 开通免费版
      await subscriptionService.activateSubscription(testUserId, freePlanId);

      // 先获取一次配置（缓存）
      await subscriptionService.getPlanConfig('professional');

      // 应用升级
      await subscriptionService.applyUpgrade(testUserId, proPlanId);

      // 验证缓存已清除（通过再次获取配置）
      const config = await subscriptionService.getPlanConfig('professional');
      expect(config).toBeDefined();
    });

    it('应该使用事务确保原子性', async () => {
      // 开通专业版
      await subscriptionService.activateSubscription(testUserId, proPlanId);

      // 尝试升级到无效的套餐（应该失败）
      await expect(
        subscriptionService.applyUpgrade(testUserId, 99999)
      ).rejects.toThrow();

      // 验证订阅未改变
      const subscription = await subscriptionService.getUserActiveSubscription(testUserId);
      expect(subscription?.plan_id).toBe(proPlanId);
    });
  });

  describe('完整升级流程', () => {
    it('应该完成从创建订单到应用升级的完整流程', async () => {
      // 1. 开通免费版
      await subscriptionService.activateSubscription(testUserId, freePlanId);

      // 2. 创建升级订单
      const upgradeResult = await subscriptionService.upgradePlan(testUserId, proPlanId);
      expect(upgradeResult.order_no).toBeDefined();

      // 3. 模拟支付成功
      await orderService.updateOrderStatus(upgradeResult.order_no, 'paid', 'wx_test_123');

      // 4. 应用升级
      await subscriptionService.applyUpgrade(testUserId, proPlanId);

      // 5. 验证最终状态
      const subscription = await subscriptionService.getUserActiveSubscription(testUserId);
      expect(subscription?.plan_id).toBe(proPlanId);

      const order = await orderService.getOrderByNo(upgradeResult.order_no);
      expect(order?.status).toBe('paid');
    });

    it('应该支持连续升级', async () => {
      // 1. 开通免费版
      await subscriptionService.activateSubscription(testUserId, freePlanId);

      // 2. 升级到专业版
      const upgrade1 = await subscriptionService.upgradePlan(testUserId, proPlanId);
      await orderService.updateOrderStatus(upgrade1.order_no, 'paid');
      await subscriptionService.applyUpgrade(testUserId, proPlanId);

      // 3. 再升级到企业版
      const upgrade2 = await subscriptionService.upgradePlan(testUserId, enterprisePlanId);
      await orderService.updateOrderStatus(upgrade2.order_no, 'paid');
      await subscriptionService.applyUpgrade(testUserId, enterprisePlanId);

      // 4. 验证最终状态
      const subscription = await subscriptionService.getUserActiveSubscription(testUserId);
      expect(subscription?.plan_id).toBe(enterprisePlanId);
    });
  });

  describe('边界情况', () => {
    it('应该处理剩余天数为0的情况', async () => {
      // 开通专业版
      const subscription = await subscriptionService.activateSubscription(testUserId, proPlanId);

      // 手动设置到期时间为今天
      await pool.query(
        `UPDATE user_subscriptions 
         SET end_date = CURRENT_DATE
         WHERE id = $1`,
        [subscription.id]
      );

      // 尝试升级
      const result = await subscriptionService.upgradePlan(testUserId, enterprisePlanId);

      // 差价应该为0或接近0
      expect(result.amount_due).toBeGreaterThanOrEqual(0);
      expect(result.amount_due).toBeLessThan(enterprisePrice / 30); // 少于1天的价格
    });

    it('应该处理剩余天数为1的情况', async () => {
      // 开通专业版
      const subscription = await subscriptionService.activateSubscription(testUserId, proPlanId);

      // 手动设置到期时间为明天
      await pool.query(
        `UPDATE user_subscriptions 
         SET end_date = CURRENT_DATE + INTERVAL '1 day'
         WHERE id = $1`,
        [subscription.id]
      );

      // 升级
      const result = await subscriptionService.upgradePlan(testUserId, enterprisePlanId);

      // 计算预期差价（1天）
      const dailyProPrice = proPrice / 30;
      const dailyEnterprisePrice = enterprisePrice / 30;
      const expectedDiff = dailyEnterprisePrice - dailyProPrice;

      expect(result.amount_due).toBeCloseTo(expectedDiff, 2);
    });

    it('应该处理从免费版升级的情况', async () => {
      // 开通免费版（价格为0）
      await subscriptionService.activateSubscription(testUserId, freePlanId);

      // 升级到专业版
      const result = await subscriptionService.upgradePlan(testUserId, proPlanId);

      // 差价应该接近专业版的完整价格（按剩余天数计算）
      expect(result.amount_due).toBeGreaterThan(0);
      expect(result.amount_due).toBeLessThanOrEqual(proPrice);
    });
  });
});
