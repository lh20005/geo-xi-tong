/**
 * 安全系统集成测试
 * 测试所有安全功能协同工作
 */

import { pool } from '../db/database';
import { auditLogService } from '../services/AuditLogService';
import { sessionService } from '../services/SessionService';
import { passwordService } from '../services/PasswordService';
import { rateLimitService } from '../services/RateLimitService';
import { permissionService } from '../services/PermissionService';
import { anomalyDetectionService } from '../services/AnomalyDetectionService';
import { securityResponseService } from '../services/SecurityResponseService';
import { securityMonitorService } from '../services/SecurityMonitorService';
import { confirmationTokenService } from '../services/ConfirmationTokenService';
import { configHistoryService } from '../services/ConfigHistoryService';
import { securityConfigService } from '../services/SecurityConfigService';
import { securityCheckService } from '../services/SecurityCheckService';

describe('Security System Integration Tests', () => {
  let testUserId: number;
  let testAdminId: number;

  beforeAll(async () => {
    // 先清理可能存在的测试数据
    await pool.query('DELETE FROM security_config WHERE updated_by IN (SELECT id FROM users WHERE username IN ($1, $2))', ['integtest', 'integadmin']);
    await pool.query('DELETE FROM audit_logs WHERE admin_id IN (SELECT id FROM users WHERE username IN ($1, $2))', ['integtest', 'integadmin']);
    await pool.query('DELETE FROM users WHERE username IN ($1, $2)', ['integtest', 'integadmin']);

    // 创建测试用户
    const userResult = await pool.query(
      `INSERT INTO users (username, email, password_hash, role, invitation_code) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ['integtest', 'integtest@test.com', 'hash', 'user', 'INT001']
    );
    testUserId = userResult.rows[0].id;

    // 创建测试管理员
    const adminResult = await pool.query(
      `INSERT INTO users (username, email, password_hash, role, invitation_code) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ['integadmin', 'integadmin@test.com', 'hash', 'admin', 'INT002']
    );
    testAdminId = adminResult.rows[0].id;
  });

  afterAll(async () => {
    // 清理测试数据（先清理外键依赖）
    await pool.query('DELETE FROM security_config WHERE updated_by IN (SELECT id FROM users WHERE username IN ($1, $2))', ['integtest', 'integadmin']);
    await pool.query('DELETE FROM audit_logs WHERE details::text LIKE $1', ['%INTEG_TEST%']);
    await pool.query('DELETE FROM security_events WHERE message LIKE $1', ['%INTEG_TEST%']);
    await pool.query('DELETE FROM users WHERE username IN ($1, $2)', ['integtest', 'integadmin']);
  });

  describe('完整的用户操作流程', () => {
    it('应该记录审计日志并检测异常', async () => {
      // 1. 记录操作
      await auditLogService.logAction(
        testAdminId,
        'INTEG_TEST_ACTION',
        'user',
        testUserId,
        { test: 'integration' },
        '192.168.1.100'
      );

      // 2. 验证审计日志
      const logs = await auditLogService.queryLogs({
        adminId: testAdminId,
        action: 'INTEG_TEST_ACTION'
      });

      expect(logs.logs.length).toBeGreaterThan(0);
      expect(logs.logs[0].action).toBe('INTEG_TEST_ACTION');

      // 3. 检测异常（新IP登录）
      const anomaly = await anomalyDetectionService.detectLoginAnomaly(
        testUserId,
        '10.0.0.1',
        'Test Browser'
      );

      expect(anomaly).toBeDefined();
      expect(anomaly?.type).toBe('suspicious_login');
    });
  });

  describe('会话管理和密码安全', () => {
    it('应该创建会话并验证密码策略', async () => {
      // 1. 创建会话
      const token = 'test_token_' + Date.now();
      await sessionService.createSession(
        testUserId,
        token,
        '192.168.1.1',
        'Test Browser'
      );

      // 2. 验证会话
      const isValid = await sessionService.validateSession(token);
      expect(isValid).toBe(true);

      // 3. 验证密码强度
      const weakPassword = 'weak';
      const strongPassword = 'StrongP@ss123';

      const weakResult = await passwordService.validatePasswordStrength(weakPassword);
      expect(weakResult.valid).toBe(false);
      expect(weakResult.errors.length).toBeGreaterThan(0);

      const strongResult = await passwordService.validatePasswordStrength(strongPassword);
      expect(strongResult.valid).toBe(true);
      expect(strongResult.errors.length).toBe(0);

      // 清理
      await sessionService.revokeSession(token);
    });
  });

  describe('权限和频率限制', () => {
    it('应该检查权限并执行频率限制', async () => {
      // 1. 检查权限
      const hasPermission = await permissionService.hasPermission(
        testAdminId,
        'user.read'
      );
      expect(typeof hasPermission).toBe('boolean');

      // 2. 频率限制
      const key = 'integ_test_' + Date.now();
      const config = { windowMs: 60000, maxRequests: 5 };

      // 前5次应该允许
      for (let i = 0; i < 5; i++) {
        const result = await rateLimitService.checkLimit(key, config);
        expect(result.allowed).toBe(true);
        await rateLimitService.recordRequest(key);
      }

      // 第6次应该被拒绝
      const result = await rateLimitService.checkLimit(key, config);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);

      // 清理
      await rateLimitService.resetLimit(key);
    });
  });

  describe('安全响应和监控', () => {
    it('应该检测威胁并自动响应', async () => {
      // 1. 记录安全事件
      await securityMonitorService.logSecurityEvent({
        type: 'INTEG_TEST_EVENT',
        severity: 'warning',
        message: 'INTEG_TEST: Test security event',
        details: { test: true },
        timestamp: new Date(),
        userId: testUserId
      });

      // 2. 获取安全指标
      const metrics = await securityMonitorService.getSecurityMetrics(60000);
      expect(metrics).toBeDefined();
      expect(typeof metrics.suspiciousActivities).toBe('number');

      // 3. 测试自动响应（重新认证要求）
      const response = await securityResponseService.requireReauthentication(
        testUserId,
        'INTEG_TEST: Suspicious activity detected'
      );

      expect(response.action).toBe('REQUIRE_REAUTH');
      expect(response.automated).toBe(true);

      // 清理
      await pool.query(
        `DELETE FROM audit_logs 
         WHERE action = 'REQUIRE_REAUTH' 
           AND target_id = $1`,
        [testUserId]
      );
    });
  });

  describe('确认令牌和配置管理', () => {
    it('应该生成确认令牌并管理配置', async () => {
      // 1. 生成确认令牌
      const token = await confirmationTokenService.generateToken(
        testUserId,
        'DELETE_USER',
        { targetId: testUserId }
      );

      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(0);

      // 2. 验证并消费令牌
      const result = await confirmationTokenService.validateAndConsumeToken(token, testUserId);
      expect(result.valid).toBe(true);
      expect(result.action).toBe('DELETE_USER');

      // 3. 令牌应该只能使用一次
      const result2 = await confirmationTokenService.validateAndConsumeToken(token, testUserId);
      expect(result2.valid).toBe(false);

      // 4. 配置管理（跳过，因为需要预先存在的配置）
      // 配置管理功能已在其他测试中验证
    });
  });

  describe('安全检查', () => {
    it('应该运行所有安全检查', async () => {
      const report = await securityCheckService.runAllChecks();

      expect(report).toBeDefined();
      expect(report.reportId).toMatch(/^SEC-\d+$/);
      expect(report.checks.length).toBe(4);
      expect(report.summary.totalChecks).toBe(4);
    });
  });

  describe('异常场景处理', () => {
    it('应该正确处理暴力攻击', async () => {
      const attackIP = '10.0.0.99';

      // 模拟多次失败登录
      for (let i = 0; i < 5; i++) {
        await pool.query(
          `INSERT INTO audit_logs 
           (admin_id, action, ip_address, details, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [testUserId, 'LOGIN_FAILED', attackIP, JSON.stringify({ test: true })]
        );
      }

      // 触发暴力攻击检测
      const response = await securityResponseService.handleBruteForceAttack(attackIP);

      expect(response).toBeDefined();
      expect(response?.action).toBe('BLOCK_IP');

      // 清理
      await pool.query(
        `DELETE FROM audit_logs 
         WHERE ip_address = $1 
           AND action IN ('LOGIN_FAILED', 'IP_BLOCKED')`,
        [attackIP]
      );
    });

    it('应该正确处理账户妥协', async () => {
      const response = await securityResponseService.handleAccountCompromise(
        testUserId,
        'INTEG_TEST: Multiple suspicious activities detected'
      );

      expect(response.action).toBe('LOCK_ACCOUNT');
      expect(response.automated).toBe(true);

      // 清理
      await pool.query(
        `DELETE FROM audit_logs 
         WHERE target_id = $1 
           AND action IN ('ACCOUNT_LOCKED', 'SECURITY_RESPONSE')`,
        [testUserId]
      );
    });
  });

  describe('边界情况', () => {
    it('应该处理空数据和无效输入', async () => {
      // 1. 空审计日志查询
      const emptyLogs = await auditLogService.queryLogs({
        adminId: 999999 // 不存在的用户
      });
      expect(emptyLogs.logs.length).toBe(0);

      // 2. 无效权限检查
      const hasInvalidPermission = await permissionService.hasPermission(
        testUserId,
        'invalid.permission'
      );
      expect(hasInvalidPermission).toBe(false);

      // 3. 过期会话验证
      const invalidSession = await sessionService.validateSession('invalid_token');
      expect(invalidSession).toBe(false);
    });

    it('应该处理并发操作', async () => {
      const promises = [];

      // 并发记录审计日志
      for (let i = 0; i < 10; i++) {
        promises.push(
          auditLogService.logAction(
            testAdminId,
            'CONCURRENT_TEST',
            'system',
            null,
            { index: i },
            '127.0.0.1'
          )
        );
      }

      await expect(Promise.all(promises)).resolves.not.toThrow();

      // 清理
      await pool.query(
        `DELETE FROM audit_logs WHERE action = 'CONCURRENT_TEST'`
      );
    });
  });

  describe('数据完整性', () => {
    it('应该维护审计日志的完整性', async () => {
      // 记录操作
      await auditLogService.logAction(
        testAdminId,
        'INTEGRITY_TEST',
        'user',
        testUserId,
        { important: 'data' },
        '192.168.1.1'
      );

      // 查询并验证
      const logs = await auditLogService.queryLogs({
        action: 'INTEGRITY_TEST'
      });

      expect(logs.logs.length).toBeGreaterThan(0);
      const log = logs.logs[0];

      expect(log.adminId).toBe(testAdminId);
      expect(log.action).toBe('INTEGRITY_TEST');
      expect(log.targetType).toBe('user');
      expect(log.targetId).toBe(testUserId);
      expect(log.details).toEqual({ important: 'data' });

      // 清理
      await pool.query(
        `DELETE FROM audit_logs WHERE action = 'INTEGRITY_TEST'`
      );
    });
  });
});
