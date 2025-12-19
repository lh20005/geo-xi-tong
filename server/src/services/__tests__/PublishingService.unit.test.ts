/**
 * Unit tests for PublishingService
 * Feature: publishing-task-reliability
 */

import { pool } from '../../db/database';
import { publishingService } from '../PublishingService';

describe('PublishingService Unit Tests', () => {
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

  describe('updateTaskStatus', () => {
    /**
     * Test: started_at is set when status changes to running
     * Validates: Requirements 4.3, 2.4
     */
    test('should set started_at when status changes to running', async () => {
      const result = await pool.query(
        `INSERT INTO publishing_tasks 
         (article_id, account_id, platform_id, config, status, retry_count, max_retries)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [1, 1, 'wangyi', JSON.stringify({}), 'pending', 0, 3]
      );

      const taskId = result.rows[0].id;

      await publishingService.updateTaskStatus(taskId, 'running');

      const task = await publishingService.getTaskById(taskId);
      expect(task?.status).toBe('running');
      expect(task?.started_at).toBeDefined();

      await pool.query('DELETE FROM publishing_tasks WHERE id = $1', [taskId]);
    });

    /**
     * Test: completed_at is set when status changes to success
     * Validates: Requirements 4.3, 2.4
     */
    test('should set completed_at when status changes to success', async () => {
      const result = await pool.query(
        `INSERT INTO publishing_tasks 
         (article_id, account_id, platform_id, config, status, retry_count, max_retries)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [2, 1, 'souhu', JSON.stringify({}), 'running', 0, 3]
      );

      const taskId = result.rows[0].id;

      await publishingService.updateTaskStatus(taskId, 'success');

      const task = await publishingService.getTaskById(taskId);
      expect(task?.status).toBe('success');
      expect(task?.completed_at).toBeDefined();

      await pool.query('DELETE FROM publishing_tasks WHERE id = $1', [taskId]);
    });

    /**
     * Test: completed_at is set when status changes to failed
     * Validates: Requirements 4.3, 2.4
     */
    test('should set completed_at when status changes to failed', async () => {
      const result = await pool.query(
        `INSERT INTO publishing_tasks 
         (article_id, account_id, platform_id, config, status, retry_count, max_retries)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [3, 1, 'baijiahao', JSON.stringify({}), 'running', 3, 3]
      );

      const taskId = result.rows[0].id;

      await publishingService.updateTaskStatus(taskId, 'failed', '重试次数已用完');

      const task = await publishingService.getTaskById(taskId);
      expect(task?.status).toBe('failed');
      expect(task?.completed_at).toBeDefined();
      expect(task?.error_message).toBe('重试次数已用完');

      await pool.query('DELETE FROM publishing_tasks WHERE id = $1', [taskId]);
    });

    /**
     * Test: completed_at is set when status changes to cancelled
     * Validates: Requirements 4.3, 2.4
     */
    test('should set completed_at when status changes to cancelled', async () => {
      const result = await pool.query(
        `INSERT INTO publishing_tasks 
         (article_id, account_id, platform_id, config, status, retry_count, max_retries)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [4, 1, 'toutiao', JSON.stringify({}), 'pending', 0, 3]
      );

      const taskId = result.rows[0].id;

      await publishingService.updateTaskStatus(taskId, 'cancelled', '用户手动取消');

      const task = await publishingService.getTaskById(taskId);
      expect(task?.status).toBe('cancelled');
      expect(task?.completed_at).toBeDefined();
      expect(task?.error_message).toBe('用户手动取消');

      await pool.query('DELETE FROM publishing_tasks WHERE id = $1', [taskId]);
    });

    /**
     * Test: error_message is set when provided
     * Validates: Requirements 4.3, 2.4
     */
    test('should set error_message when provided', async () => {
      const result = await pool.query(
        `INSERT INTO publishing_tasks 
         (article_id, account_id, platform_id, config, status, retry_count, max_retries)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [5, 1, 'wangyi', JSON.stringify({}), 'pending', 1, 3]
      );

      const taskId = result.rows[0].id;
      const errorMsg = '执行失败，将自动重试 (2/3)';

      await publishingService.updateTaskStatus(taskId, 'pending', errorMsg);

      const task = await publishingService.getTaskById(taskId);
      expect(task?.error_message).toBe(errorMsg);

      await pool.query('DELETE FROM publishing_tasks WHERE id = $1', [taskId]);
    });

    /**
     * Test: updated_at is always set
     * Validates: Requirements 4.3, 2.4
     */
    test('should always set updated_at', async () => {
      const result = await pool.query(
        `INSERT INTO publishing_tasks 
         (article_id, account_id, platform_id, config, status, retry_count, max_retries)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, updated_at`,
        [6, 1, 'souhu', JSON.stringify({}), 'pending', 0, 3]
      );

      const taskId = result.rows[0].id;
      const originalUpdatedAt = result.rows[0].updated_at;

      // 等待一小段时间确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 10));

      await publishingService.updateTaskStatus(taskId, 'running');

      const task = await publishingService.getTaskById(taskId);
      expect(task?.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());

      await pool.query('DELETE FROM publishing_tasks WHERE id = $1', [taskId]);
    });
  });
});
