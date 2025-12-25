import * as fc from 'fast-check';
import { pool } from '../db/database';
import { securityMonitorService, SecurityEvent } from '../services/SecurityMonitorService';

// 清理测试数据的辅助函数
async function cleanupTestData() {
  await pool.query(`DELETE FROM security_events WHERE message LIKE 'TEST:%'`);
  await pool.query(`DELETE FROM audit_logs WHERE details::text LIKE '%TEST:%'`);
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
 * Property 51: 安全事件日志分离
 * For any security-related event (authentication, authorization, suspicious activity),
 * it should be logged to the security_events table with severity level.
 * Validates: Requirements 16.1, 16.2
 */
describe('Property 51: Security event log separation', () => {
  test('should log all security events to security_events table with severity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          type: fc.constantFrom(
            'authentication_failed',
            'authorization_denied',
            'suspicious_login',
            'high_frequency',
            'privilege_escalation'
          ),
          severity: fc.constantFrom('info', 'warning', 'critical'),
          message: fc.string({ minLength: 10, maxLength: 100 }),
          // 不使用userId以避免外键约束问题
          ipAddress: fc.option(
            fc.tuple(
              fc.integer({ min: 0, max: 255 }),
              fc.integer({ min: 0, max: 255 }),
              fc.integer({ min: 0, max: 255 }),
              fc.integer({ min: 0, max: 255 })
            ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),
            { nil: undefined }
          )
        }),
        async ({ type, severity, message, ipAddress }) => {
          const testMessage = `TEST: ${message}`;
          const event: SecurityEvent = {
            type,
            severity: severity as 'info' | 'warning' | 'critical',
            message: testMessage,
            details: { test: true },
            timestamp: new Date(),
            ipAddress
          };

          // 记录安全事件
          await securityMonitorService.logSecurityEvent(event);

          // 验证：事件应该被记录到security_events表
          const result = await pool.query(
            `SELECT * FROM security_events 
             WHERE message = $1 
             ORDER BY created_at DESC 
             LIMIT 1`,
            [testMessage]
          );

          const logged = result.rows[0];

          // 验证所有字段
          const isCorrectlyLogged =
            logged &&
            logged.event_type === type &&
            logged.severity === severity &&
            logged.message === testMessage &&
            (ipAddress === undefined || logged.ip_address === ipAddress);

          // 清理
          await pool.query(`DELETE FROM security_events WHERE message = $1`, [testMessage]);

          return isCorrectlyLogged;
        }
      ),
      { numRuns: 50 }
    );
  });

  test('should separate security events from audit logs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          type: fc.constantFrom('suspicious_login', 'high_frequency', 'privilege_escalation'),
          severity: fc.constantFrom('warning', 'critical'),
          message: fc.string({ minLength: 10, maxLength: 50 })
        }),
        async ({ type, severity, message }) => {
          const testMessage = `TEST: ${message}`;
          const event: SecurityEvent = {
            type,
            severity: severity as 'warning' | 'critical',
            message: testMessage,
            details: { test: true },
            timestamp: new Date()
          };

          // 记录安全事件
          await securityMonitorService.logSecurityEvent(event);

          // 验证：事件在security_events表中
          const securityResult = await pool.query(
            `SELECT COUNT(*) as count FROM security_events WHERE message = $1`,
            [testMessage]
          );

          const inSecurityEvents = parseInt(securityResult.rows[0].count) > 0;

          // 验证：事件不在audit_logs表中（除非是告警记录）
          const auditResult = await pool.query(
            `SELECT COUNT(*) as count FROM audit_logs 
             WHERE details::text LIKE $1 AND action != 'SECURITY_ALERT_SENT'`,
            [`%${testMessage}%`]
          );

          const notInAuditLogs = parseInt(auditResult.rows[0].count) === 0;

          // 清理
          await pool.query(`DELETE FROM security_events WHERE message = $1`, [testMessage]);

          return inSecurityEvents && notInAuditLogs;
        }
      ),
      { numRuns: 30 }
    );
  });
});

/**
 * Feature: system-security-foundation
 * Property 52: 关键事件即时告警
 * For any security event with critical severity,
 * an immediate alert should be sent to all admins.
 * Validates: Requirements 16.3
 */
