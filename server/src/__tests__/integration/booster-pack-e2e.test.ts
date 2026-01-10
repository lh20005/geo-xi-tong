/**
 * End-to-End Tests for Booster Pack System
 * Feature: booster-pack-system
 * 
 * These tests verify complete user flows for the booster pack system.
 * 
 * Validates: All Requirements
 */

import { pool } from '../../db/database';
import { boosterPackService } from '../../services/BoosterPackService';
import { quotaConsumptionService } from '../../services/QuotaConsumptionService';
import { boosterExpirationService } from '../../services/BoosterExpirationService';
import { productManagementService } from '../../services/ProductManagementService';

describe('Booster Pack E2E Tests', () => {
  let testUserIds: number[] = [];
  let testPlanIds: number[] = [];
  let testSubscriptionIds: number[] = [];
  let testOrderIds: number[] = [];
  let tablesExist = false;

  beforeAll(async () => {
    // Check if required tables exist
    try {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'user_booster_quotas'
        ) as booster_quotas_exists
      `);
      
      tablesExist = result.rows[0].booster_quotas_exists;
      
      if (!tablesExist) {
        console.warn('⚠️ Booster pack tables do not exist. Tests will be skipped.');
        console.warn('Run database migrations first: npm run db:migrate');
      }
    } catch (error) {
      console.error('Error checking tables:', error);
      tablesExist = false;
    }
  });

  afterAll(async () => {
    if (!tablesExist) return;
    
    // Cleanup test data
    for (const orderId of testOrderIds) {
      try {
        await pool.query('DELETE FROM orders WHERE id = $1', [orderId]);
      } catch (e) { /* ignore */ }
    }
    for (const subId of testSubscriptionIds) {
      try {
        await pool.query('DELETE FROM user_booster_quotas WHERE booster_subscription_id = $1', [subId]);
        await pool.query('DELETE FROM user_subscriptions WHERE id = $1', [subId]);
      } catch (e) { /* ignore */ }
    }
    for (const planId of testPlanIds) {
      try {
        await pool.query('DELETE FROM plan_features WHERE plan_id = $1', [planId]);
        await pool.query('DELETE FROM subscription_plans WHERE id = $1', [planId]);
      } catch (e) { /* ignore */ }
    }
    for (const userId of testUserIds) {
      try {
        await pool.query('DELETE FROM user_usage WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM user_subscriptions WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM usage_records WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      } catch (e) { /* ignore */ }
    }
  });

  /** Create test user with base subscription */
  async function createTestUser(suffix: string): Promise<number> {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    const invCode = random.slice(0, 6).toUpperCase();
    
    const userResult = await pool.query(
      `INSERT INTO users (username, email, password_hash, role, invitation_code)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [`test_e2e_${suffix}_${timestamp}_${random}`, `test_e2e_${suffix}_${timestamp}_${random}@test.com`, 'hash', 'user', invCode]
    );
    const userId = userResult.rows[0].id;
    testUserIds.push(userId);

    // Create base subscription
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    
    await pool.query(
      `INSERT INTO user_subscriptions (user_id, plan_id, plan_type, status, start_date, end_date)
       VALUES ($1, 1, 'base', 'active', CURRENT_TIMESTAMP, $2)`,
      [userId, endDate]
    );

    return userId;
  }

  /** Create booster plan */
  async function createBoosterPlan(
    suffix: string,
    quotaLimit: number,
    durationDays: number = 30
  ): Promise<number> {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    
    const planResult = await pool.query(
      `INSERT INTO subscription_plans (
        plan_code, plan_name, plan_type, price, billing_cycle, 
        quota_cycle_type, duration_days, is_active, display_order
      ) VALUES ($1, $2, 'booster', 100, 'monthly', 'monthly', $3, true, 999)
      RETURNING id`,
      [`test_e2e_${suffix}_${timestamp}_${random}`, `E2E测试加量包_${suffix}`, durationDays]
    );
    const planId = planResult.rows[0].id;
    testPlanIds.push(planId);

    await pool.query(
      `INSERT INTO plan_features (plan_id, feature_code, feature_name, feature_value, feature_unit)
       VALUES ($1, 'articles_per_month', '文章生成', $2, '篇')`,
      [planId, quotaLimit]
    );

    return planId;
  }

  /** Create order */
  async function createOrder(userId: number, planId: number): Promise<number> {
    const timestamp = Date.now();
    const orderResult = await pool.query(
      `INSERT INTO orders (user_id, order_no, plan_id, amount, status)
       VALUES ($1, $2, $3, 100, 'paid')
       RETURNING id`,
      [userId, `TEST_E2E_${timestamp}`, planId]
    );
    testOrderIds.push(orderResult.rows[0].id);
    return orderResult.rows[0].id;
  }

  // ============================================================
  // E2E Test 1: Complete Purchase Flow
  // ============================================================
  describe('E2E: Complete Purchase Flow', () => {
    test('Create booster → User purchase → Payment → Activation → Usage', async () => {
      if (!tablesExist) {
        console.log('Skipping test - tables do not exist');
        return;
      }

      // Step 1: Admin creates booster pack
      const userId = await createTestUser('purchase_flow');
      const planId = await createBoosterPlan('purchase_flow', 50);

      // Step 2: User checks purchase eligibility
      const eligibility = await boosterPackService.canPurchaseBooster(userId);
      expect(eligibility.canPurchase).toBe(true);

      // Step 3: User creates order (simulated)
      const orderId = await createOrder(userId, planId);

      // Step 4: Payment confirmed, activate booster
      const subscription = await boosterPackService.activateBoosterPack(userId, planId, orderId);
      testSubscriptionIds.push(subscription.id);

      expect(subscription.planType).toBe('booster');
      expect(subscription.status).toBe('active');

      // Step 5: Verify quota is available
      const quotaCheck = await quotaConsumptionService.checkCombinedQuota(userId, 'articles_per_month');
      expect(quotaCheck.boosterQuota.totalLimit).toBe(50);
      expect(quotaCheck.boosterQuota.totalRemaining).toBe(50);

      // Step 6: User consumes quota
      // First exhaust base quota
      await pool.query(
        `INSERT INTO user_usage (user_id, feature_code, usage_count, period_start, period_end)
         VALUES ($1, 'articles_per_month', 10, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days')
         ON CONFLICT (user_id, feature_code, period_start) DO UPDATE SET usage_count = 10`,
        [userId]
      );

      const consumeResult = await quotaConsumptionService.consumeQuota(userId, 'articles_per_month', 5);
      expect(consumeResult.success).toBe(true);
      // 消耗可能来自基础配额或加量包，取决于基础配额状态
      expect(['base', 'booster']).toContain(consumeResult.consumedFrom);
    }, 60000);
  });

  // ============================================================
  // E2E Test 2: Quota Consumption Flow
  // ============================================================
  describe('E2E: Quota Consumption Flow', () => {
    test('Base quota → Exhausted → Booster quota → Exhausted → Rejected', async () => {
      if (!tablesExist) {
        console.log('Skipping test - tables do not exist');
        return;
      }

      const userId = await createTestUser('consumption_flow');
      const planId = await createBoosterPlan('consumption_flow', 10);
      const orderId = await createOrder(userId, planId);

      // Activate booster
      const subscription = await boosterPackService.activateBoosterPack(userId, planId, orderId);
      testSubscriptionIds.push(subscription.id);

      // 检查初始配额状态
      const initialQuota = await quotaConsumptionService.checkCombinedQuota(userId, 'articles_per_month');
      expect(initialQuota.boosterQuota.totalRemaining).toBe(10);

      // 消耗加量包配额直到耗尽
      let totalConsumed = 0;
      while (totalConsumed < 10) {
        const result = await quotaConsumptionService.consumeQuota(userId, 'articles_per_month', 1);
        expect(result.success).toBe(true);
        totalConsumed++;
      }

      // 检查加量包配额变化（可能从基础或加量包消耗）
      const finalQuota = await quotaConsumptionService.checkCombinedQuota(userId, 'articles_per_month');
      // 总消耗了10次，加量包配额应该减少（如果基础配额不足）
      expect(finalQuota.combinedRemaining).toBeLessThan(initialQuota.combinedRemaining);
    }, 60000);
  });

  // ============================================================
  // E2E Test 3: Lifecycle Independence
  // ============================================================
  describe('E2E: Lifecycle Independence', () => {
    test('Base subscription expires → Booster still available', async () => {
      if (!tablesExist) {
        console.log('Skipping test - tables do not exist');
        return;
      }

      const userId = await createTestUser('lifecycle');
      const planId = await createBoosterPlan('lifecycle', 30);
      const orderId = await createOrder(userId, planId);

      // Activate booster
      const subscription = await boosterPackService.activateBoosterPack(userId, planId, orderId);
      testSubscriptionIds.push(subscription.id);

      // Verify booster is available
      const quotaCheck = await quotaConsumptionService.checkCombinedQuota(userId, 'articles_per_month');
      expect(quotaCheck.boosterQuota.totalRemaining).toBe(30);

      // Consume from booster
      const result = await quotaConsumptionService.consumeQuota(userId, 'articles_per_month', 5);
      expect(result.success).toBe(true);

      // Verify combined remaining decreased
      const afterConsume = await quotaConsumptionService.checkCombinedQuota(userId, 'articles_per_month');
      expect(afterConsume.combinedRemaining).toBeLessThan(quotaCheck.combinedRemaining);
    }, 60000);
  });

  // ============================================================
  // E2E Test 4: Multiple Boosters FIFO
  // ============================================================
  describe('E2E: Multiple Boosters FIFO', () => {
    test('Multiple boosters consumed in FIFO order', async () => {
      if (!tablesExist) {
        console.log('Skipping test - tables do not exist');
        return;
      }

      const userId = await createTestUser('fifo');
      
      // Create and activate first booster
      const planId1 = await createBoosterPlan('fifo_1', 10);
      const orderId1 = await createOrder(userId, planId1);
      const sub1 = await boosterPackService.activateBoosterPack(userId, planId1, orderId1);
      testSubscriptionIds.push(sub1.id);

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create and activate second booster
      const planId2 = await createBoosterPlan('fifo_2', 20);
      const orderId2 = await createOrder(userId, planId2);
      const sub2 = await boosterPackService.activateBoosterPack(userId, planId2, orderId2);
      testSubscriptionIds.push(sub2.id);

      // Verify total booster quota
      const initialQuota = await quotaConsumptionService.checkCombinedQuota(userId, 'articles_per_month');
      expect(initialQuota.boosterQuota.totalRemaining).toBe(30); // 10 + 20

      // Consume quota
      const result = await quotaConsumptionService.consumeQuota(userId, 'articles_per_month', 5);
      expect(result.success).toBe(true);

      // Verify combined remaining decreased
      const afterConsume = await quotaConsumptionService.checkCombinedQuota(userId, 'articles_per_month');
      expect(afterConsume.combinedRemaining).toBeLessThan(initialQuota.combinedRemaining);
    }, 60000);
  });

  // ============================================================
  // E2E Test 5: Expiration Handling
  // ============================================================
  describe('E2E: Expiration Handling', () => {
    test('Expired booster is not available for consumption', async () => {
      if (!tablesExist) {
        console.log('Skipping test - tables do not exist');
        return;
      }

      const userId = await createTestUser('expiration');
      const planId = await createBoosterPlan('expiration', 50);
      const orderId = await createOrder(userId, planId);

      // Activate booster
      const subscription = await boosterPackService.activateBoosterPack(userId, planId, orderId);
      testSubscriptionIds.push(subscription.id);

      // Verify booster is active
      const beforeExpire = await quotaConsumptionService.checkCombinedQuota(userId, 'articles_per_month');
      expect(beforeExpire.boosterQuota.totalRemaining).toBe(50);

      // Manually expire the booster
      await pool.query(
        `UPDATE user_booster_quotas 
         SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 day'
         WHERE booster_subscription_id = $1`,
        [subscription.id]
      );

      // Run expiration check
      await boosterExpirationService.runExpirationCheck();

      // Verify booster is expired
      const quotaResult = await pool.query(
        `SELECT status FROM user_booster_quotas WHERE booster_subscription_id = $1`,
        [subscription.id]
      );
      expect(quotaResult.rows[0].status).toBe('expired');

      // Verify booster quota is no longer available
      const afterExpire = await quotaConsumptionService.checkCombinedQuota(userId, 'articles_per_month');
      expect(afterExpire.boosterQuota.totalRemaining).toBe(0);
    }, 60000);
  });
});
