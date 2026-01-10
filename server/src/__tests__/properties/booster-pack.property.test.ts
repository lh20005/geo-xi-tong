/**
 * Property-Based Tests for Booster Pack System
 * Feature: booster-pack-system
 * 
 * These tests verify that booster pack properties hold across all operations.
 * 
 * Properties tested:
 * - Property 2: Purchase Eligibility
 * - Property 3: Quota Snapshot Immutability
 * - Property 10: Activation Record Creation
 * - Property 11: Expiration Calculation
 */

import * as fc from 'fast-check';
import { pool } from '../../db/database';
import { BoosterPackService, boosterPackService } from '../../services/BoosterPackService';

describe('Booster Pack Service Properties', () => {
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
          SELECT FROM information_schema.tables 
          WHERE table_name = 'subscription_plans'
        ) as plans_exists,
        EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'user_subscriptions'
        ) as subscriptions_exists
      `);
      
      tablesExist = result.rows[0].booster_quotas_exists && 
                    result.rows[0].plans_exists && 
                    result.rows[0].subscriptions_exists;
      
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
    
    // Cleanup test data in reverse order of dependencies
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
        await pool.query('DELETE FROM user_subscriptions WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM usage_records WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      } catch (e) { /* ignore */ }
    }
  });

  /** Create test user with optional base subscription */
  async function createTestUser(suffix: string, withBaseSubscription: boolean = true): Promise<number> {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    const invCode = random.slice(0, 6).toUpperCase();
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, role, invitation_code)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [`tb_${suffix}_${random}`, `tb_${suffix}_${random}@test.com`, 'hash', 'user', invCode]
    );
    const userId = result.rows[0].id;
    testUserIds.push(userId);

    if (withBaseSubscription) {
      // Create a base subscription (free plan)
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);
      
      await pool.query(
        `INSERT INTO user_subscriptions (user_id, plan_id, plan_type, status, start_date, end_date)
         VALUES ($1, 1, 'base', 'active', CURRENT_TIMESTAMP, $2)`,
        [userId, endDate]
      );
    }

    return userId;
  }

  /** Create test booster pack plan */
  async function createTestBoosterPlan(
    suffix: string, 
    durationDays: number,
    features: Array<{ featureCode: string; featureValue: number }>
  ): Promise<number> {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const result = await pool.query(
      `INSERT INTO subscription_plans (
        plan_code, plan_name, plan_type, price, billing_cycle, 
        quota_cycle_type, duration_days, is_active, display_order
      ) VALUES ($1, $2, 'booster', 100, 'monthly', 'monthly', $3, true, 999)
      RETURNING id`,
      [`tb_${suffix}_${random}`, `测试加量包_${suffix}`, durationDays]
    );
    const planId = result.rows[0].id;
    testPlanIds.push(planId);

    // Add features
    for (const feature of features) {
      await pool.query(
        `INSERT INTO plan_features (plan_id, feature_code, feature_name, feature_value, feature_unit)
         VALUES ($1, $2, $3, $4, '次')`,
        [planId, feature.featureCode, `${feature.featureCode}_name`, feature.featureValue]
      );
    }

    return planId;
  }

  // ============================================================
  // Property 2: Purchase Eligibility
  // Validates: Requirements 2.1, 2.3, 11.2, 11.4, 11.5
  // ============================================================
  describe('Property 2: Purchase Eligibility', () => {
    test('Property 2: Authenticated users with active subscription can purchase boosters', async () => {
      if (!tablesExist) return;
      // Feature: booster-pack-system, Property 2: Purchase Eligibility
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 20 }),
          async (suffix) => {
            // User with base subscription should be able to purchase
            const userWithSub = await createTestUser(`p2_with_${suffix}`, true);
            const resultWithSub = await boosterPackService.canPurchaseBooster(userWithSub);
            
            expect(resultWithSub.canPurchase).toBe(true);
            expect(resultWithSub.reason).toBeUndefined();
            
            return true;
          }
        ),
        { numRuns: 5, verbose: true }
      );
    }, 60000);

    test('Property 2: Unauthenticated users cannot purchase boosters', async () => {
      if (!tablesExist) return;
      // Feature: booster-pack-system, Property 2: Purchase Eligibility - Unauthenticated
      
      await fc.assert(
        fc.asyncProperty(
          fc.constant(undefined),
          async () => {
            const result = await boosterPackService.canPurchaseBooster(undefined);
            
            expect(result.canPurchase).toBe(false);
            expect(result.reason).toBe('NOT_AUTHENTICATED');
            
            return true;
          }
        ),
        { numRuns: 10, verbose: true }
      );
    }, 30000);

    test('Property 2: Users without active subscription cannot purchase boosters', async () => {
      if (!tablesExist) return;
      // Feature: booster-pack-system, Property 2: Purchase Eligibility - No Subscription
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 20 }),
          async (suffix) => {
            // User without base subscription should not be able to purchase
            const userWithoutSub = await createTestUser(`p2_without_${suffix}`, false);
            const resultWithoutSub = await boosterPackService.canPurchaseBooster(userWithoutSub);
            
            expect(resultWithoutSub.canPurchase).toBe(false);
            expect(resultWithoutSub.reason).toBe('NO_ACTIVE_SUBSCRIPTION');
            
            return true;
          }
        ),
        { numRuns: 5, verbose: true }
      );
    }, 60000);
  });

  // ============================================================
  // Property 3: Quota Snapshot Immutability
  // Validates: Requirements 3.2, 3.3
  // ============================================================
  describe('Property 3: Quota Snapshot Immutability', () => {
    test('Property 3: Quota values are snapshotted at purchase time', async () => {
      if (!tablesExist) return;
      // Feature: booster-pack-system, Property 3: Quota Snapshot Immutability
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 100 }), // initial quota value
          fc.integer({ min: 101, max: 200 }), // updated quota value
          async (initialValue, updatedValue) => {
            const userId = await createTestUser(`p3_${Date.now()}`, true);
            const planId = await createTestBoosterPlan(`p3_${Date.now()}`, 30, [
              { featureCode: 'articles_per_month', featureValue: initialValue }
            ]);

            // Create a mock order
            const orderResult = await pool.query(
              `INSERT INTO orders (user_id, order_no, plan_id, amount, status)
               VALUES ($1, $2, $3, 100, 'paid')
               RETURNING id`,
              [userId, `TEST_P3_${Date.now()}`, planId]
            );
            const orderId = orderResult.rows[0].id;

            // Activate booster pack
            const subscription = await boosterPackService.activateBoosterPack(userId, planId, orderId);
            testSubscriptionIds.push(subscription.id);

            // Get the quota record
            const quotaResult = await pool.query(
              `SELECT quota_limit FROM user_booster_quotas 
               WHERE booster_subscription_id = $1 AND feature_code = 'articles_per_month'`,
              [subscription.id]
            );
            const snapshotValue = quotaResult.rows[0].quota_limit;

            // Update the plan feature value
            await pool.query(
              `UPDATE plan_features SET feature_value = $1 
               WHERE plan_id = $2 AND feature_code = 'articles_per_month'`,
              [updatedValue, planId]
            );

            // Verify the quota record still has the original value
            const quotaAfterUpdate = await pool.query(
              `SELECT quota_limit FROM user_booster_quotas 
               WHERE booster_subscription_id = $1 AND feature_code = 'articles_per_month'`,
              [subscription.id]
            );

            expect(snapshotValue).toBe(initialValue);
            expect(quotaAfterUpdate.rows[0].quota_limit).toBe(initialValue);
            expect(quotaAfterUpdate.rows[0].quota_limit).not.toBe(updatedValue);

            return true;
          }
        ),
        { numRuns: 5, verbose: true }
      );
    }, 120000);
  });

  // ============================================================
  // Property 10: Activation Record Creation
  // Validates: Requirements 6.1, 6.2, 6.6
  // ============================================================
  describe('Property 10: Activation Record Creation', () => {
    test('Property 10: Activation creates subscription, quotas, and audit records', async () => {
      if (!tablesExist) return;
      // Feature: booster-pack-system, Property 10: Activation Record Creation
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              featureCode: fc.constantFrom('articles_per_month', 'publish_per_month', 'keyword_distillation'),
              featureValue: fc.integer({ min: 1, max: 100 })
            }),
            { minLength: 1, maxLength: 3 }
          ),
          async (features) => {
            // Deduplicate features by featureCode
            const uniqueFeatures = features.reduce((acc, f) => {
              if (!acc.find(x => x.featureCode === f.featureCode)) {
                acc.push(f);
              }
              return acc;
            }, [] as typeof features);

            const userId = await createTestUser(`p10_${Date.now()}`, true);
            const planId = await createTestBoosterPlan(`p10_${Date.now()}`, 30, uniqueFeatures);

            // Create a mock order
            const orderResult = await pool.query(
              `INSERT INTO orders (user_id, order_no, plan_id, amount, status)
               VALUES ($1, $2, $3, 100, 'paid')
               RETURNING id`,
              [userId, `TEST_P10_${Date.now()}`, planId]
            );
            const orderId = orderResult.rows[0].id;

            // Activate booster pack
            const subscription = await boosterPackService.activateBoosterPack(userId, planId, orderId);
            testSubscriptionIds.push(subscription.id);

            // Verify subscription record
            expect(subscription.planType).toBe('booster');
            expect(subscription.status).toBe('active');
            expect(subscription.userId).toBe(userId);
            expect(subscription.planId).toBe(planId);

            // Verify quota records
            const quotaResult = await pool.query(
              `SELECT * FROM user_booster_quotas WHERE booster_subscription_id = $1`,
              [subscription.id]
            );
            expect(quotaResult.rows.length).toBe(uniqueFeatures.length);

            for (const feature of uniqueFeatures) {
              const quotaRecord = quotaResult.rows.find(r => r.feature_code === feature.featureCode);
              expect(quotaRecord).toBeDefined();
              expect(quotaRecord.quota_limit).toBe(feature.featureValue);
              expect(quotaRecord.quota_used).toBe(0);
              expect(quotaRecord.status).toBe('active');
            }

            // Verify audit record
            const auditResult = await pool.query(
              `SELECT * FROM usage_records 
               WHERE user_id = $1 AND feature_code = 'booster_activation' AND source = 'booster'`,
              [userId]
            );
            expect(auditResult.rows.length).toBeGreaterThan(0);

            return true;
          }
        ),
        { numRuns: 5, verbose: true }
      );
    }, 120000);
  });

  // ============================================================
  // Property 11: Expiration Calculation
  // Validates: Requirements 6.3
  // ============================================================
  describe('Property 11: Expiration Calculation', () => {
    test('Property 11: Expiration date equals activation time + duration_days', async () => {
      if (!tablesExist) return;
      // Feature: booster-pack-system, Property 11: Expiration Calculation
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 365 }), // duration days
          async (durationDays) => {
            const userId = await createTestUser(`p11_${Date.now()}`, true);
            const planId = await createTestBoosterPlan(`p11_${Date.now()}`, durationDays, [
              { featureCode: 'articles_per_month', featureValue: 50 }
            ]);

            // Create a mock order
            const orderResult = await pool.query(
              `INSERT INTO orders (user_id, order_no, plan_id, amount, status)
               VALUES ($1, $2, $3, 100, 'paid')
               RETURNING id`,
              [userId, `TEST_P11_${Date.now()}`, planId]
            );
            const orderId = orderResult.rows[0].id;

            const beforeActivation = new Date();
            
            // Activate booster pack
            const subscription = await boosterPackService.activateBoosterPack(userId, planId, orderId);
            testSubscriptionIds.push(subscription.id);

            const afterActivation = new Date();

            // Get quota expiration
            const quotaResult = await pool.query(
              `SELECT expires_at FROM user_booster_quotas WHERE booster_subscription_id = $1 LIMIT 1`,
              [subscription.id]
            );
            const expiresAt = new Date(quotaResult.rows[0].expires_at);

            // Calculate expected expiration range
            const expectedMinExpiration = new Date(beforeActivation);
            expectedMinExpiration.setDate(expectedMinExpiration.getDate() + durationDays);
            expectedMinExpiration.setHours(23, 59, 59, 0);

            const expectedMaxExpiration = new Date(afterActivation);
            expectedMaxExpiration.setDate(expectedMaxExpiration.getDate() + durationDays);
            expectedMaxExpiration.setHours(23, 59, 59, 999);

            // Verify expiration is within expected range
            expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMinExpiration.getTime());
            expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMaxExpiration.getTime() + 1000);

            // Verify subscription end date matches
            expect(subscription.endDate.getTime()).toBeGreaterThanOrEqual(expectedMinExpiration.getTime());
            expect(subscription.endDate.getTime()).toBeLessThanOrEqual(expectedMaxExpiration.getTime() + 1000);

            return true;
          }
        ),
        { numRuns: 10, verbose: true }
      );
    }, 120000);
  });
});