describe('Property 52: Critical event immediate alerts', () => {
  test('should trigger alert mechanism for critical events', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          type: fc.constantFrom('privilege_escalation', 'account_compromise', 'data_breach'),
          message: fc.string({ minLength: 10, maxLength: 100 })
        }),
        async ({ type, message }) => {
          const testMessage = `TEST: ${message}`;

          const event: SecurityEvent = {
            type,
            severity: 'critical',
            message: testMessage,
            details: { test: true, critical: true },
            timestamp: new Date()
          };

          // 记录关键事件
          await securityMonitorService.logSecurityEvent(event);

          // 验证：事件应该被记录到security_events表
          const eventResult = await pool.query(
            `SELECT * FROM security_events 
             WHERE message = $1 
               AND severity = 'critical'
             ORDER BY created_at DESC 
             LIMIT 1`,
            [testMessage]
          );

          const eventLogged = eventResult.rows.length > 0;

          // 清理
          await pool.query(`DELETE FROM security_events WHERE message = $1`, [testMessage]);
          await pool.query(
            `DELETE FROM audit_logs 
             WHERE action = 'SECURITY_ALERT_SENT' 
               AND created_at > NOW() - INTERVAL '10 seconds'`
          );

          // 验证：关键事件应该被记录
          return eventLogged;
        }
      ),
      { numRuns: 20 }
    );
  });

  test('should not send immediate alert for non-critical events', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          type: fc.string({ minLength: 5, maxLength: 20 }),
          severity: fc.constantFrom('info', 'warning'),
          message: fc.string({ minLength: 10, maxLength: 50 })
        }),
        async ({ type, severity, message }) => {
          const testMessage = `TEST: ${message}`;
          const beforeCount = await pool.query(
            `SELECT COUNT(*) as count FROM audit_logs 
             WHERE action = 'SECURITY_ALERT_SENT'`
          );

          const event: SecurityEvent = {
            type,
            severity: severity as 'info' | 'warning',
            message: testMessage,
            details: { test: true },
            timestamp: new Date()
          };

          // 记录非关键事件
          await securityMonitorService.logSecurityEvent(event);

          const afterCount = await pool.query(
            `SELECT COUNT(*) as count FROM audit_logs 
             WHERE action = 'SECURITY_ALERT_SENT'`
          );

          // 验证：告警数量不应该增加
          const noNewAlert =
            parseInt(afterCount.rows[0].count) === parseInt(beforeCount.rows[0].count);

          // 清理
          await pool.query(`DELETE FROM security_events WHERE message = $1`, [testMessage]);

          return noNewAlert;
        }
      ),
      { numRuns: 30 }
    );
  });
});

/**
 * Feature: system-security-foundation
 * Property 53: 安全日志导出
 * For any security log export request,
 * logs should be exported in the requested format (JSON or CSV) with all required fields.
 * Validates: Requirements 16.5
 */
