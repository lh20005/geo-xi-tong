/**
 * Property-Based Tests for Booster Lifecycle Independence
 * Feature: booster-pack-system
 * 
 * These tests verify that booster pack lifecycle is independent from base subscription.
 * 
 * Properties tested:
 * - Property 12: Independent Lifecycle
 * - Property 13: Free Plan Booster Consumption
 */

import * as fc from 'fast-check';
import { pool } from '../../db/database';
import { boosterPackService } from '../../services/BoosterPackService';
import { quotaConsumptionService } from '../../services/QuotaConsumptionService';

describe('Booster Lifecycle Independence Properties', () => {
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
  async function createTestUser(suffix: string): Promise<{ userId: number; baseSubId: number }> {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    const invCode = random.slice(0, 6).toUpperCase();
    
    const userResult = await pool.query(
      `INSERT INTO users (username, email, password_hash, role, invitation_code)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [`tlc_${suffix}_${random}`, `tlc_${suffix}_${random}@test.com`, 'hash', 'user', invCode]
    );
    const userId = userResult.rows[0].id;
    testUserIds.push(userId);

    // Create base subscription (paid plan)
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    
    const subResult = await pool.query(
      `INSERT INTO user_subscriptions (user_id, plan_id, plan_type, status, start_date, end_date)
       VALUES ($1, 1, 'base', 'active', CURRENT_TIMESTAMP, $2)
       RETURNING id`,
      [userId, endDate]
    );

    return { userId, baseSubId: subResult.rows[0].id };
  }

  /** Create and activate booster pack */
  async function createAndActivateBooster(
    userId: number,
    suffix: string,
    quotaLimit: number,
    durationDays: number = 30
  ): Promise<{ subscriptionId: number; quotaId: number; expiresAt: Date }> {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    
    // Create booster plan
    const planResult = await pool.query(
      `INSERT INTO subscription_plans (
        plan_code, plan_name, plan_type, price, billing_cycle, 
        quota_cycle_type, duration_days, is_active, display_order
      ) VALUES ($1, $2, 'booster', 100, 'monthly', 'monthly', $3, true, 999)
      RETURNING id`,
      [`tlc_${suffix}_${random}`, `生命周期测试加量包_${suffix}`, durationDays]
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
      [userId, `TEST_LC_${timestamp}_${random}`, planId]
    );

    // Activate booster
    const subscription = await boosterPackService.activateBoosterPack(userId, planId, orderResult.rows[0].id);
    testSubscriptionIds.push(subscription.id);

    // Get quota details
    const quotaResult = await pool.query(
      `SELECT id, expires_at FROM user_booster_quotas 
       WHERE booster_subscription_id = $1 AND feature_code = 'articles_per_month'`,
      [subscription.id]
    );

    return {
      subscriptionId: subscription.id,
      quotaId: quotaResult.rows[0].id,
      expiresAt: quotaResult.rows[0].expires_at
    };
  }

  // ============================================================
  // Property 12: Independent Lifecycle
  // Validates: Requirements 10.1, 10.2, 10.4, 10.6, 10.7
  // ============================================================
  describe('Property 12: Independent Lifecycle', () => {
    test('Property 12: Base subscription expiration does not affect booster quotas', async () => {
      if (!tablesExist) return;
      // Feature: booster-pack-system, Property 12: Independent Lifecycle
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 20, max: 100 }), // boosterQuotaLimit
          async (boosterQuotaLimit) => {
            const { userId, baseSubId } = await createTestUser(`p12_${Date.now()}`);
            const { subscriptionId, quotaId, expiresAt } = await createAndActivateBooster(
              userId, `p12_${Date.now()}`, boosterQuotaLimit
            );

            // Record initial booster state
            const beforeResult = await pool.query(
              `SELECT quota_limit, quota_used, status, expires_at 
               FROM user_booster_quotas WHERE id = $1`,
              [quotaId]
            );
            const beforeState = beforeResult.rows[0];

            // Expire the base subscription
            await pool.query(
              `UPDATE user_subscriptions 
               SET status = 'expired', end_date = CURRENT_TIMESTAMP - INTERVAL '1 day'
               WHERE id = $1`,
              [baseSubId]
            );

            // Verify booster quota is unchanged
            const afterResult = await pool.query(
              `SELECT quota_limit, quota_used, status, expires_at 
               FROM user_booster_quotas WHERE id = $1`,
              [quotaId]
            );
            const afterState = afterResult.rows[0];

            expect(afterState.quota_limit).toBe(beforeState.quota_limit);
            expect(afterState.quota_used).toBe(beforeState.quota_used);
            expect(afterState.status).toBe(beforeState.status);
            expect(new Date(afterState.expires_at).getTime()).toBe(new Date(beforeState.expires_at).getTime());

            return true;
          }
        ),
        { numRuns: 5, verbose: true }
      );
    }, 120000);

    test('Property 12: Base subscription upgrade does not affect booster quotas', async () => {
      if (!tablesExist) return;
      // Feature: booster-pack-system, Property 12: Independent Lifecycle - Upgrade
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 20, max: 100 }), // boosterQuotaLimit
          async (boosterQuotaLimit) => {
            const { userId, baseSubId } = await createTestUser(`p12u_${Date.now()}`);
            const { quotaId } = await createAndActivateBooster(
              userId, `p12u_${Date.now()}`, boosterQuotaLimit
            );

            // Record initial booster state
            const beforeResult = await pool.query(
              `SELECT quota_limit, quota_used, status, expires_at 
               FROM user_booster_quotas WHERE id = $1`,
              [quotaId]
            );
            const beforeState = beforeResult.rows[0];

            // Simulate upgrade: replace base subscription with a new one
            await pool.query(
              `UPDATE user_subscriptions SET status = 'replaced' WHERE id = $1`,
              [baseSubId]
            );
            
            const newEndDate = new Date();
            newEndDate.setFullYear(newEndDate.getFullYear() + 1);
            await pool.query(
              `INSERT INTO user_subscriptions (user_id, plan_id, plan_type, status, start_date, end_date)
               VALUES ($1, 2, 'base', 'active', CURRENT_TIMESTAMP, $2)`,
              [userId, newEndDate]
            );

            // Verify booster quota is unchanged
            const afterResult = await pool.query(
              `SELECT quota_limit, quota_used, status, expires_at 
               FROM user_booster_quotas WHERE id = $1`,
              [quotaId]
            );
            const afterState = afterResult.rows[0];

            expect(afterState.quota_limit).toBe(beforeState.quota_limit);
            expect(afterState.quota_used).toBe(beforeState.quota_used);
            expect(afterState.status).toBe(beforeState.status);
            expect(new Date(afterState.expires_at).getTime()).toBe(new Date(beforeState.expires_at).getTime());

            return true;
          }
        ),
        { numRuns: 5, verbose: true }
      );
    }, 120000);

    test('Property 12: Base subscription renewal does not extend booster expiration', async () => {
      if (!tablesExist) return;
      // Feature: booster-pack-system, Property 12: Independent Lifecycle - Renewal
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 20, max: 100 }), // boosterQuotaLimit
          async (boosterQuotaLimit) => {
            const { userId, baseSubId } = await createTestUser(`p12r_${Date.now()}`);
            const { quotaId, expiresAt: originalExpiration } = await createAndActivateBooster(
              userId, `p12r_${Date.now()}`, boosterQuotaLimit
            );

            // Renew base subscription (extend end date)
            const newEndDate = new Date();
            newEndDate.setFullYear(newEndDate.getFullYear() + 2);
            await pool.query(
              `UPDATE user_subscriptions SET end_date = $1 WHERE id = $2`,
              [newEndDate, baseSubId]
            );

            // Verify booster expiration is unchanged
            const afterResult = await pool.query(
              `SELECT expires_at FROM user_booster_quotas WHERE id = $1`,
              [quotaId]
            );
            const afterExpiration = new Date(afterResult.rows[0].expires_at);

            expect(afterExpiration.getTime()).toBe(new Date(originalExpiration).getTime());

            return true;
          }
        ),
        { numRuns: 5, verbose: true }
      );
    }, 120000);
  });

  // ============================================================
  // Property 13: Free Plan Booster Consumption
  // Validates: Requirements 10.3, 10.5
  // ============================================================
  describe('Property 13: Free Plan Booster Consumption', () => {
    test('Property 13: User on free plan can consume booster quota after base exhausted', async () => {
      if (!tablesExist) return;
      // Feature: booster-pack-system, Property 13: Free Plan Booster Consumption
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 20, max: 50 }), // boosterQuotaLimit
          fc.integer({ min: 1, max: 5 }),   // consumeAmount
          async (boosterQuotaLimit, consumeAmount) => {
            const { userId, baseSubId } = await createTestUser(`p13_${Date.now()}`);
            
            // Create booster
            await createAndActivateBooster(userId, `p13_${Date.now()}`, boosterQuotaLimit);

            // Get the actual base quota limit from user's subscription
            const initialQuota = await quotaConsumptionService.checkCombinedQuota(userId, 'articles_per_month');
            const baseLimit = initialQuota.baseQuota.limit;

            // Set up exhausted base quota (use actual base limit)
            await pool.query(
              `INSERT INTO user_usage (user_id, feature_code, usage_count, period_start, period_end)
               VALUES ($1, 'articles_per_month', $2, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days')
               ON CONFLICT (user_id, feature_code, period_start) DO UPDATE SET usage_count = $2`,
              [userId, baseLimit]
            );

            // Expire base subscription to simulate downgrade to free plan
            await pool.query(
              `UPDATE user_subscriptions SET status = 'expired' WHERE id = $1`,
              [baseSubId]
            );

            // Create a new free plan subscription
            const freeEndDate = new Date();
            freeEndDate.setFullYear(freeEndDate.getFullYear() + 10);
            await pool.query(
              `INSERT INTO user_subscriptions (user_id, plan_id, plan_type, status, start_date, end_date)
               VALUES ($1, 1, 'base', 'active', CURRENT_TIMESTAMP, $2)`,
              [userId, freeEndDate]
            );

            // Check combined quota - should have booster quota available
            const quotaCheck = await quotaConsumptionService.checkCombinedQuota(userId, 'articles_per_month');
            expect(quotaCheck.baseQuota.remaining).toBe(0);
            expect(quotaCheck.boosterQuota.totalRemaining).toBe(boosterQuotaLimit);
            expect(quotaCheck.hasQuota).toBe(true);

            // Consume quota - should come from booster
            const consumeResult = await quotaConsumptionService.consumeQuota(userId, 'articles_per_month', consumeAmount);
            expect(consumeResult.success).toBe(true);
            expect(consumeResult.consumedFrom).toBe('booster');
            expect(consumeResult.boosterQuotaRemaining).toBe(boosterQuotaLimit - consumeAmount);

            return true;
          }
        ),
        { numRuns: 5, verbose: true }
      );
    }, 120000);

    test('Property 13: Booster quota display includes free plan base quota', async () => {
      if (!tablesExist) return;
      // Feature: booster-pack-system, Property 13: Free Plan Display
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 20, max: 50 }), // boosterQuotaLimit
          async (boosterQuotaLimit) => {
            const { userId } = await createTestUser(`p13d_${Date.now()}`);
            
            // Create booster
            await createAndActivateBooster(userId, `p13d_${Date.now()}`, boosterQuotaLimit);

            // Get the actual base quota limit from user's subscription
            const initialQuota = await quotaConsumptionService.checkCombinedQuota(userId, 'articles_per_month');
            const baseLimit = initialQuota.baseQuota.limit;

            // Set up some base quota usage
            const baseUsed = Math.min(5, baseLimit);
            await pool.query(
              `INSERT INTO user_usage (user_id, feature_code, usage_count, period_start, period_end)
               VALUES ($1, 'articles_per_month', $2, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days')
               ON CONFLICT (user_id, feature_code, period_start) DO UPDATE SET usage_count = $2`,
              [userId, baseUsed]
            );

            // Check combined quota
            const quotaCheck = await quotaConsumptionService.checkCombinedQuota(userId, 'articles_per_month');

            // Verify display includes both
            expect(quotaCheck.baseQuota.limit).toBe(baseLimit);
            expect(quotaCheck.baseQuota.used).toBe(baseUsed);
            expect(quotaCheck.baseQuota.remaining).toBe(baseLimit - baseUsed);
            expect(quotaCheck.boosterQuota.totalLimit).toBe(boosterQuotaLimit);
            expect(quotaCheck.combinedRemaining).toBe((baseLimit - baseUsed) + boosterQuotaLimit);

            return true;
          }
        ),
        { numRuns: 5, verbose: true }
      );
    }, 120000);
  });
});
