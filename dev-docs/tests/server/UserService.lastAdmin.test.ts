/**
 * 用户服务 - 最后管理员保护测试
 * Feature: system-security-foundation
 * Property 1: 最后管理员保护
 * Property 2: 管理员计数准确性
 */

import { userService } from '../UserService';
import { pool } from '../../db/database';
import fc from 'fast-check';
import fs from 'fs';
import path from 'path';

describe('UserService - Last Admin Protection', () => {
  let testUsers: Array<{ id: number; username: string; role: string }> = [];

  // 设置测试环境
  beforeAll(async () => {
    // 运行迁移创建表
    const migrationPath = path.join(__dirname, '../../db/migrations/001_create_security_tables.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(migrationSql);
  });

  // 清理测试数据
  beforeEach(async () => {
    // 清理测试用户
    await pool.query(`DELETE FROM users WHERE username LIKE 'test_last_admin_%'`);
    testUsers = [];
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM users WHERE username LIKE 'test_last_admin_%'`);
    await pool.end();
  });

  /**
   * 辅助函数: 创建测试用户
   */
  async function createTestUser(username: string, role: 'admin' | 'user', invitationCode: string) {
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, role, invitation_code) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, username, role`,
      [username, 'hashed_password', role, invitationCode]
    );
    return result.rows[0];
  }

  /**
   * 辅助函数: 统计所有管理员数量
   */
  async function countAllAdmins(): Promise<number> {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM users WHERE role = 'admin'`
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * 辅助函数: 删除所有非测试管理员(保留一个测试管理员)
   */
  async function setupSingleTestAdmin(): Promise<{ id: number; username: string; role: string }> {
    // 删除所有测试管理员
    await pool.query(`DELETE FROM users WHERE username LIKE 'test_last_admin_%'`);
    
    // 获取所有现有管理员
    const existingAdmins = await pool.query(
      `SELECT id FROM users WHERE role = 'admin' ORDER BY id`
    );
    
    // 如果有多个管理员,删除除第一个外的所有管理员
    if (existingAdmins.rows.length > 1) {
      const idsToDelete = existingAdmins.rows.slice(1).map(r => r.id);
      await pool.query(
        `UPDATE users SET role = 'user' WHERE id = ANY($1::int[])`,
        [idsToDelete]
      );
    }
    
    // 创建一个测试管理员
    const admin = await createTestUser('test_last_admin_single', 'admin', 'SINGLE');
    
    // 如果有其他管理员,将其降权
    if (existingAdmins.rows.length > 0) {
      await pool.query(
        `UPDATE users SET role = 'user' WHERE id != $1 AND role = 'admin'`,
        [admin.id]
      );
    }
    
    return admin;
  }

  /**
   * Property 1: 最后管理员保护
   * For any user deletion or role change operation, if the target user 
   * is the last admin, then the operation should be rejected.
   * Validates: Requirements 1.1, 1.2, 1.4
   */
  describe('Property 1: 最后管理员保护', () => {
    test('不能删除最后一个管理员', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            invitationCode: fc.string({ minLength: 6, maxLength: 6 })
          }),
          async (data) => {
            // 设置只有一个管理员的环境
            const admin = await setupSingleTestAdmin();

            // 验证只有一个管理员
            const adminCount = await countAllAdmins();
            expect(adminCount).toBe(1);

            // 尝试删除最后一个管理员 - 应该失败
            await expect(
              userService.deleteUser(admin.id)
            ).rejects.toThrow('不能删除最后一个管理员');

            // 验证管理员仍然存在
            const stillExists = await pool.query(
              'SELECT id FROM users WHERE id = $1',
              [admin.id]
            );
            expect(stillExists.rows.length).toBe(1);

            // 清理
            await pool.query('DELETE FROM users WHERE id = $1', [admin.id]);
          }
        ),
        { numRuns: 20 } // 减少运行次数因为需要设置环境
      );
    });

    test('不能降权最后一个管理员', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            invitationCode: fc.string({ minLength: 6, maxLength: 6 })
          }),
          async (data) => {
            // 设置只有一个管理员的环境
            const admin = await setupSingleTestAdmin();

            // 验证只有一个管理员
            const adminCount = await countAllAdmins();
            expect(adminCount).toBe(1);

            // 尝试降权最后一个管理员 - 应该失败
            await expect(
              userService.updateUser(admin.id, { role: 'user' })
            ).rejects.toThrow('不能降权最后一个管理员');

            // 验证管理员角色未改变
            const stillAdmin = await pool.query(
              'SELECT role FROM users WHERE id = $1',
              [admin.id]
            );
            expect(stillAdmin.rows[0].role).toBe('admin');

            // 清理
            await pool.query('DELETE FROM users WHERE id = $1', [admin.id]);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('有多个管理员时可以删除其中一个', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            admin1Username: fc.string({ minLength: 5, maxLength: 20 }).map(s => `test_last_admin_1_${s}`),
            admin2Username: fc.string({ minLength: 5, maxLength: 20 }).map(s => `test_last_admin_2_${s}`),
            code1: fc.string({ minLength: 6, maxLength: 6 }),
            code2: fc.string({ minLength: 6, maxLength: 6 })
          }),
          async (data) => {
            // 确保用户名和邀请码不同
            if (data.admin1Username === data.admin2Username || data.code1 === data.code2) {
              return; // 跳过这个测试用例
            }

            // 设置只有一个管理员
            await setupSingleTestAdmin();
            
            // 创建两个额外的管理员
            const admin1 = await createTestUser(data.admin1Username, 'admin', data.code1);
            const admin2 = await createTestUser(data.admin2Username, 'admin', data.code2);
            testUsers.push(admin1, admin2);

            // 验证有至少两个管理员
            const adminCount = await countAllAdmins();
            expect(adminCount).toBeGreaterThanOrEqual(2);

            // 删除第一个管理员 - 应该成功
            await userService.deleteUser(admin1.id);

            // 验证第一个管理员已删除
            const deleted = await pool.query(
              'SELECT id FROM users WHERE id = $1',
              [admin1.id]
            );
            expect(deleted.rows.length).toBe(0);

            // 验证第二个管理员仍然存在
            const stillExists = await pool.query(
              'SELECT id FROM users WHERE id = $1',
              [admin2.id]
            );
            expect(stillExists.rows.length).toBe(1);

            // 清理
            await pool.query('DELETE FROM users WHERE id = $1', [admin2.id]);
          }
        ),
        { numRuns: 20 } // 减少运行次数因为需要创建两个用户
      );
    });

    test('有多个管理员时可以降权其中一个', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            admin1Username: fc.string({ minLength: 5, maxLength: 20 }).map(s => `test_last_admin_1_${s}`),
            admin2Username: fc.string({ minLength: 5, maxLength: 20 }).map(s => `test_last_admin_2_${s}`),
            code1: fc.string({ minLength: 6, maxLength: 6 }),
            code2: fc.string({ minLength: 6, maxLength: 6 })
          }),
          async (data) => {
            // 确保用户名和邀请码不同
            if (data.admin1Username === data.admin2Username || data.code1 === data.code2) {
              return; // 跳过这个测试用例
            }

            // 设置只有一个管理员
            await setupSingleTestAdmin();
            
            // 创建两个额外的管理员
            const admin1 = await createTestUser(data.admin1Username, 'admin', data.code1);
            const admin2 = await createTestUser(data.admin2Username, 'admin', data.code2);
            testUsers.push(admin1, admin2);

            // 验证有至少两个管理员
            const adminCount = await countAllAdmins();
            expect(adminCount).toBeGreaterThanOrEqual(2);

            // 降权第一个管理员 - 应该成功
            await userService.updateUser(admin1.id, { role: 'user' });

            // 验证第一个管理员已降权
            const demoted = await pool.query(
              'SELECT role FROM users WHERE id = $1',
              [admin1.id]
            );
            expect(demoted.rows[0].role).toBe('user');

            // 验证第二个管理员仍然是管理员
            const stillAdmin = await pool.query(
              'SELECT role FROM users WHERE id = $1',
              [admin2.id]
            );
            expect(stillAdmin.rows[0].role).toBe('admin');

            // 清理
            await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [admin1.id, admin2.id]);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 2: 管理员计数准确性
   * For any database state, counting users with role='admin' should 
   * return the exact number of admin users in the system.
   * Validates: Requirements 1.3
   */
  describe('Property 2: 管理员计数准确性', () => {
    test('管理员计数应该准确反映数据库状态', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              username: fc.string({ minLength: 5, maxLength: 20 }),
              role: fc.constantFrom('admin', 'user'),
              invitationCode: fc.string({ minLength: 6, maxLength: 6 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (users) => {
            // 创建用户
            const createdUsers = [];
            for (let i = 0; i < users.length; i++) {
              const user = users[i];
              const username = `test_last_admin_count_${i}_${user.username}`;
              const code = `${user.invitationCode}${i}`.substring(0, 6);
              
              try {
                const created = await createTestUser(username, user.role as any, code);
                createdUsers.push(created);
              } catch (error) {
                // 跳过重复的邀请码
                continue;
              }
            }

            // 计算预期的管理员数量
            const expectedAdminCount = createdUsers.filter(u => u.role === 'admin').length;

            // 查询实际的管理员数量
            const actualAdminCount = await pool.query(
              `SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND username LIKE 'test_last_admin_count_%'`
            );
            const actualCount = parseInt(actualAdminCount.rows[0].count);

            // 验证计数准确
            expect(actualCount).toBe(expectedAdminCount);

            // 清理
            await pool.query(`DELETE FROM users WHERE username LIKE 'test_last_admin_count_%'`);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // 单元测试 - 具体示例
  describe('Unit Tests', () => {
    test('应该拒绝删除唯一的管理员', async () => {
      const admin = await setupSingleTestAdmin();
      
      await expect(
        userService.deleteUser(admin.id)
      ).rejects.toThrow('不能删除最后一个管理员');

      // 清理
      await pool.query('DELETE FROM users WHERE id = $1', [admin.id]);
    });

    test('应该拒绝降权唯一的管理员', async () => {
      const admin = await setupSingleTestAdmin();
      
      await expect(
        userService.updateUser(admin.id, { role: 'user' })
      ).rejects.toThrow('不能降权最后一个管理员');

      // 清理
      await pool.query('DELETE FROM users WHERE id = $1', [admin.id]);
    });

    test('应该允许删除非最后的管理员', async () => {
      const admin1 = await createTestUser('test_last_admin_del1', 'admin', 'DEL001');
      const admin2 = await createTestUser('test_last_admin_del2', 'admin', 'DEL002');
      
      await userService.deleteUser(admin1.id);

      const deleted = await pool.query('SELECT id FROM users WHERE id = $1', [admin1.id]);
      expect(deleted.rows.length).toBe(0);

      // 清理
      await pool.query('DELETE FROM users WHERE id = $1', [admin2.id]);
    });

    test('应该允许降权非最后的管理员', async () => {
      const admin1 = await createTestUser('test_last_admin_dem1', 'admin', 'DEM001');
      const admin2 = await createTestUser('test_last_admin_dem2', 'admin', 'DEM002');
      
      await userService.updateUser(admin1.id, { role: 'user' });

      const demoted = await pool.query('SELECT role FROM users WHERE id = $1', [admin1.id]);
      expect(demoted.rows[0].role).toBe('user');

      // 清理
      await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [admin1.id, admin2.id]);
    });
  });
});
