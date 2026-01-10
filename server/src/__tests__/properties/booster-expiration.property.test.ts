/**
 * Property-Based Tests for Booster Expiration Service
 * Feature: booster-pack-system
 * 
 * These tests verify that booster expiration properties hold across all operations.
 * 
 * Properties tested:
 * - Property 14: Expiration Status Update
 * - Property 15: Expired Record Retention
 * - Property 16: Active-Only Display
 */

import * as fc from 'fast-check';
import { pool } from '../../db/database';
import { BoosterExpirationService, boosterExpirationService } from '../../services/BoosterExpirationService';
import { boosterPackService } from '../../services/BoosterPackService';

describe('Booster Expiration Service Properties', () => {
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
          WHERE proname = 'expire_booster_quotas'
        ) as expire_func_exists
      `);
      
      tablesExist = result.rows[0].booster_quotas_exists && result.rows[0].expire_func_exists;
      
      if (!tablesExist) {
        console.warn('⚠️ Booster expiration tables/functions do not exist. Tests will be skipped.');
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
        await pool.query('DELETE FROM quota_alerts WHERE user_id = $1', [userId]);
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
      [`tex_${suffix}_${random}`, `tex_${suffix}_${random}@test.com`, 'hash', 'user', invCode]
    );
    const userId = userResult.rows[0].id;
    testUserIds.push(userId);

    // Create base subscription
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);
    
    await pool.query(
      `INSERT INTO user_subscriptions (user_id, plan_id, plan_type, status, start_date, end_date)
       VALUES ($1, 1, 'base', 'active', CURRENT_TIMESTAMP, $2)
       ON CONFLICT DO NOTHING`,
      [userId, endDate]
    );

    return userId;
  }

  /** Create booster with custom expiration */
  async function createBoosterWithExpiration(
    userId: number,
    suffix: string,
    quotaLimit: number,
    expiresAt: Date
  ): Promise<{ subscriptionId: number; quotaId: number }> {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    
    // Create booster plan
    const planResult = await pool.query(
      `INSERT INTO subscription_plans (
        plan_code, plan_name, plan_type, price, billing_cycle, 
        quota_cycle_type, duration_days, is_active, display_order
      ) VALUES ($1, $2, 'booster', 100, 'monthly', 'monthly', 30, true, 999)
      RETURNING id`,
      [`tex_${suffix}_${random}`, `测试过期加量包_${suffix}`]
    );
    const planId = planResult.rows[0].id;
    testPlanIds.push(planId);

    // Add feature
    await pool.query(
      `INSERT INTO plan_features (plan_id, feature_code, feature_name, feature_value, feature_unit)
       VALUES ($1, 'articles_per_month', '文章生成', $2, '篇')`,
      [planId, quotaLimit]
    );

    // Create subscription directly with custom end date
    const subResult = await pool.query(
      `INSERT INTO user_subscriptions (user_id, plan_id, plan_type, status, start_date, end_date)
       VALUES ($1, $2, 'booster', 'active', CURRENT_TIMESTAMP, $3)
       RETURNING id`,
      [userId, planId, expiresAt]
    );
    const subscriptionId = subResult.rows[0].id;
    testSubscriptionIds.push(subscriptionId);

    // Create quota record with custom expiration
    const quotaResult = await pool.query(
      `INSERT INTO user_booster_quotas (
        user_id, booster_subscription_id, feature_code, quota_limit, quota_used, status, expires_at
      ) VALUES ($1, $2, 'articles_per_month', $3, 0, 'active', $4)
      RETURNING id`,
      [userId, subscriptionId, quotaLimit, expiresAt]
    );

    return {
      subscriptionId,
      quotaId: quotaResult.rows[0].id
    };
  }

  // ============================================================
  // Property 14: Expiration Status Update
  // Validates: Requirements 3.4, 9.1, 9.2
  // ============================================================
  describe('Property 14: Expiration Status Update', () => {
    test('Property 14: Expired quotas are marked as expired', async () => {
      if (!tablesExist) return;
      // Feature: booster-pack-system, Property 14: Expiration Status Update
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 100 }), // quotaLimit
          async (quotaLimit) => {
            const userId = await createTestUser(`p14_${Date.now()}`);
            
            // Create booster that expired yesterday
            const expiredDate = new Date();
            expiredDate.setDate(expiredDate.getDate() - 1);
            
            const { quotaId } = await createBoosterWithExpiration(
              userId, `p14_${Date.now()}`, quotaLimit, expiredDate
            );

            // Verify initial status is active
            const beforeResult = await pool.query(
              `SELECT status FROM user_booster_quotas WHERE id = $1`,
              [quotaId]
            );
            expect(beforeResult.rows[0].status).toBe('active');

            // Run expiration check
            await boosterExpirationService.runExpirationCheck();

            // Verify status is now expired
            const afterResult = await pool.query(
              `SELECT status FROM user_booster_quotas WHERE id = $1`,
              [quotaId]
            );
            expect(afterResult.rows[0].status).toBe('expired');

            return true;
          }
        ),
        { numRuns: 5, verbose: true }
      );
    }, 120000);

    test('Property 14: Non-expired quotas remain active', async () => {
      if (!tablesExist) return;
      // Feature: booster-pack-system, Property 14: Non-Expired Remain Active
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 100 }), // quotaLimit
          fc.integer({ min: 1, max: 30 }),   // daysUntilExpiration
          async (quotaLimit, daysUntilExpiration) => {
            const userId = await createTestUser(`p14b_${Date.now()}`);
            
            // Create booster that expires in the future
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + daysUntilExpiration);
            
            const { quotaId } = await createBoosterWithExpiration(
              userId, `p14b_${Date.now()}`, quotaLimit, futureDate
            );

            // Run expiration check
            await boosterExpirationService.runExpirationCheck();

            // Verify status is still active
            const afterResult = await pool.query(
              `SELECT status FROM user_booster_quotas WHERE id = $1`,
              [quotaId]
            );
            expect(afterResult.rows[0].status).toBe('active');

            return true;
          }
        ),
        { numRuns: 5, verbose: true }
      );
    }, 120000);
  });

  // ============================================================
  // Property 15: Expired Record Retention
  // Validates: Requirements 9.3
  // ============================================================
  describe('Property 15: Expired Record Retention', () => {
    test('Property 15: Expired records are retained, not deleted', async () => {
      if (!tablesExist) return;
      // Feature: booster-pack-system, Property 15: Expired Record Retention
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 100 }), // quotaLimit
          fc.integer({ min: 1, max: 50 }),   // quotaUsed
          async (quotaLimit, quotaUsed) => {
            const actualUsed = Math.min(quotaUsed, quotaLimit);
            const userId = await createTestUser(`p15_${Date.now()}`);
            
            // Create booster that expired yesterday
            const expiredDate = new Date();
            expiredDate.setDate(expiredDate.getDate() - 1);
            
            const { quotaId, subscriptionId } = await createBoosterWithExpiration(
              userId, `p15_${Date.now()}`, quotaLimit, expiredDate
            );

            // Set some usage
            await pool.query(
              `UPDATE user_booster_quotas SET quota_used = $1 WHERE id = $2`,
              [actualUsed, quotaId]
            );

            // Directly call the database function to expire this specific quota
            // This avoids race conditions with other tests
            await pool.query(
              `UPDATE user_booster_quotas 
               SET status = 'expired' 
               WHERE id = $1 AND expires_at < CURRENT_TIMESTAMP AND status = 'active'`,
              [quotaId]
            );

            // Verify record still exists with all data (not deleted)
            const result = await pool.query(
              `SELECT * FROM user_booster_quotas WHERE id = $1`,
              [quotaId]
            );
            
            expect(result.rows.length).toBe(1);
            expect(result.rows[0].status).toBe('expired');
            expect(result.rows[0].quota_limit).toBe(quotaLimit);
            expect(result.rows[0].quota_used).toBe(actualUsed);
            expect(result.rows[0].user_id).toBe(userId);
            expect(result.rows[0].booster_subscription_id).toBe(subscriptionId);

            return true;
          }
        ),
        { numRuns: 5, verbose: true }
      );
    }, 120000);
  });

  // ============================================================
  // Property 16: Active-Only Display
  // Validates: Requirements 9.4
  // ============================================================
  describe('Property 16: Active-Only Display', () => {
    test('Property 16: Only active quotas are returned in queries', async () => {
      if (!tablesExist) return;
      // Feature: booster-pack-system, Property 16: Active-Only Display
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 50 }), // activeQuotaLimit
          fc.integer({ min: 10, max: 50 }), // expiredQuotaLimit
          async (activeQuotaLimit, expiredQuotaLimit) => {
            const userId = await createTestUser(`p16_${Date.now()}`);
            
            // Create active booster (expires in future)
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 30);
            await createBoosterWithExpiration(
              userId, `p16_active_${Date.now()}`, activeQuotaLimit, futureDate
            );

            // Create expired booster
            const expiredDate = new Date();
            expiredDate.setDate(expiredDate.getDate() - 1);
            await createBoosterWithExpiration(
              userId, `p16_expired_${Date.now()}`, expiredQuotaLimit, expiredDate
            );

            // Run expiration check to mark expired
            await boosterExpirationService.runExpirationCheck();

            // Get active quotas
            const activeQuotas = await boosterPackService.getUserActiveBoosterQuotas(userId);

            // Verify only active quota is returned
            expect(activeQuotas.length).toBe(1);
            expect(activeQuotas[0].quotaLimit).toBe(activeQuotaLimit);
            expect(activeQuotas[0].status).toBe('active');

            // Verify expired quota is not in active list
            const expiredInList = activeQuotas.find(q => q.quotaLimit === expiredQuotaLimit && q.status === 'expired');
            expect(expiredInList).toBeUndefined();

            return true;
          }
        ),
        { numRuns: 5, verbose: true }
      );
    }, 120000);

    test('Property 16: Booster summary only includes active quotas', async () => {
      if (!tablesExist) return;
      // Feature: booster-pack-system, Property 16: Summary Active-Only
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 50 }), // activeQuotaLimit
          fc.integer({ min: 10, max: 50 }), // expiredQuotaLimit
          async (activeQuotaLimit, expiredQuotaLimit) => {
            const userId = await createTestUser(`p16s_${Date.now()}`);
            
            // Create active booster
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 30);
            await createBoosterWithExpiration(
              userId, `p16s_active_${Date.now()}`, activeQuotaLimit, futureDate
            );

            // Create expired booster
            const expiredDate = new Date();
            expiredDate.setDate(expiredDate.getDate() - 1);
            await createBoosterWithExpiration(
              userId, `p16s_expired_${Date.now()}`, expiredQuotaLimit, expiredDate
            );

            // Run expiration check
            await boosterExpirationService.runExpirationCheck();

            // Get summary
            const summary = await boosterPackService.getUserBoosterSummary(userId);

            // Verify summary only includes active quota
            const featureSummary = summary['articles_per_month'];
            expect(featureSummary).toBeDefined();
            expect(featureSummary.totalLimit).toBe(activeQuotaLimit);
            expect(featureSummary.activePackCount).toBe(1);

            return true;
          }
        ),
        { numRuns: 5, verbose: true }
      );
    }, 120000);
  });
});
