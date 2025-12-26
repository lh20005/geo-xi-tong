import * as fc from 'fast-check';
import { pool } from '../db/database';
import { securityResponseService } from '../services/SecurityResponseService';
import { AnomalyEvent } from '../services/AnomalyDetectionService';

// 清理测试数据的辅助函数
async function cleanupTestData() {
  await pool.query(`DELETE FROM audit_logs WHERE details::text LIKE '%system%' AND action LIKE '%SECURITY%'`);
  await pool.query(`DELETE FROM audit_logs WHERE details::text LIKE '%system%' AND action LIKE '%BLOCK%'`);
  await pool.query(`DELETE FROM audit_logs WHERE details::text LIKE '%system%' AND action LIKE '%LOCK%'`);
  await pool.query(`DELETE FROM audit_logs WHERE details::text LIKE '%system%' AND action LIKE '%REAUTH%'`);
}

// 测试前清理
beforeAll(async () => {
  await cleanupTestData();
});

// 每个测试后清理
afterEach(async () => {
  await cleanupTestData();
});

// 测试后清理
afterAll(async () => {
  // 不需要清理，因为测试数据会在下次运行时清理
  // pool.end() 由全局 setup.ts 处理
});

/**
 * Feature: system-security-foundation
 * Property 62: 暴力攻击自动封禁
 * For any detected brute force attack pattern,
 * the source IP should be automatically blocked for 1 hour.
 * Validates: Requirements 20.1
 */
describe('Property 62: Brute force attack auto-blocking', () => {
  test('should block IP after detecting brute force attack', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 })
        ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),
        async (ipAddress) => {
          // 模拟多次失败登录
          for (let i = 0; i < 5; i++) {
            await pool.query(
              `INSERT INTO audit_logs 
               (admin_id, action, ip_address, details, created_at)
               VALUES ($1, $2, $3, $4, NOW())`,
              [1, 'LOGIN_FAILED', ipAddress, JSON.stringify({ test: true })]
            );
          }

          // 触发暴力攻击检测
          const response = await securityResponseService.handleBruteForceAttack(ipAddress);

          // 验证：应该返回封禁响应
          const wasBlocked = response !== null && response.action === 'BLOCK_IP';

          // 验证：应该有封禁记录
          const blockResult = await pool.query(
            `SELECT COUNT(*) as count FROM audit_logs 
             WHERE action = 'IP_BLOCKED' 
               AND ip_address = $1`,
            [ipAddress]
          );
          const hasBlockRecord = parseInt(blockResult.rows[0].count) > 0;

          // 清理
          await pool.query(
            `DELETE FROM audit_logs WHERE ip_address = $1`,
            [ipAddress]
          );

          return wasBlocked && hasBlockRecord;
        }
      ),
      { numRuns: 10 }
    );
  });

  test('should not block IP with fewer failed attempts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 })
        ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),
        async (ipAddress) => {
          // 模拟少量失败登录（低于阈值）
          for (let i = 0; i < 3; i++) {
            await pool.query(
              `INSERT INTO audit_logs 
               (admin_id, action, ip_address, details, created_at)
               VALUES ($1, $2, $3, $4, NOW())`,
              [1, 'LOGIN_FAILED', ipAddress, JSON.stringify({ test: true })]
            );
          }

          // 触发暴力攻击检测
          const response = await securityResponseService.handleBruteForceAttack(ipAddress);

          // 验证：不应该封禁
          const notBlocked = response === null;

          // 清理
          await pool.query(
            `DELETE FROM audit_logs WHERE ip_address = $1`,
            [ipAddress]
          );

          return notBlocked;
        }
      ),
      { numRuns: 10 }
    );
  });
});

/**
 * Feature: system-security-foundation
 * Property 63: 账户妥协自动锁定
 * For any detected account compromise,
 * the account should be automatically locked and notifications sent.
 * Validates: Requirements 20.2
 */
