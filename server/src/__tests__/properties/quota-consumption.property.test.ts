/**
 * Property-Based Tests for Quota Consumption Service
 * Feature: booster-pack-system
 * 
 * These tests verify that quota consumption properties hold across all operations.
 * 
 * Properties tested:
 * - Property 4: Consumption Priority (base first, then booster)
 * - Property 5: FIFO Consumption Order
 * - Property 6: Transaction Atomicity
 * - Property 7: Combined Quota Response Structure
 */

import * as fc from 'fast-check';
import { pool } from '../../db/database';
import { QuotaConsumptionService, quotaConsumptionService } from '../../services/QuotaConsumptionService';
import { boosterPackService } from '../../services/BoosterPackService';

describe('Quota Consumption Service Properties', () => {
  let testUserIds: number[] = [];
  let testPlanIds: number[] = [];
  let testSubscriptionIds: number[] = [];
  let tablesExist = false;

  beforeAll(async () => {
    // Check if required tables exist
    try {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'user_booster_quotas'
        ) as booster_quotas_exists,
        EXISTS (
          SELECT FROM pg_proc 
          WHERE proname = 'consume_quota_with_booster'
        ) as consume_func_exists,
        EXISTS (
          SELECT FROM pg_proc 
          WHERE proname = 'check_combined_quota'
        ) as check_func_exists
      `);
      
      tablesExist = result.rows[0].booster_quotas_exists && 
                    result.rows[0].consume_func_exists &&
                    result.rows[0].check_func_exists;
      
      if (!tablesExist) {
        console.warn('⚠️ Quota consumption tables/functions do not exist. Tests will be skipped.');
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

  /** Create test user with base subscription and quota */
  async function createTestUserWithQuota(
    suffix: string, 
    _baseLimit: number, 
    baseUsed: number
  ): Promise<number> {
    const random = Math.random().toString(36).substring(2, 10);
    const invCode = random.slice(0, 6).toUpperCase();
    
    // Create user
    const userResult = await pool.query(
      `INSERT INTO users (username, email, password_hash, role, invitation_code)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [`tqc_${suffix}_${random}`, `tqc_${suffix}_${random}@test.com`, 'hash', 'user', invCode]
    );
    const userId = userResult.rows[0].id;
    testUserIds.push(userId);

    // Create base subscription with plan that has the feature
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);
    
    // First check if plan 1 exists and has the feature
    const planCheck = await pool.query(
      `SELECT id FROM subscription_plans WHERE id = 1`
    );
    
    if (planCheck.rows.length === 0) {
      // Create a base plan if it doesn't exist
      await pool.query(
        `INSERT INTO subscription_plans (id, plan_code, plan_name, plan_type, price, billing_cycle, quota_cycle_type, duration_days, is_active, display_order)
         VALUES (1, 'free', '免费版', 'base', 0, 'monthly', 'monthly', 30, true, 1)
         ON CONFLICT (id) DO NOTHING`
      );
    }

    await pool.query(
      `INSERT INTO user_subscriptions (user_id, plan_id, plan_type, status, start_date, end_date)
       VALUES ($1, 1, 'base', 'active', CURRENT_TIMESTAMP, $2)`,
      [userId, endDate]
    );

    // Set up base quota in user_usage if baseUsed > 0
    if (baseUsed > 0) {
      await pool.query(
        `INSERT INTO user_usage (user_id, feature_code, usage_count, period_start, period_end)
         VALUES ($1, 'articles_per_month', $2, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days')
         ON CONFLICT (user_id, feature_code, period_start) DO UPDATE SET usage_count = $2`,
        [userId, baseUsed]
      );
    }

    return userId;
  }

  /** Create test booster pack and activate it */
  async function createAndActivateBooster(
    userId: number,
    suffix: string,
    quotaLimit: number
  ): Promise<number> {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    
    // Create booster plan
    const planResult = await pool.query(
      `INSERT INTO subscription_plans (
        plan_code, plan_name, plan_type, price, billing_cycle, 
        quota_cycle_type, duration_days, is_active, display_order
      ) VALUES ($1, $2, 'booster', 100, 'monthly', 'monthly', 30, true, 999)
      RETURNING id`,
      [`tqc_${suffix}_${random}`, `测试加量包_${suffix}`]
    );
    const planId = planResult.rows[0].id;
    testPlanIds.push(planId);

    // Add feature
    await pool.query(
      `INSERT INTO plan_features (plan_id, feature_code, feature_name, feature_value, feature_unit)
       VALUES ($1, 'articles_per_month', '文章生成', $2, '篇')`,
      [planId, quotaLimit]
    );

    // Create order
    const orderResult = await pool.query(
      `INSERT INTO orders (user_id, order_no, plan_id, amount, status)
       VALUES ($1, $2, $3, 100, 'paid')
       RETURNING id`,
      [userId, `TEST_QC_${timestamp}_${random}`, planId]
    );
    const orderId = orderResult.rows[0].id;

    // Activate booster
    const subscription = await boosterPackService.activateBoosterPack(userId, planId, orderId);
    testSubscriptionIds.push(subscription.id);

    return subscription.id;
  }

  // ============================================================
  // Property 4: Consumption Priority
  // Validates: Requirements 4.1, 4.2, 4.3
  // ============================================================
  describe('Property 4: Consumption Priority', () => {
    test('Property 4: Base quota is consumed first when available', async () => {
      if (!tablesExist) return;
      // Feature: booster-pack-system, Property 4: Consumption Priority
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 30 }),  // boosterLimit
          fc.integer({ min: 1, max: 3 }),    // consumeAmount
          async (boosterLimit, consumeAmount) => {
            const userId = await createTestUserWithQuota(`p4_${Date.now()}`, 0, 0);
            
            // Get the actual base quota limit from user's subscription
            const initialQuota = await quotaConsumptionService.checkCombinedQuota(userId, 'articles_per_month');
            const baseLimit = initialQuota.baseQuota.limit;
            
            // Only test when base has enough remaining
            if (baseLimit < consumeAmount) return true;

            await createAndActivateBooster(userId, `p4_${Date.now()}`, boosterLimit);

            // Check quota before consumption
            const beforeCheck = await quotaConsumptionService.checkCombinedQuota(userId, 'articles_per_month');
            expect(beforeCheck.baseQuota.remaining).toBe(baseLimit);
            expect(beforeCheck.boosterQuota.totalRemaining).toBe(boosterLimit);

            // Consume quota
            const result = await quotaConsumptionService.consumeQuota(userId, 'articles_per_month', consumeAmount);

            // Verify consumed from base
            expect(result.success).toBe(true);
            expect(result.consumedFrom).toBe('base');
            expect(result.baseQuotaRemaining).toBe(baseLimit - consumeAmount);
            expect(result.boosterQuotaRemaining).toBe(boosterLimit); // Booster unchanged

            return true;
          }
        ),
        { numRuns: 5, verbose: true }
      );
    }, 120000);

    test('Property 4: Booster quota is consumed when base is exhausted', async () => {
      if (!tablesExist) return;
      // Feature: booster-pack-system, Property 4: Consumption Priority - Booster Fallback
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 30 }),  // boosterLimit
          fc.integer({ min: 1, max: 5 }),    // consumeAmount
          async (boosterLimit, consumeAmount) => {
            // Create user first to get actual base limit
            const userId = await createTestUserWithQuota(`p4b_${Date.now()}`, 0, 0);
            
            // Get the actual base quota limit from user's subscription
            const initialQuota = await quotaConsumptionService.checkCombinedQuota(userId, 'articles_per_month');
            const baseLimit = initialQuota.baseQuota.limit;
            
            // Exhaust base quota
            await pool.query(
              `INSERT INTO user_usage (user_id, feature_code, usage_count, period_start, period_end)
               VALUES ($1, 'articles_per_month', $2, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days')
               ON CONFLICT (user_id, feature_code, period_start) DO UPDATE SET usage_count = $2`,
              [userId, baseLimit]
            );
            
            await createAndActivateBooster(userId, `p4b_${Date.now()}`, boosterLimit);

            // Check quota before consumption
            const beforeCheck = await quotaConsumptionService.checkCombinedQuota(userId, 'articles_per_month');
            expect(beforeCheck.baseQuota.remaining).toBe(0);
            expect(beforeCheck.boosterQuota.totalRemaining).toBe(boosterLimit);

            // Consume quota
            const result = await quotaConsumptionService.consumeQuota(userId, 'articles_per_month', consumeAmount);

            // Verify consumed from booster
            expect(result.success).toBe(true);
            expect(result.consumedFrom).toBe('booster');
            expect(result.baseQuotaRemaining).toBe(0);
            expect(result.boosterQuotaRemaining).toBe(boosterLimit - consumeAmount);

            return true;
          }
        ),
        { numRuns: 5, verbose: true }
      );
    }, 120000);
  });

  // ============================================================
  // Property 5: FIFO Consumption Order
  // Validates: Requirements 4.4, 4.5
  // ============================================================
  describe('Property 5: FIFO Consumption Order', () => {
    test('Property 5: Multiple boosters are consumed in FIFO order', async () => {
      if (!tablesExist) return;
      // Feature: booster-pack-system, Property 5: FIFO Consumption Order
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 15 }),  // firstBoosterLimit
          fc.integer({ min: 5, max: 15 }),  // secondBoosterLimit
          fc.integer({ min: 1, max: 3 }),   // consumeAmount
          async (firstBoosterLimit, secondBoosterLimit, consumeAmount) => {
            // Create user first to get actual base limit
            const userId = await createTestUserWithQuota(`p5_${Date.now()}`, 0, 0);
            
            // Get the actual base quota limit and exhaust it
            const initialQuota = await quotaConsumptionService.checkCombinedQuota(userId, 'articles_per_month');
            const baseLimit = initialQuota.baseQuota.limit;
            
            await pool.query(
              `INSERT INTO user_usage (user_id, feature_code, usage_count, period_start, period_end)
               VALUES ($1, 'articles_per_month', $2, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days')
               ON CONFLICT (user_id, feature_code, period_start) DO UPDATE SET usage_count = $2`,
              [userId, baseLimit]
            );
            
            // Create first booster (older)
            const firstSubId = await createAndActivateBooster(userId, `p5_first_${Date.now()}`, firstBoosterLimit);
            
            // Small delay to ensure different created_at
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Create second booster (newer)
            const secondSubId = await createAndActivateBooster(userId, `p5_second_${Date.now()}`, secondBoosterLimit);

            // Consume quota
            const result = await quotaConsumptionService.consumeQuota(userId, 'articles_per_month', consumeAmount);

            // Verify consumed from first (older) booster
            expect(result.success).toBe(true);
            expect(result.consumedFrom).toBe('booster');
            expect(result.boosterSubscriptionId).toBe(firstSubId);

            // Verify first booster was consumed
            const firstQuota = await pool.query(
              `SELECT quota_used FROM user_booster_quotas 
               WHERE booster_subscription_id = $1 AND feature_code = 'articles_per_month'`,
              [firstSubId]
            );
            expect(firstQuota.rows[0].quota_used).toBe(consumeAmount);

            // Verify second booster was not consumed
            const secondQuota = await pool.query(
              `SELECT quota_used FROM user_booster_quotas 
               WHERE booster_subscription_id = $1 AND feature_code = 'articles_per_month'`,
              [secondSubId]
            );
            expect(secondQuota.rows[0].quota_used).toBe(0);

            return true;
          }
        ),
        { numRuns: 5, verbose: true }
      );
    }, 120000);
  });

  // ============================================================
  // Property 6: Transaction Atomicity
  // Validates: Requirements 4.6
  // ============================================================
  describe('Property 6: Transaction Atomicity', () => {
    test('Property 6: Failed consumption leaves quotas unchanged', async () => {
      if (!tablesExist) return;
      // Feature: booster-pack-system, Property 6: Transaction Atomicity
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 10 }),   // boosterLimit
          async (boosterLimit) => {
            // Create user first to get actual base limit
            const userId = await createTestUserWithQuota(`p6_${Date.now()}`, 0, 0);
            
            // Get the actual base quota limit and exhaust it
            const initialQuota = await quotaConsumptionService.checkCombinedQuota(userId, 'articles_per_month');
            const baseLimit = initialQuota.baseQuota.limit;
            
            await pool.query(
              `INSERT INTO user_usage (user_id, feature_code, usage_count, period_start, period_end)
               VALUES ($1, 'articles_per_month', $2, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days')
               ON CONFLICT (user_id, feature_code, period_start) DO UPDATE SET usage_count = $2`,
              [userId, baseLimit]
            );
            
            await createAndActivateBooster(userId, `p6_${Date.now()}`, boosterLimit);

            // Get initial state
            const beforeCheck = await quotaConsumptionService.checkCombinedQuota(userId, 'articles_per_month');
            const totalBefore = beforeCheck.combinedRemaining;

            // Try to consume more than available
            const excessAmount = totalBefore + 10;
            const result = await quotaConsumptionService.consumeQuota(userId, 'articles_per_month', excessAmount);

            // Verify failure
            expect(result.success).toBe(false);

            // Verify quotas unchanged
            const afterCheck = await quotaConsumptionService.checkCombinedQuota(userId, 'articles_per_month');
            expect(afterCheck.combinedRemaining).toBe(totalBefore);
            expect(afterCheck.baseQuota.remaining).toBe(beforeCheck.baseQuota.remaining);
            expect(afterCheck.boosterQuota.totalRemaining).toBe(beforeCheck.boosterQuota.totalRemaining);

            return true;
          }
        ),
        { numRuns: 5, verbose: true }
      );
    }, 120000);
  });

  // ============================================================
  // Property 7: Combined Quota Response Structure
  // Validates: Requirements 5.2, 5.3
  // ============================================================
  describe('Property 7: Combined Quota Response Structure', () => {
    test('Property 7: Combined quota response contains all required fields', async () => {
      if (!tablesExist) return;
      // Feature: booster-pack-system, Property 7: Combined Quota Response Structure
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 50 }),  // boosterLimit
          async (boosterLimit) => {
            const userId = await createTestUserWithQuota(`p7_${Date.now()}`, 0, 0);
            
            // Get the actual base quota limit
            const initialQuota = await quotaConsumptionService.checkCombinedQuota(userId, 'articles_per_month');
            const baseLimit = initialQuota.baseQuota.limit;
            
            // Set some base usage
            const baseUsed = Math.min(5, baseLimit);
            await pool.query(
              `INSERT INTO user_usage (user_id, feature_code, usage_count, period_start, period_end)
               VALUES ($1, 'articles_per_month', $2, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days')
               ON CONFLICT (user_id, feature_code, period_start) DO UPDATE SET usage_count = $2`,
              [userId, baseUsed]
            );
            
            await createAndActivateBooster(userId, `p7_${Date.now()}`, boosterLimit);

            const result = await quotaConsumptionService.checkCombinedQuota(userId, 'articles_per_month');

            // Verify structure
            expect(result).toHaveProperty('hasQuota');
            expect(result).toHaveProperty('baseQuota');
            expect(result).toHaveProperty('boosterQuota');
            expect(result).toHaveProperty('combinedRemaining');

            // Verify baseQuota structure
            expect(result.baseQuota).toHaveProperty('limit');
            expect(result.baseQuota).toHaveProperty('used');
            expect(result.baseQuota).toHaveProperty('remaining');

            // Verify boosterQuota structure
            expect(result.boosterQuota).toHaveProperty('totalLimit');
            expect(result.boosterQuota).toHaveProperty('totalUsed');
            expect(result.boosterQuota).toHaveProperty('totalRemaining');

            // Verify values are correct
            expect(result.baseQuota.limit).toBe(baseLimit);
            expect(result.baseQuota.used).toBe(baseUsed);
            expect(result.baseQuota.remaining).toBe(baseLimit - baseUsed);
            expect(result.boosterQuota.totalLimit).toBe(boosterLimit);
            expect(result.boosterQuota.totalUsed).toBe(0);
            expect(result.boosterQuota.totalRemaining).toBe(boosterLimit);
            expect(result.combinedRemaining).toBe((baseLimit - baseUsed) + boosterLimit);

            // Verify hasQuota is correct
            expect(result.hasQuota).toBe(result.combinedRemaining > 0);

            return true;
          }
        ),
        { numRuns: 5, verbose: true }
      );
    }, 120000);
  });
});