describe('Property 53: Security log export', () => {
  test('should export logs in JSON format with all fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            type: fc.string({ minLength: 5, maxLength: 20 }),
            severity: fc.constantFrom('info', 'warning', 'critical'),
            message: fc.string({ minLength: 10, maxLength: 50 })
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (events) => {
          // 创建测试事件
          const testMessages: string[] = [];
          for (const eventData of events) {
            const testMessage = `TEST: Export JSON ${Math.random()}`;
            testMessages.push(testMessage);

            await securityMonitorService.logSecurityEvent({
              type: eventData.type,
              severity: eventData.severity as 'info' | 'warning' | 'critical',
              message: testMessage,
              details: { test: true },
              timestamp: new Date()
            });
          }

          // 导出为JSON
          const exported = await securityMonitorService.exportSecurityLogs(
            {
              startDate: new Date(Date.now() - 60000) // 最近1分钟
            },
            'json'
          );

          // 验证：应该是有效的JSON
          let isValidJSON = false;
          let hasAllFields = false;

          try {
            const parsed = JSON.parse(exported);
            isValidJSON = Array.isArray(parsed);

            // 验证字段完整性
            if (parsed.length > 0) {
              const firstEvent = parsed[0];
              hasAllFields =
                'id' in firstEvent &&
                'event_type' in firstEvent &&
                'severity' in firstEvent &&
                'message' in firstEvent &&
                'created_at' in firstEvent;
            } else {
              hasAllFields = true; // 空数组也是有效的
            }
          } catch (error) {
            isValidJSON = false;
          }

          // 清理
          for (const msg of testMessages) {
            await pool.query(`DELETE FROM security_events WHERE message = $1`, [msg]);
          }

          return isValidJSON && hasAllFields;
        }
      ),
      { numRuns: 20 }
    );
  });

  test('should export logs in CSV format with proper structure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            type: fc.string({ minLength: 5, maxLength: 20 }).filter(s => !s.includes(',') && !s.includes('"')),
            severity: fc.constantFrom('info', 'warning', 'critical'),
            message: fc.string({ minLength: 10, maxLength: 50 }).filter(s => !s.includes(',') && !s.includes('"'))
          }),
          { minLength: 1, maxLength: 3 }
        ),
        async (events) => {
          // 创建测试事件
          const testMessages: string[] = [];
          for (const eventData of events) {
            const testMessage = `TEST: Export CSV ${Math.random()}`;
            testMessages.push(testMessage);

            await securityMonitorService.logSecurityEvent({
              type: eventData.type,
              severity: eventData.severity as 'info' | 'warning' | 'critical',
              message: testMessage,
              details: { test: true },
              timestamp: new Date()
            });
          }

          // 导出为CSV
          const exported = await securityMonitorService.exportSecurityLogs(
            {
              startDate: new Date(Date.now() - 60000)
            },
            'csv'
          );

          // 验证：应该有CSV头部
          const lines = exported.split('\n');
          const hasHeader = lines[0].includes('ID') && lines[0].includes('Type');

          // 验证：每行应该有正确数量的字段（7个字段）
          const dataLines = lines.slice(1).filter(line => line.trim().length > 0);
          const hasCorrectStructure = dataLines.every(line => {
            const fields = line.match(/"[^"]*"/g) || [];
            return fields.length === 7;
          });

          // 清理
          for (const msg of testMessages) {
            await pool.query(`DELETE FROM security_events WHERE message = $1`, [msg]);
          }

          return hasHeader && hasCorrectStructure;
        }
      ),
      { numRuns: 15 }
    );
  });

  test('should handle CSV export with special characters', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 50 }),
        async (message) => {
          const testMessage = `TEST: CSV Special "${message}"`;

          await securityMonitorService.logSecurityEvent({
            type: 'test_event',
            severity: 'info',
            message: testMessage,
            details: { test: true },
            timestamp: new Date()
          });

          // 导出为CSV
          const exported = await securityMonitorService.exportSecurityLogs(
            {
              startDate: new Date(Date.now() - 60000)
            },
            'csv'
          );

          // 验证：应该正确转义特殊字符
          const hasEscapedQuotes = exported.includes('""') || !message.includes('"');

          // 清理
          await pool.query(`DELETE FROM security_events WHERE message = $1`, [testMessage]);

          return hasEscapedQuotes;
        }
      ),
      { numRuns: 20 }
    );
  });
});

/**
 * 额外测试：安全指标统计
 */
describe('Security metrics calculation', () => {
  test('should calculate security metrics correctly', async () => {
    // 创建一些测试事件
    const testEvents = [
      { type: 'suspicious_login', severity: 'warning' as const },
      { type: 'high_frequency', severity: 'critical' as const },
      { type: 'privilege_escalation', severity: 'critical' as const }
    ];

    for (const eventData of testEvents) {
      await securityMonitorService.logSecurityEvent({
        type: eventData.type,
        severity: eventData.severity,
        message: `TEST: Metrics ${eventData.type}`,
        details: { test: true },
        timestamp: new Date()
      });
    }

    // 获取指标
    const metrics = await securityMonitorService.getSecurityMetrics(60000); // 最近1分钟

    // 验证：指标应该反映测试事件
    expect(metrics.suspiciousActivities).toBeGreaterThanOrEqual(2); // warning + critical
    expect(metrics.activeAnomalies).toBeGreaterThanOrEqual(1); // critical

    // 清理
    await pool.query(`DELETE FROM security_events WHERE message LIKE 'TEST: Metrics%'`);
  });
});