describe('Property 63: Account compromise auto-locking', () => {
  test('should lock account when compromise is detected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.integer({ min: 1, max: 1000 }),
          reason: fc.string({ minLength: 10, maxLength: 100 })
        }),
        async ({ userId, reason }) => {
          // 触发账户妥协处理
          const response = await securityResponseService.handleAccountCompromise(userId, reason);

          // 验证：应该返回锁定响应
          const wasLocked = response.action === 'LOCK_ACCOUNT';

          // 验证：应该有锁定记录
          const lockResult = await pool.query(
            `SELECT COUNT(*) as count FROM audit_logs 
             WHERE action = 'ACCOUNT_LOCKED' 
               AND target_id = $1`,
            [userId]
          );
          const hasLockRecord = parseInt(lockResult.rows[0].count) > 0;

          // 验证：应该有安全响应记录
          const responseResult = await pool.query(
            `SELECT COUNT(*) as count FROM audit_logs 
             WHERE action = 'SECURITY_RESPONSE' 
               AND details::text LIKE '%LOCK_ACCOUNT%'`
          );
          const hasResponseRecord = parseInt(responseResult.rows[0].count) > 0;

          // 清理
          await pool.query(
            `DELETE FROM audit_logs 
             WHERE target_id = $1 
               AND action IN ('ACCOUNT_LOCKED', 'SECURITY_RESPONSE')`,
            [userId]
          );

          return wasLocked && hasLockRecord && hasResponseRecord;
        }
      ),
      { numRuns: 15 }
    );
  });
});

/**
 * Feature: system-security-foundation
 * Property 64: 可疑活动重新认证
 * For any suspicious admin activity detection,
 * subsequent sensitive operations should require re-authentication.
 * Validates: Requirements 20.3
 */
describe('Property 64: Suspicious activity re-authentication', () => {
  test('should require re-authentication for suspicious activity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.integer({ min: 1, max: 1000 }),
          reason: fc.string({ minLength: 10, maxLength: 100 })
        }),
        async ({ userId, reason }) => {
          // 要求重新认证
          const response = await securityResponseService.requireReauthentication(userId, reason);

          // 验证：应该返回重新认证响应
          const reauthRequired = response.action === 'REQUIRE_REAUTH';

          // 验证：应该有重新认证记录
          const reauthResult = await pool.query(
            `SELECT COUNT(*) as count FROM audit_logs 
             WHERE action = 'REQUIRE_REAUTH' 
               AND target_id = $1`,
            [userId]
          );
          const hasReauthRecord = parseInt(reauthResult.rows[0].count) > 0;

          // 清理
          await pool.query(
            `DELETE FROM audit_logs 
             WHERE target_id = $1 
               AND action IN ('REQUIRE_REAUTH', 'SECURITY_RESPONSE')`,
            [userId]
          );

          return reauthRequired && hasReauthRecord;
        }
      ),
      { numRuns: 15 }
    );
  });
});

/**
 * Feature: system-security-foundation
 * Property 65: 紧急锁定模式
 * For any emergency lockdown activation,
 * all non-admin access should be disabled until lockdown is lifted.
 * Validates: Requirements 20.4
 */
describe('Property 65: Emergency lockdown mode', () => {
  test('should activate emergency lockdown', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }),
        async (reason) => {
          // 激活紧急锁定
          const response = await securityResponseService.activateEmergencyLockdown(reason);

          // 验证：应该返回锁定响应
          const lockdownActivated = response.action === 'EMERGENCY_LOCKDOWN';

          // 验证：锁定状态应该为true
          const isActive = securityResponseService.isEmergencyLockdownActive();

          // 验证：应该有锁定记录
          const lockdownResult = await pool.query(
            `SELECT COUNT(*) as count FROM audit_logs 
             WHERE action = 'EMERGENCY_LOCKDOWN'`
          );
          const hasLockdownRecord = parseInt(lockdownResult.rows[0].count) > 0;

          // 清理：解除锁定
          await securityResponseService.deactivateEmergencyLockdown(1);
          await pool.query(
            `DELETE FROM audit_logs 
             WHERE action IN ('EMERGENCY_LOCKDOWN', 'EMERGENCY_LOCKDOWN_DEACTIVATED', 'SECURITY_RESPONSE')`
          );

          return lockdownActivated && isActive && hasLockdownRecord;
        }
      ),
      { numRuns: 10 }
    );
  });

  test('should deactivate emergency lockdown', async () => {
    // 先激活锁定
    await securityResponseService.activateEmergencyLockdown('Test lockdown');

    // 验证已激活
    expect(securityResponseService.isEmergencyLockdownActive()).toBe(true);

    // 解除锁定
    await securityResponseService.deactivateEmergencyLockdown(1);

    // 验证已解除
    expect(securityResponseService.isEmergencyLockdownActive()).toBe(false);

    // 清理
    await pool.query(
      `DELETE FROM audit_logs 
       WHERE action IN ('EMERGENCY_LOCKDOWN', 'EMERGENCY_LOCKDOWN_DEACTIVATED', 'SECURITY_RESPONSE')`
    );
  });
});

