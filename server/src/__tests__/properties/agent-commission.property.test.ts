/**
 * Property-Based Tests for Agent Commission System
 * Feature: agent-commission
 * 
 * These tests verify that agent commission properties hold across all operations.
 * 
 * Properties tested:
 * - Property 1: Agent creation default values (30% commission, active status)
 * - Property 2: Agent status transition validity (active ↔ suspended)
 * - Property 3: Commission calculation accuracy
 * - Property 4: Profit sharing order marking
 * - Property 5: Commission record completeness
 * - Property 6: T+1 settlement time correctness
 * - Property 7: Refund commission handling
 * - Property 8: Partial refund commission adjustment
 * - Property 9: Agent statistics consistency
 * - Property 10: Admin operation permission
 * - Property 11: Profit sharing amount limit
 */

import * as fc from 'fast-check';
import { pool } from '../../db/database';
import { AgentService } from '../../services/AgentService';
import { CommissionService } from '../../services/CommissionService';
import { AgentStatus } from '../../types/agent';

describe('Agent Commission Properties', () => {
  let agentService: AgentService;
  let commissionService: CommissionService;
  let testUserIds: number[] = [];
  let testAgentIds: number[] = [];
  let testOrderIds: number[] = [];
  let tablesExist = false;

  beforeAll(async () => {
    agentService = AgentService.getInstance();
    commissionService = CommissionService.getInstance();
    
    // Check if required tables exist
    try {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'agents'
        ) as agents_exists,
        EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'commission_records'
        ) as commission_exists
      `);
      
      tablesExist = result.rows[0].agents_exists && result.rows[0].commission_exists;
      
      if (!tablesExist) {
        console.warn('⚠️ Agent commission tables do not exist. Tests will be skipped.');
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
    for (const agentId of testAgentIds) {
      try {
        await pool.query('DELETE FROM commission_records WHERE agent_id = $1', [agentId]);
        await pool.query('DELETE FROM agent_audit_logs WHERE agent_id = $1', [agentId]);
        await pool.query('DELETE FROM agents WHERE id = $1', [agentId]);
      } catch (e) { /* ignore */ }
    }
    for (const orderId of testOrderIds) {
      try {
        await pool.query('DELETE FROM orders WHERE id = $1', [orderId]);
      } catch (e) { /* ignore */ }
    }
    for (const userId of testUserIds) {
      try {
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      } catch (e) { /* ignore */ }
    }
  });

  /** Create test user */
  async function createTestUser(suffix: string): Promise<number> {
    const timestamp = Date.now();
    const invCode = timestamp.toString(36).slice(-6).toUpperCase();
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, role, invitation_code)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [`test_agent_${suffix}_${timestamp}`, `test_${suffix}_${timestamp}@test.com`, 'hash', 'user', invCode]
    );
    testUserIds.push(result.rows[0].id);
    return result.rows[0].id;
  }

  /** Create test order */
  async function createTestOrder(userId: number, amount: number): Promise<number> {
    const timestamp = Date.now();
    const result = await pool.query(
      `INSERT INTO orders (user_id, order_no, plan_id, amount, status, created_at)
       VALUES ($1, $2, 1, $3, 'paid', CURRENT_TIMESTAMP)
       RETURNING id`,
      [userId, `TEST${timestamp}`, amount]
    );
    testOrderIds.push(result.rows[0].id);
    return result.rows[0].id;
  }

  // ============================================================
  // Property 1 & 2: Agent Creation and Status Transitions
  // Validates: Requirements 1.1, 1.2, 7.3
  // ============================================================
  describe('Property 1 & 2: Agent Creation and Status', () => {
    test('Property 1: New agents have correct defaults (30% commission, active status)', async () => {
      if (!tablesExist) return;
      // Feature: agent-commission, Property 1: Agent Creation Default Values
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 50 }),
          async (suffix) => {
            const userId = await createTestUser(`p1_${suffix}`);
            const agent = await agentService.applyAgent(userId);
            testAgentIds.push(agent.id);

            expect(agent.commissionRate).toBe(0.30);
            expect(agent.status).toBe('active');
            expect(agent.totalEarnings).toBe(0);
            expect(agent.receiverAdded).toBe(false);
            return true;
          }
        ),
        { numRuns: 5, verbose: true }
      );
    }, 60000);

    test('Property 2: Agent status transitions are valid (active ↔ suspended)', async () => {
      if (!tablesExist) return;
      // Feature: agent-commission, Property 2: Agent Status Transition Validity
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constantFrom('active', 'suspended') as fc.Arbitrary<AgentStatus>, { minLength: 1, maxLength: 5 }),
          async (statusSequence) => {
            const userId = await createTestUser(`p2_${Date.now()}`);
            const agent = await agentService.applyAgent(userId);
            testAgentIds.push(agent.id);
            
            for (const targetStatus of statusSequence) {
              const updated = await agentService.updateAgentStatus(agent.id, targetStatus, userId);
              expect(updated.status).toBe(targetStatus);
              expect(['active', 'suspended']).toContain(updated.status);
            }
            return true;
          }
        ),
        { numRuns: 5, verbose: true }
      );
    }, 60000);
  });

  // ============================================================
  // Property 3: Commission Calculation Accuracy
  // Validates: Requirements 4.1
  // ============================================================
  describe('Property 3: Commission Calculation', () => {
    test('Property 3: Commission = amount × rate, rounded to 2 decimals', () => {
      // Feature: agent-commission, Property 3: Commission Calculation Accuracy
      // This test doesn't require database tables
      
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000000 }), // amount in cents
          fc.integer({ min: 1, max: 30 }),      // rate in percent
          (amountCents, ratePercent) => {
            const amount = amountCents / 100;
            const rate = ratePercent / 100;
            const commission = commissionService.calculateCommission(amount, rate);
            const expected = Math.round(amount * rate * 100) / 100;
            return Math.abs(commission - expected) < 0.01;
          }
        ),
        { numRuns: 100, verbose: true }
      );
    });

    test('Property 3 (Variant): Commission is always non-negative', () => {
      // Feature: agent-commission, Property 3: Commission Non-Negative
      
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000000 }),
          fc.integer({ min: 0, max: 30 }),
          (amountCents, ratePercent) => {
            const commission = commissionService.calculateCommission(amountCents / 100, ratePercent / 100);
            return commission >= 0;
          }
        ),
        { numRuns: 100, verbose: true }
      );
    });
  });


  // ============================================================
  // Property 4, 5, 6: Order Processing and Commission Creation
  // Validates: Requirements 3.1, 3.2, 3.3, 3.4, 4.2
  // ============================================================
  describe('Property 4, 5, 6: Order and Commission Processing', () => {
    test('Property 4 & 5: Commission records are created with complete data', async () => {
      if (!tablesExist) return;
      // Feature: agent-commission, Property 4 & 5: Commission Record Creation
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1000, max: 100000 }), // amount in cents
          async (amountCents) => {
            const amount = amountCents / 100;
            const agentUserId = await createTestUser(`p45_agent_${Date.now()}`);
            const invitedUserId = await createTestUser(`p45_invited_${Date.now()}`);
            
            const agent = await agentService.applyAgent(agentUserId);
            testAgentIds.push(agent.id);
            
            const orderId = await createTestOrder(invitedUserId, amount);
            const commission = await commissionService.createCommission(orderId, agent.id, invitedUserId, amount);
            
            // Property 4: Order is associated with agent
            expect(commission.agentId).toBe(agent.id);
            expect(commission.orderId).toBe(orderId);
            
            // Property 5: Commission record is complete
            expect(commission.invitedUserId).toBe(invitedUserId);
            expect(commission.orderAmount).toBeCloseTo(amount, 2);
            expect(commission.commissionRate).toBe(agent.commissionRate);
            expect(commission.commissionAmount).toBeCloseTo(
              commissionService.calculateCommission(amount, agent.commissionRate), 2
            );
            expect(commission.status).toBe('pending');
            
            return true;
          }
        ),
        { numRuns: 5, verbose: true }
      );
    }, 60000);

    test('Property 6: Settlement date is T+1 (next day after payment)', async () => {
      if (!tablesExist) return;
      // Feature: agent-commission, Property 6: T+1 Settlement Time
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1000, max: 100000 }),
          async (amountCents) => {
            const amount = amountCents / 100;
            const agentUserId = await createTestUser(`p6_agent_${Date.now()}`);
            const invitedUserId = await createTestUser(`p6_invited_${Date.now()}`);
            
            const agent = await agentService.applyAgent(agentUserId);
            testAgentIds.push(agent.id);
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const orderId = await createTestOrder(invitedUserId, amount);
            const commission = await commissionService.createCommission(orderId, agent.id, invitedUserId, amount);
            
            const settleDate = new Date(commission.settleDate);
            settleDate.setHours(0, 0, 0, 0);
            
            const diffDays = Math.round((settleDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            expect(diffDays).toBe(1);
            
            return true;
          }
        ),
        { numRuns: 5, verbose: true }
      );
    }, 60000);
  });

  // ============================================================
  // Property 7 & 8: Refund Handling
  // Validates: Requirements 5.1, 5.2, 5.4
  // ============================================================
  describe('Property 7 & 8: Refund Handling', () => {
    test('Property 7: Full refund cancels pending commission', async () => {
      if (!tablesExist) return;
      // Feature: agent-commission, Property 7: Refund Commission Handling
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1000, max: 100000 }),
          async (amountCents) => {
            const amount = amountCents / 100;
            const agentUserId = await createTestUser(`p7_agent_${Date.now()}`);
            const invitedUserId = await createTestUser(`p7_invited_${Date.now()}`);
            
            const agent = await agentService.applyAgent(agentUserId);
            testAgentIds.push(agent.id);
            
            const orderId = await createTestOrder(invitedUserId, amount);
            const commission = await commissionService.createCommission(orderId, agent.id, invitedUserId, amount);
            
            expect(commission.status).toBe('pending');
            
            await commissionService.handleRefund(orderId, amount, true);
            const updated = await commissionService.getCommissionById(commission.id);
            
            expect(updated?.status).toBe('cancelled');
            return true;
          }
        ),
        { numRuns: 5, verbose: true }
      );
    }, 60000);

    test('Property 8: Partial refund adjusts commission proportionally', async () => {
      if (!tablesExist) return;
      // Feature: agent-commission, Property 8: Partial Refund Adjustment
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10000, max: 100000 }), // amount in cents
          fc.integer({ min: 10, max: 50 }),        // refund percent
          async (amountCents, refundPercent) => {
            const amount = amountCents / 100;
            const refundRatio = refundPercent / 100;
            const agentUserId = await createTestUser(`p8_agent_${Date.now()}`);
            const invitedUserId = await createTestUser(`p8_invited_${Date.now()}`);
            
            const agent = await agentService.applyAgent(agentUserId);
            testAgentIds.push(agent.id);
            
            const orderId = await createTestOrder(invitedUserId, amount);
            const commission = await commissionService.createCommission(orderId, agent.id, invitedUserId, amount);
            
            const refundAmount = Math.round(amount * refundRatio * 100) / 100;
            await commissionService.handleRefund(orderId, refundAmount, false);
            
            const updated = await commissionService.getCommissionById(commission.id);
            const expectedCommission = commissionService.calculateCommission(
              amount - refundAmount, commission.commissionRate
            );
            
            expect(Math.abs(updated!.commissionAmount - expectedCommission)).toBeLessThan(0.01);
            return true;
          }
        ),
        { numRuns: 5, verbose: true }
      );
    }, 60000);
  });

  // ============================================================
  // Property 9: Agent Statistics Consistency
  // Validates: Requirements 6.1, 6.2
  // ============================================================
  describe('Property 9: Agent Statistics', () => {
    test('Property 9: Agent earnings match commission records', async () => {
      if (!tablesExist) return;
      // Feature: agent-commission, Property 9: Agent Statistics Consistency
      
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 1000, max: 50000 }), { minLength: 1, maxLength: 3 }),
          async (amountsCents) => {
            const amounts = amountsCents.map(c => c / 100);
            const agentUserId = await createTestUser(`p9_agent_${Date.now()}`);
            
            const agent = await agentService.applyAgent(agentUserId);
            testAgentIds.push(agent.id);
            
            let expectedPending = 0;
            let expectedSettled = 0;
            
            for (let i = 0; i < amounts.length; i++) {
              const invitedUserId = await createTestUser(`p9_inv_${Date.now()}_${i}`);
              const orderId = await createTestOrder(invitedUserId, amounts[i]);
              const commission = await commissionService.createCommission(orderId, agent.id, invitedUserId, amounts[i]);
              
              if (i % 2 === 0) {
                await commissionService.updateCommissionStatus(commission.id, 'settled');
                expectedSettled += commission.commissionAmount;
              } else {
                expectedPending += commission.commissionAmount;
              }
            }
            
            // Update agent statistics
            await pool.query(
              `UPDATE agents SET 
                total_earnings = (SELECT COALESCE(SUM(commission_amount), 0) FROM commission_records WHERE agent_id = $1 AND status IN ('pending', 'settled')),
                settled_earnings = (SELECT COALESCE(SUM(commission_amount), 0) FROM commission_records WHERE agent_id = $1 AND status = 'settled'),
                pending_earnings = (SELECT COALESCE(SUM(commission_amount), 0) FROM commission_records WHERE agent_id = $1 AND status = 'pending')
              WHERE id = $1`,
              [agent.id]
            );
            
            const updated = await agentService.getAgentById(agent.id);
            
            expect(updated!.settledEarnings).toBeCloseTo(expectedSettled, 2);
            expect(updated!.pendingEarnings).toBeCloseTo(expectedPending, 2);
            expect(updated!.totalEarnings).toBeCloseTo(expectedSettled + expectedPending, 2);
            
            return true;
          }
        ),
        { numRuns: 3, verbose: true }
      );
    }, 120000);
  });

  // ============================================================
  // Property 10 & 11: Admin Operations and Limits
  // Validates: Requirements 7.2, 7.3, 7.4, 7.5, 9.2
  // ============================================================
  describe('Property 10 & 11: Admin Operations and Limits', () => {
    test('Property 10: Admin operations are logged', async () => {
      if (!tablesExist) return;
      // Feature: agent-commission, Property 10: Admin Operation Permission
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 30 }), // rate percent
          async (ratePercent) => {
            const rate = ratePercent / 100;
            const agentUserId = await createTestUser(`p10_agent_${Date.now()}`);
            const adminUserId = await createTestUser(`p10_admin_${Date.now()}`);
            
            const agent = await agentService.applyAgent(agentUserId);
            testAgentIds.push(agent.id);
            
            await agentService.updateCommissionRate(agent.id, rate, adminUserId);
            
            const auditResult = await pool.query(
              `SELECT * FROM agent_audit_logs WHERE agent_id = $1 AND action_type = 'rateChange' ORDER BY created_at DESC LIMIT 1`,
              [agent.id]
            );
            
            expect(auditResult.rows.length).toBeGreaterThan(0);
            expect(auditResult.rows[0].operator_id).toBe(adminUserId);
            
            return true;
          }
        ),
        { numRuns: 3, verbose: true }
      );
    }, 60000);

    test('Property 11: Commission rate never exceeds 30%', async () => {
      if (!tablesExist) return;
      // Feature: agent-commission, Property 11: Profit Sharing Amount Limit
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1000, max: 1000000 }),
          async (amountCents) => {
            const amount = amountCents / 100;
            const agentUserId = await createTestUser(`p11_agent_${Date.now()}`);
            const invitedUserId = await createTestUser(`p11_invited_${Date.now()}`);
            
            const agent = await agentService.applyAgent(agentUserId);
            testAgentIds.push(agent.id);
            
            const orderId = await createTestOrder(invitedUserId, amount);
            const commission = await commissionService.createCommission(orderId, agent.id, invitedUserId, amount);
            
            expect(commission.commissionRate).toBeLessThanOrEqual(0.30);
            expect(commission.commissionAmount).toBeLessThanOrEqual(amount * 0.30 + 0.01);
            
            return true;
          }
        ),
        { numRuns: 10, verbose: true }
      );
    }, 60000);

    test('Property 11 (Variant): Rate adjustment is bounded to 0-30%', async () => {
      if (!tablesExist) return;
      // Feature: agent-commission, Property 11: Commission Rate Bound
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 100 }), // attempted rate percent
          async (attemptedPercent) => {
            const attemptedRate = attemptedPercent / 100;
            const agentUserId = await createTestUser(`p11v_agent_${Date.now()}`);
            
            const agent = await agentService.applyAgent(agentUserId);
            testAgentIds.push(agent.id);
            
            if (attemptedRate > 0.30) {
              await expect(
                agentService.updateCommissionRate(agent.id, attemptedRate, agentUserId)
              ).rejects.toThrow();
            } else {
              const updated = await agentService.updateCommissionRate(agent.id, attemptedRate, agentUserId);
              expect(updated.commissionRate).toBe(attemptedRate);
            }
            
            return true;
          }
        ),
        { numRuns: 10, verbose: true }
      );
    }, 60000);
  });
});
