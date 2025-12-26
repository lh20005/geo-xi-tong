/**
 * 性能测试
 * 测试关键安全功能的性能指标
 */

import { pool } from '../db/database';
import { auditLogService } from '../services/AuditLogService';
import { rateLimitService } from '../services/RateLimitService';
import { permissionService } from '../services/PermissionService';

describe('Performance Tests', () => {
  let testUserId: number;

  beforeAll(async () => {
    // 创建测试用户
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, role, invitation_code) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ['perftest', 'perftest@test.com', 'hash', 'admin', 'PERF01']
    );
    testUserId = result.rows[0].id;
  });

  afterAll(async () => {
    // 清理测试数据
    await pool.query('DELETE FROM users WHERE username = $1', ['perftest']);
  });

  describe('审计日志性能', () => {
    it('应该在100ms内记录单条审计日志', async () => {
      const start = Date.now();
      
      await auditLogService.logAction(
        testUserId,
        'PERF_TEST',
        'system',
        null,
        { test: true },
        '127.0.0.1'
      );
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100);
    });

    it('应该在1秒内记录100条审计日志', async () => {
      const start = Date.now();
      
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          auditLogService.logAction(
            testUserId,
            'PERF_TEST_BATCH',
            'system',
            null,
            { index: i },
            '127.0.0.1'
          )
        );
      }
      
      await Promise.all(promises);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000);
      
      // 清理
      await pool.query(
        `DELETE FROM audit_logs WHERE action IN ('PERF_TEST_BATCH')`
      );
    });
  });

  describe('频率限制性能', () => {
    it('应该在10ms内检查频率限制', async () => {
      const key = 'perf_test_' + Date.now();
      const config = { windowMs: 60000, maxRequests: 100 };
      
      const start = Date.now();
      await rateLimitService.checkLimit(key, config);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(10);
      
      // 清理
      await rateLimitService.resetLimit(key);
    });

    it('应该在100ms内处理100次频率限制检查', async () => {
      const key = 'perf_test_batch_' + Date.now();
      const config = { windowMs: 60000, maxRequests: 1000 };
      
      const start = Date.now();
      
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(rateLimitService.checkLimit(key + i, config));
      }
      
      await Promise.all(promises);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100);
      
      // 清理
      for (let i = 0; i < 100; i++) {
        await rateLimitService.resetLimit(key + i);
      }
    });
  });

  describe('权限检查性能', () => {
    it('应该在50ms内检查单个权限', async () => {
      const start = Date.now();
      
      await permissionService.hasPermission(testUserId, 'user.read');
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(50);
    });

    it('应该在200ms内检查100个权限', async () => {
      const start = Date.now();
      
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(permissionService.hasPermission(testUserId, 'user.read'));
      }
      
      await Promise.all(promises);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(200);
    });
  });

  describe('数据库查询性能', () => {
    it('审计日志查询应该在200ms内完成', async () => {
      const start = Date.now();
      
      await auditLogService.queryLogs({
        adminId: testUserId,
        pageSize: 50
      });
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(200);
    });

    it('权限列表查询应该在100ms内完成', async () => {
      const start = Date.now();
      
      await permissionService.getUserPermissions(testUserId);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100);
    });
  });
});