/**
 * Feature: system-security-foundation
 * Property 66: 事件响应日志
 * For any automated security response action,
 * the action should be logged in the incident response log.
 * Validates: Requirements 20.5
 */
describe('Property 66: Incident response logging', () => {
  test('should log all security responses', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.integer({ min: 1, max: 1000 }),
          reason: fc.string({ minLength: 10, maxLength: 50 })
        }),
        async ({ userId, reason }) => {
          // 执行安全响应
          await securityResponseService.requireReauthentication(userId, reason);

          // 验证：应该有安全响应日志
          const logResult = await pool.query(
            `SELECT COUNT(*) as count FROM audit_logs 
             WHERE action = 'SECURITY_RESPONSE' 
               AND details::text LIKE '%REQUIRE_REAUTH%'
               AND created_at > NOW() - INTERVAL '10 seconds'`
          );

          const hasLog = parseInt(logResult.rows[0].count) > 0;

          // 清理
          await pool.query(
            `DELETE FROM audit_logs 
             WHERE target_id = $1 
               AND action IN ('REQUIRE_REAUTH', 'SECURITY_RESPONSE')`,
            [userId]
          );

          return hasLog;
        }
      ),
      { numRuns: 15 }
    );
  });

  test('should log automated flag in responses', async () => {
    const userId = 999;
    const reason = 'Test automated response';

    // 执行自动响应
    const response = await securityResponseService.requireReauthentication(userId, reason);

    // 验证：响应应该标记为自动化
    expect(response.automated).toBe(true);

    // 验证：日志中应该包含automated标志
    const logResult = await pool.query(
      `SELECT details FROM audit_logs 
       WHERE action = 'SECURITY_RESPONSE' 
         AND created_at > NOW() - INTERVAL '10 seconds'
       ORDER BY created_at DESC
       LIMIT 1`
    );

    const details = logResult.rows[0]?.details;
    expect(details).toBeDefined();
    expect(details.automated).toBe(true);

    // 清理
    await pool.query(
      `DELETE FROM audit_logs 
       WHERE target_id = $1 
         AND action IN ('REQUIRE_REAUTH', 'SECURITY_RESPONSE')`,
      [userId]
    );
  });
});

/**
 * 额外测试：异常事件处理集成
 */
describe('Anomaly event handling integration', () => {
  test('should handle privilege escalation anomaly', async () => {
    const event: AnomalyEvent = {
      type: 'privilege_escalation',
      userId: 123,
      severity: 'critical',
      details: { message: 'Test privilege escalation' },
      detectedAt: new Date()
    };

    // 处理异常事件
    await securityResponseService.handleAnomalyEvent(event);

    // 验证：应该有账户锁定记录
    const lockResult = await pool.query(
      `SELECT COUNT(*) as count FROM audit_logs 
       WHERE action = 'ACCOUNT_LOCKED' 
         AND target_id = $1`,
      [event.userId]
    );

    expect(parseInt(lockResult.rows[0].count)).toBeGreaterThan(0);

    // 清理
    await pool.query(
      `DELETE FROM audit_logs 
       WHERE target_id = $1`,
      [event.userId]
    );
  });

  test('should handle high frequency anomaly', async () => {
    const event: AnomalyEvent = {
      type: 'high_frequency',
      userId: 456,
      severity: 'critical',
      details: { message: 'Test high frequency' },
      detectedAt: new Date()
    };

    // 处理异常事件
    await securityResponseService.handleAnomalyEvent(event);

    // 验证：应该有重新认证记录
    const reauthResult = await pool.query(
      `SELECT COUNT(*) as count FROM audit_logs 
       WHERE action = 'REQUIRE_REAUTH' 
         AND target_id = $1`,
      [event.userId]
    );

    expect(parseInt(reauthResult.rows[0].count)).toBeGreaterThan(0);

    // 清理
    await pool.query(
      `DELETE FROM audit_logs 
       WHERE target_id = $1`,
      [event.userId]
    );
  });
});
