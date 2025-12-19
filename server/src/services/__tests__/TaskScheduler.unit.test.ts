/**
 * Unit tests for TaskScheduler
 * Feature: publishing-task-reliability
 */

import { pool } from '../../db/database';
import { publishingService } from '../PublishingService';

describe('TaskScheduler Unit Tests', () => {
  beforeAll(async () => {
    await pool.query('SELECT 1');
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM publishing_logs');
    await pool.query('DELETE FROM publishing_tasks');
  });

  describe('getPendingScheduledTasks', () => {
    /**
     * Test: Retry tasks are included in results
     * Validates: Requirements 1.1, 1.2
     */
    test('should include retry tasks (retry_count > 0)', async () => {
      // 创建一个重试任务
      const result = await pool.query(
        `INSERT INTO publishing_tasks 
         (article_id, account_id, platform_id, config, status, retry_count, max_retries, scheduled_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [1, 1, 'wangyi', JSON.stringify({}), 'pending', 2, 3, new Date('2026-12-31')]
      );

      const taskId = result.rows[0].id;

      const tasks = await publishingService.getPendingScheduledTasks();
      const foundTask = tasks.find(t => t.id === taskId);

      expect(foundTask).toBeDefined();
      expect(foundTask?.retry_count).toBe(2);

      await pool.query('DELETE FROM publishing_tasks WHERE id = $1', [taskId]);
    });

    /**
     * Test: Scheduled tasks with scheduled_at <= now are included
     * Validates: Requirements 1.1, 1.2
     */
    test('should include scheduled tasks when scheduled_at <= now', async () => {
      const pastDate = new Date(Date.now() - 60000); // 1 minute ago

      const result = await pool.query(
        `INSERT INTO publishing_tasks 
         (article_id, account_id, platform_id, config, status, retry_count, max_retries, scheduled_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [2, 1, 'souhu', JSON.stringify({}), 'pending', 0, 3, pastDate]
      );

      const taskId = result.rows[0].id;

      const tasks = await publishingService.getPendingScheduledTasks();
      const foundTask = tasks.find(t => t.id === taskId);

      expect(foundTask).toBeDefined();
      expect(foundTask?.scheduled_at).toBeDefined();

      await pool.query('DELETE FROM publishing_tasks WHERE id = $1', [taskId]);
    });

    /**
     * Test: Immediate tasks (scheduled_at = null) are included
     * Validates: Requirements 1.1, 1.2
     */
    test('should include immediate tasks (scheduled_at = null)', async () => {
      const result = await pool.query(
        `INSERT INTO publishing_tasks 
         (article_id, account_id, platform_id, config, status, retry_count, max_retries, scheduled_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [3, 1, 'baijiahao', JSON.stringify({}), 'pending', 0, 3, null]
      );

      const taskId = result.rows[0].id;

      const tasks = await publishingService.getPendingScheduledTasks();
      const foundTask = tasks.find(t => t.id === taskId);

      expect(foundTask).toBeDefined();
      expect(foundTask?.scheduled_at).toBeUndefined();

      await pool.query('DELETE FROM publishing_tasks WHERE id = $1', [taskId]);
    });

    /**
     * Test: Future scheduled tasks without retry are NOT included
     * Validates: Requirements 1.1, 1.2
     */
    test('should NOT include future scheduled tasks without retry', async () => {
      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now

      const result = await pool.query(
        `INSERT INTO publishing_tasks 
         (article_id, account_id, platform_id, config, status, retry_count, max_retries, scheduled_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [4, 1, 'toutiao', JSON.stringify({}), 'pending', 0, 3, futureDate]
      );

      const taskId = result.rows[0].id;

      const tasks = await publishingService.getPendingScheduledTasks();
      const foundTask = tasks.find(t => t.id === taskId);

      expect(foundTask).toBeUndefined();

      await pool.query('DELETE FROM publishing_tasks WHERE id = $1', [taskId]);
    });

    /**
     * Test: Running tasks are NOT included
     * Validates: Requirements 7.4
     */
    test('should NOT include running tasks', async () => {
      const result = await pool.query(
        `INSERT INTO publishing_tasks 
         (article_id, account_id, platform_id, config, status, retry_count, max_retries)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [5, 1, 'wangyi', JSON.stringify({}), 'running', 0, 3]
      );

      const taskId = result.rows[0].id;

      const tasks = await publishingService.getPendingScheduledTasks();
      const foundTask = tasks.find(t => t.id === taskId);

      expect(foundTask).toBeUndefined();

      await pool.query('DELETE FROM publishing_tasks WHERE id = $1', [taskId]);
    });
  });
});
