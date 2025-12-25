/**
 * 审计日志服务测试
 * Feature: system-security-foundation
 * Property 3: 敏感操作审计完整性
 * Property 4: 审计日志持久化
 */

import { auditLogService } from '../AuditLogService';
import { pool } from '../../db/database';
import fc from 'fast-check';
import fs from 'fs';
import path from 'path';

describe('AuditLogService', () => {
  let testUserIds: number[] = [];

  // 设置测试环境
  beforeAll(async () => {
    // 运行迁移创建表
    const migrationPath = path.join(__dirname, '../../db/migrations/001_create_security_tables.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(migrationSql);

    // 创建测试用户以满足外键约束
    for (let i = 1; i <= 10; i++) {
      const result = await pool.query(
        `INSERT INTO users (username, password_hash, role, invitation_code) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
         RETURNING id`,
        [`test_admin_${i}`, 'hashed_password', 'admin', `TST${i.toString().padStart(3, '0')}`]
      );
      testUserIds.push(result.rows[0].id);
    }
  });

  // 清理测试数据
  beforeEach(async () => {
    await pool.query('DELETE FROM audit_logs');
  });

  afterAll(async () => {
    // 清理测试用户
    await pool.query('DELETE FROM users WHERE username LIKE $1', ['test_admin_%']);
    await pool.end();
  });

  /**
   * Property 3: 敏感操作审计完整性
   * For any sensitive operation, an audit log entry should be created 
   * containing admin ID, action type, target info, details, IP address, 
   * user agent, and timestamp.
   * Validates: Requirements 2.1, 2.2, 2.3
   */
  describe('Property 3: 敏感操作审计完整性', () => {
    test('所有敏感操作都创建完整的审计日志', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            adminIdIndex: fc.integer({ min: 0, max: 9 }), // 使用索引选择测试用户
            action: fc.constantFrom('CREATE_USER', 'DELETE_USER', 'UPDATE_CONFIG', 'RESET_PASSWORD'),
            targetType: fc.constantFrom('user', 'config', 'system'),
            targetId: fc.integer({ min: 1, max: 1000 }),
            details: fc.record({
              field: fc.string(),
              oldValue: fc.string(),
              newValue: fc.string()
            }),
            ipAddress: fc.tuple(
              fc.integer({ min: 0, max: 255 }),
              fc.integer({ min: 0, max: 255 }),
              fc.integer({ min: 0, max: 255 }),
              fc.integer({ min: 0, max: 255 })
            ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),
            userAgent: fc.string()
          }),
          async (data) => {
            const adminId = testUserIds[data.adminIdIndex]; // 使用真实的测试用户ID
            
            // 记录操作
            await auditLogService.logAction(
              adminId,
              data.action,
              data.targetType as any,
              data.targetId,
              data.details,
              data.ipAddress,
              data.userAgent
            );

            // 查询日志
            const result = await auditLogService.queryLogs({
              adminId: adminId,
              action: data.action
            });

            // 验证日志存在且包含所有必需字段
            expect(result.logs.length).toBeGreaterThan(0);
            
            const log = result.logs[0];
            expect(log.adminId).toBe(adminId);
            expect(log.action).toBe(data.action);
            expect(log.targetType).toBe(data.targetType);
            expect(log.targetId).toBe(data.targetId);
            expect(log.ipAddress).toBe(data.ipAddress);
            expect(log.userAgent).toBe(data.userAgent);
            expect(log.details).toMatchObject(data.details);
            expect(log.createdAt).toBeInstanceOf(Date);
          }
        ),
        { numRuns: 100 } // 使用100次迭代
      );
    });
  });

  /**
   * Property 4: 审计日志持久化
   * For any audit log creation, the log entry should be immediately 
   * queryable from the database.
   * Validates: Requirements 2.4
   */
  describe('Property 4: 审计日志持久化', () => {
    test('审计日志立即持久化到数据库', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            adminIdIndex: fc.integer({ min: 0, max: 9 }), // 使用索引选择测试用户
            action: fc.string({ minLength: 3, maxLength: 50 }),
            ipAddress: fc.string()
          }),
          async (data) => {
            const adminId = testUserIds[data.adminIdIndex]; // 使用真实的测试用户ID
            
            // 记录日志
            await auditLogService.logAction(
              adminId,
              data.action,
              null,
              null,
              {},
              data.ipAddress
            );

            // 立即查询 - 应该能找到
            const result = await pool.query(
              'SELECT * FROM audit_logs WHERE admin_id = $1 AND action = $2 ORDER BY created_at DESC LIMIT 1',
              [adminId, data.action]
            );

            expect(result.rows.length).toBe(1);
            expect(result.rows[0].admin_id).toBe(adminId);
            expect(result.rows[0].action).toBe(data.action);
          }
        ),
        { numRuns: 100 } // 使用100次迭代
      );
    });
  });

  // 单元测试 - 具体示例
  describe('Unit Tests', () => {
    test('应该记录用户删除操作', async () => {
      const adminId = testUserIds[0]; // 使用第一个测试用户
      
      await auditLogService.logAction(
        adminId,
        'DELETE_USER',
        'user',
        123,
        { username: 'testuser' },
        '192.168.1.1',
        'Mozilla/5.0'
      );

      const logs = await auditLogService.queryLogs({ adminId });
      
      expect(logs.logs).toHaveLength(1);
      expect(logs.logs[0].action).toBe('DELETE_USER');
      expect(logs.logs[0].targetId).toBe(123);
    });

    test('应该支持按日期范围查询', async () => {
      const adminId = testUserIds[1]; // 使用第二个测试用户
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await auditLogService.logAction(adminId, 'TEST_ACTION', null, null, {}, '127.0.0.1');

      const logs = await auditLogService.queryLogs({
        startDate: yesterday,
        endDate: tomorrow
      });

      expect(logs.logs.length).toBeGreaterThan(0);
    });

    test('应该支持导出为JSON格式', async () => {
      const adminId = testUserIds[2]; // 使用第三个测试用户
      
      await auditLogService.logAction(adminId, 'EXPORT_TEST', null, null, {}, '127.0.0.1');

      const json = await auditLogService.exportLogs({}, 'json');
      const parsed = JSON.parse(json);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
    });

    test('应该支持导出为CSV格式', async () => {
      const adminId = testUserIds[3]; // 使用第四个测试用户
      
      await auditLogService.logAction(adminId, 'CSV_TEST', null, null, {}, '127.0.0.1');

      const csv = await auditLogService.exportLogs({}, 'csv');

      expect(csv).toContain('ID,Admin ID,Action');
      expect(csv).toContain('CSV_TEST');
    });
  });
});
