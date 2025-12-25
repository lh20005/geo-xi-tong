import { ConfigHistoryService } from '../ConfigHistoryService';
import { pool } from '../../db/database';
import fc from 'fast-check';

/**
 * Feature: system-security-foundation
 * Property 13: 配置历史记录
 * Property 14: 配置回滚正确性
 * Property 15: 回滚操作审计
 * 
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4
 */

describe('ConfigHistoryService', () => {
  let configHistoryService: ConfigHistoryService;
  let testUserId: number;

  beforeAll(async () => {
    // 创建测试用户
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, role, email, invitation_code) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      ['config_test_user', 'hashed_password', 'admin', 'config@test.com', 'CFG001']
    );
    testUserId = result.rows[0].id;
  });

  beforeEach(() => {
    configHistoryService = new ConfigHistoryService();
  });

  afterEach(async () => {
    // 清理测试数据
    await pool.query('DELETE FROM config_history WHERE changed_by = $1', [testUserId]);
  });

  afterAll(async () => {
    // 删除测试用户
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
  });

  describe('Property 13: Configuration History Recording', () => {
    test('should record configuration change', async () => {
      const configKey = 'test.setting';
      const oldValue = { enabled: false };
      const newValue = { enabled: true };
      const ipAddress = '192.168.1.1';

      const historyId = await configHistoryService.recordChange(
        configKey,
        oldValue,
        newValue,
        testUserId,
        ipAddress
      );

      expect(historyId).toBeGreaterThan(0);

      // 验证记录已保存
      const history = await configHistoryService.getHistory(configKey, 1);
      expect(history.length).toBe(1);
      expect(history[0].configKey).toBe(configKey);
      expect(history[0].changedBy).toBe(testUserId);
    });

    test('should store old and new values', async () => {
      const configKey = 'test.setting';
      const oldValue = { count: 10, enabled: false };
      const newValue = { count: 20, enabled: true };

      await configHistoryService.recordChange(
        configKey,
        oldValue,
        newValue,
        testUserId,
        '127.0.0.1'
      );

      const history = await configHistoryService.getHistory(configKey, 1);
      expect(JSON.parse(history[0].oldValue)).toEqual(oldValue);
      expect(JSON.parse(history[0].newValue)).toEqual(newValue);
    });

    test('Property 13: All configuration changes should be recorded', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 50 }),
          fc.record({
            value: fc.integer({ min: 0, max: 1000 }),
            enabled: fc.boolean()
          }),
          fc.record({
            value: fc.integer({ min: 0, max: 1000 }),
            enabled: fc.boolean()
          }),
          async (configKey, oldValue, newValue) => {
            const historyId = await configHistoryService.recordChange(
              configKey,
              oldValue,
              newValue,
              testUserId,
              '127.0.0.1'
            );

            // Property: Change should be recorded
            expect(historyId).toBeGreaterThan(0);

            // Property: History should be retrievable
            const history = await configHistoryService.getHistory(configKey, 1);
            expect(history.length).toBeGreaterThan(0);
            expect(history[0].configKey).toBe(configKey);

            // Cleanup
            await pool.query('DELETE FROM config_history WHERE id = $1', [historyId]);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should maintain history order', async () => {
      const configKey = 'test.counter';

      // 记录多次变更
      for (let i = 0; i < 5; i++) {
        await configHistoryService.recordChange(
          configKey,
          { count: i },
          { count: i + 1 },
          testUserId,
          '127.0.0.1'
        );
      }

      const history = await configHistoryService.getHistory(configKey, 10);
      expect(history.length).toBe(5);

      // 应该按时间倒序排列（最新的在前）
      for (let i = 0; i < history.length - 1; i++) {
        expect(history[i].createdAt.getTime()).toBeGreaterThanOrEqual(
          history[i + 1].createdAt.getTime()
        );
      }
    });
  });

  describe('Property 14: Configuration Rollback Correctness', () => {
    test('should rollback to previous value', async () => {
      const configKey = 'test.rollback';
      const oldValue = { version: 1 };
      const newValue = { version: 2 };

      // 记录变更
      const historyId = await configHistoryService.recordChange(
        configKey,
        oldValue,
        newValue,
        testUserId,
        '127.0.0.1'
      );

      // 回滚
      const rollbackResult = await configHistoryService.rollback(
        historyId,
        testUserId,
        '127.0.0.1'
      );

      expect(rollbackResult.configKey).toBe(configKey);
      expect(JSON.parse(rollbackResult.rolledBackValue)).toEqual(oldValue);
    });

    test('Property 14: Rollback should restore exact previous value', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 50 }),
          fc.record({
            setting1: fc.string(),
            setting2: fc.integer(),
            setting3: fc.boolean()
          }),
          fc.record({
            setting1: fc.string(),
            setting2: fc.integer(),
            setting3: fc.boolean()
          }),
          async (configKey, oldValue, newValue) => {
            // 记录变更
            const historyId = await configHistoryService.recordChange(
              configKey,
              oldValue,
              newValue,
              testUserId,
              '127.0.0.1'
            );

            // 回滚
            const rollbackResult = await configHistoryService.rollback(
              historyId,
              testUserId,
              '127.0.0.1'
            );

            // Property: Rolled back value should match old value
            expect(JSON.parse(rollbackResult.rolledBackValue)).toEqual(oldValue);

            // Cleanup
            await pool.query('DELETE FROM config_history WHERE config_key = $1', [configKey]);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should fail rollback for non-existent history', async () => {
      await expect(
        configHistoryService.rollback(999999, testUserId, '127.0.0.1')
      ).rejects.toThrow('History record not found');
    });
  });

  describe('Property 15: Rollback Operation Audit', () => {
    test('should record rollback as new change', async () => {
      const configKey = 'test.audit';
      const oldValue = { state: 'old' };
      const newValue = { state: 'new' };

      // 记录初始变更
      const historyId = await configHistoryService.recordChange(
        configKey,
        oldValue,
        newValue,
        testUserId,
        '127.0.0.1'
      );

      // 获取变更前的历史记录数
      const historyBefore = await configHistoryService.getHistory(configKey, 10);
      const countBefore = historyBefore.length;

      // 执行回滚
      await configHistoryService.rollback(historyId, testUserId, '127.0.0.1');

      // 获取变更后的历史记录数
      const historyAfter = await configHistoryService.getHistory(configKey, 10);
      const countAfter = historyAfter.length;

      // Property: Rollback should create new history entry
      expect(countAfter).toBe(countBefore + 1);

      // 最新的记录应该是回滚操作
      const latestChange = historyAfter[0];
      expect(JSON.parse(latestChange.newValue)).toEqual(oldValue);
    });

    test('Property 15: All rollbacks should be audited', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 50 }),
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 101, max: 200 }),
          async (configKey, value1, value2) => {
            // 记录变更
            const historyId = await configHistoryService.recordChange(
              configKey,
              { value: value1 },
              { value: value2 },
              testUserId,
              '127.0.0.1'
            );

            const historyBefore = await configHistoryService.getHistory(configKey, 10);

            // 执行回滚
            await configHistoryService.rollback(historyId, testUserId, '127.0.0.1');

            const historyAfter = await configHistoryService.getHistory(configKey, 10);

            // Property: Rollback should add one more history entry
            expect(historyAfter.length).toBe(historyBefore.length + 1);

            // Cleanup
            await pool.query('DELETE FROM config_history WHERE config_key = $1', [configKey]);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Unit Tests: Additional Functionality', () => {
    test('should get all history', async () => {
      // 创建多个配置的历史
      await configHistoryService.recordChange('config1', {}, { v: 1 }, testUserId, '127.0.0.1');
      await configHistoryService.recordChange('config2', {}, { v: 2 }, testUserId, '127.0.0.1');
      await configHistoryService.recordChange('config3', {}, { v: 3 }, testUserId, '127.0.0.1');

      const allHistory = await configHistoryService.getAllHistory(10);
      expect(allHistory.length).toBeGreaterThanOrEqual(3);
    });

    test('should get current value', async () => {
      const configKey = 'test.current';
      const value1 = { version: 1 };
      const value2 = { version: 2 };
      const value3 = { version: 3 };

      await configHistoryService.recordChange(configKey, {}, value1, testUserId, '127.0.0.1');
      await configHistoryService.recordChange(configKey, value1, value2, testUserId, '127.0.0.1');
      await configHistoryService.recordChange(configKey, value2, value3, testUserId, '127.0.0.1');

      const currentValue = await configHistoryService.getCurrentValue(configKey);
      expect(JSON.parse(currentValue!)).toEqual(value3);
    });

    test('should get change statistics', async () => {
      const configKey = 'test.stats';

      await configHistoryService.recordChange(configKey, {}, { v: 1 }, testUserId, '127.0.0.1');
      await configHistoryService.recordChange(configKey, { v: 1 }, { v: 2 }, testUserId, '127.0.0.1');

      const stats = await configHistoryService.getChangeStats(configKey);
      expect(stats.totalChanges).toBeGreaterThanOrEqual(2);
      expect(stats.uniqueUsers).toBeGreaterThanOrEqual(1);
      expect(stats.lastChange).toBeInstanceOf(Date);
    });

    test('should limit history results', async () => {
      const configKey = 'test.limit';

      // 创建10条记录
      for (let i = 0; i < 10; i++) {
        await configHistoryService.recordChange(
          configKey,
          { v: i },
          { v: i + 1 },
          testUserId,
          '127.0.0.1'
        );
      }

      const history = await configHistoryService.getHistory(configKey, 5);
      expect(history.length).toBe(5);
    });
  });
});
