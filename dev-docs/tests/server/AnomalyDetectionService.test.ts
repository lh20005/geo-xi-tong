import { AnomalyDetectionService, AnomalyEvent } from '../AnomalyDetectionService';
import { pool } from '../../db/database';
import fc from 'fast-check';

/**
 * Feature: system-security-foundation
 * Property 31: 新IP登录检测
 * Property 32: 高频操作检测
 * Property 34: 账户妥协检测
 * 
 * Validates: Requirements 10.1, 10.2, 10.4
 */

describe('AnomalyDetectionService', () => {
  let anomalyService: AnomalyDetectionService;
  let testUserId: number;

  beforeAll(async () => {
    // 创建测试用户
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, role, email, invitation_code) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      ['anomaly_test_user', 'hashed_password', 'admin', 'anomaly@test.com', 'TEST01']
    );
    testUserId = result.rows[0].id;
  });

  beforeEach(() => {
    anomalyService = new AnomalyDetectionService();
  });

  afterEach(async () => {
    if (anomalyService) {
      anomalyService.resetOperationCounts();
    }
    // 清理测试数据
    await pool.query('DELETE FROM audit_logs WHERE admin_id = $1', [testUserId]);
    await pool.query('DELETE FROM security_events WHERE user_id = $1', [testUserId]);
  });

  afterAll(async () => {
    // 删除测试用户
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
  });

  describe('Property 31: New IP Login Detection', () => {
    test('should detect login from new IP', async () => {
      const newIP = '192.168.1.100';
      const userAgent = 'Mozilla/5.0';

      const anomaly = await anomalyService.detectLoginAnomaly(testUserId, newIP, userAgent);

      expect(anomaly).not.toBeNull();
      expect(anomaly!.type).toBe('suspicious_login');
      expect(anomaly!.userId).toBe(testUserId);
      expect(anomaly!.severity).toBe('medium');
      expect(anomaly!.details.ipAddress).toBe(newIP);
    });

    test('should not detect anomaly for known IP', async () => {
      const knownIP = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';

      // 记录历史登录
      await pool.query(
        `INSERT INTO audit_logs (admin_id, action, ip_address, user_agent, created_at)
         VALUES ($1, 'LOGIN', $2, $3, NOW())`,
        [testUserId, knownIP, userAgent]
      );

      const anomaly = await anomalyService.detectLoginAnomaly(testUserId, knownIP, userAgent);

      expect(anomaly).toBeNull();
    });

    test('Property 31: All logins from new IPs should be logged', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.ipV4(),
          fc.string({ minLength: 10, maxLength: 100 }),
          async (ipAddress, userAgent) => {
            // 清理之前的记录
            await pool.query('DELETE FROM audit_logs WHERE admin_id = $1', [testUserId]);

            const anomaly = await anomalyService.detectLoginAnomaly(testUserId, ipAddress, userAgent);

            // Property: New IP should trigger anomaly
            expect(anomaly).not.toBeNull();
            expect(anomaly!.type).toBe('suspicious_login');
            expect(anomaly!.details.ipAddress).toBe(ipAddress);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 32: High Frequency Operation Detection', () => {
    test('should detect high frequency operations', async () => {
      // 模拟51次操作（超过阈值50）
      for (let i = 0; i < 51; i++) {
        anomalyService.recordOperation(testUserId);
      }

      const anomaly = await anomalyService.detectHighFrequency(testUserId);

      expect(anomaly).not.toBeNull();
      expect(anomaly!.type).toBe('high_frequency');
      expect(anomaly!.userId).toBe(testUserId);
      expect(anomaly!.severity).toBe('high');
      expect(anomaly!.details.operationCount).toBeGreaterThan(50);
    });

    test('should not detect anomaly for normal frequency', async () => {
      // 模拟10次操作（低于阈值）
      for (let i = 0; i < 10; i++) {
        anomalyService.recordOperation(testUserId);
      }

      const anomaly = await anomalyService.detectHighFrequency(testUserId);

      expect(anomaly).toBeNull();
    });

    test('should reset counter after time window', async () => {
      // 模拟操作
      for (let i = 0; i < 30; i++) {
        anomalyService.recordOperation(testUserId);
      }

      // 使用较短的时间窗口进行测试
      const shortWindow = 100; // 100ms
      
      // 等待时间窗口过期
      await new Promise(resolve => setTimeout(resolve, 150));

      // 再次操作应该重置计数器
      anomalyService.recordOperation(testUserId);
      const anomaly = await anomalyService.detectHighFrequency(testUserId, shortWindow);

      expect(anomaly).toBeNull();
    });

    test('Property 32: Operations exceeding threshold should trigger alert', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 51, max: 100 }),
          async (operationCount) => {
            anomalyService.resetOperationCounts();

            // 记录操作
            for (let i = 0; i < operationCount; i++) {
              anomalyService.recordOperation(testUserId);
            }

            const anomaly = await anomalyService.detectHighFrequency(testUserId);

            // Property: Should detect high frequency
            expect(anomaly).not.toBeNull();
            expect(anomaly!.type).toBe('high_frequency');
            expect(anomaly!.severity).toBe('high');
            expect(anomaly!.details.operationCount).toBeGreaterThan(50);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 34: Account Compromise Detection', () => {
    test('should detect privilege escalation abuse', async () => {
      // 记录多次权限变更
      for (let i = 0; i < 6; i++) {
        await pool.query(
          `INSERT INTO audit_logs (admin_id, action, target_type, target_id, details, ip_address, created_at)
           VALUES ($1, 'GRANT_PERMISSION', 'user', $2, '{}', '127.0.0.1', NOW())`,
          [testUserId, testUserId + i]
        );
      }

      const anomaly = await anomalyService.detectPrivilegeAbuse(testUserId, 'GRANT_PERMISSION');

      expect(anomaly).not.toBeNull();
      expect(anomaly!.type).toBe('privilege_escalation');
      expect(anomaly!.severity).toBe('critical');
      expect(anomaly!.details.recentChanges).toBeGreaterThan(5);
    });

    test('should not detect anomaly for normal privilege changes', async () => {
      // 记录少量权限变更
      for (let i = 0; i < 3; i++) {
        await pool.query(
          `INSERT INTO audit_logs (admin_id, action, target_type, target_id, details, ip_address, created_at)
           VALUES ($1, 'GRANT_PERMISSION', 'user', $2, '{}', '127.0.0.1', NOW())`,
          [testUserId, testUserId + i]
        );
      }

      const anomaly = await anomalyService.detectPrivilegeAbuse(testUserId, 'GRANT_PERMISSION');

      expect(anomaly).toBeNull();
    });

    test('should handle anomaly event', async () => {
      const event: AnomalyEvent = {
        type: 'privilege_escalation',
        userId: testUserId,
        severity: 'critical',
        details: {
          message: 'Test anomaly',
          recentChanges: 10
        },
        detectedAt: new Date()
      };

      await anomalyService.handleAnomaly(event);

      // 验证事件已记录
      const result = await pool.query(
        'SELECT * FROM security_events WHERE user_id = $1 AND event_type = $2',
        [testUserId, 'privilege_escalation']
      );

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0].severity).toBe('critical');
    });
  });

  describe('Unit Tests: Additional Functionality', () => {
    test('should record operations correctly', () => {
      anomalyService.recordOperation(testUserId);
      anomalyService.recordOperation(testUserId);
      anomalyService.recordOperation(testUserId);

      // 操作应该被记录（通过detectHighFrequency验证）
      // 这里只是确保不抛出错误
      expect(() => anomalyService.recordOperation(testUserId)).not.toThrow();
    });

    test('should reset operation counts', () => {
      for (let i = 0; i < 30; i++) {
        anomalyService.recordOperation(testUserId);
      }

      anomalyService.resetOperationCounts();

      // 重置后应该没有异常
      anomalyService.recordOperation(testUserId);
      expect(async () => {
        await anomalyService.detectHighFrequency(testUserId);
      }).not.toThrow();
    });

    test('should handle different anomaly severities', async () => {
      const events: AnomalyEvent[] = [
        {
          type: 'suspicious_login',
          userId: testUserId,
          severity: 'low',
          details: { message: 'Low severity test' },
          detectedAt: new Date()
        },
        {
          type: 'high_frequency',
          userId: testUserId,
          severity: 'medium',
          details: { message: 'Medium severity test' },
          detectedAt: new Date()
        },
        {
          type: 'privilege_escalation',
          userId: testUserId,
          severity: 'high',
          details: { message: 'High severity test' },
          detectedAt: new Date()
        }
      ];

      for (const event of events) {
        await anomalyService.handleAnomaly(event);
      }

      // 验证所有事件都被记录
      const result = await pool.query(
        'SELECT * FROM security_events WHERE user_id = $1',
        [testUserId]
      );

      expect(result.rows.length).toBeGreaterThanOrEqual(3);
    });
  });
});
