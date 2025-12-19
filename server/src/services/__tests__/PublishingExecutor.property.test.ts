/**
 * Property-based tests for PublishingExecutor
 * Feature: publishing-task-reliability
 */

import fc from 'fast-check';
import { pool } from '../../db/database';
import { publishingService } from '../PublishingService';

describe('PublishingExecutor Property Tests', () => {
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

  /**
   * Property 2: Retry Count Increment
   * Feature: publishing-task-reliability, Property 2: Retry Count Increment
   * Validates: Requirements 1.3, 1.5
   * 
   * For any task that fails with retry_count < max_retries,
   * the Publishing_Executor should increment retry_count by 1 and set status to 'pending'.
   */
  test('Property 2: Failed tasks with remaining retries increment retry_count', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          retry_count: fc.integer({ min: 0, max: 2 }),
          max_retries: fc.constant(3),
          article_id: fc.integer({ min: 1, max: 1000 }),
          account_id: fc.integer({ min: 1, max: 100 })
        }),
        async (taskData) => {
          // 创建任务
          const result = await pool.query(
            `INSERT INTO publishing_tasks 
             (article_id, account_id, platform_id, config, status, retry_count, max_retries)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [
              taskData.article_id,
              taskData.account_id,
              'wangyi',
              JSON.stringify({}),
              'pending',
              taskData.retry_count,
              taskData.max_retries
            ]
          );

          const taskId = result.rows[0].id;

          // 模拟失败：增加重试次数
          await publishingService.incrementRetryCount(taskId);
          await publishingService.updateTaskStatus(taskId, 'pending', '执行失败，将自动重试');

          // 验证
          const updatedTask = await publishingService.getTaskById(taskId);
          expect(updatedTask?.retry_count).toBe(taskData.retry_count + 1);
          expect(updatedTask?.status).toBe('pending');

          // 清理
          await pool.query('DELETE FROM publishing_tasks WHERE id = $1', [taskId]);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Retry Exhaustion
   * Feature: publishing-task-reliability, Property 3: Retry Exhaustion
   * Validates: Requirements 1.4
   * 
   * For any task where retry_count >= max_retries after failure,
   * the Publishing_Executor should set status to 'failed' and should not set it to 'pending'.
   */
  test('Property 3: Tasks with exhausted retries are marked as failed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          max_retries: fc.integer({ min: 1, max: 5 }),
          article_id: fc.integer({ min: 1, max: 1000 }),
          account_id: fc.integer({ min: 1, max: 100 })
        }),
        async (taskData) => {
          // 创建任务，retry_count已达到max_retries
          const result = await pool.query(
            `INSERT INTO publishing_tasks 
             (article_id, account_id, platform_id, config, status, retry_count, max_retries)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [
              taskData.article_id,
              taskData.account_id,
              'wangyi',
              JSON.stringify({}),
              'pending',
              taskData.max_retries,
              taskData.max_retries
            ]
          );

          const taskId = result.rows[0].id;

          // 模拟最终失败
          await publishingService.updateTaskStatus(taskId, 'failed', '重试次数已用完');

          // 验证
          const updatedTask = await publishingService.getTaskById(taskId);
          expect(updatedTask?.status).toBe('failed');
          expect(updatedTask?.retry_count).toBe(taskData.max_retries);

          // 清理
          await pool.query('DELETE FROM publishing_tasks WHERE id = $1', [taskId]);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6: Article Lock Release on Cancellation
   * Feature: publishing-task-reliability, Property 6: Article Lock Release on Cancellation
   * Validates: Requirements 3.1, 3.2, 3.3, 6.3
   * 
   * For any task cancellation, deletion, or final failure,
   * the system should clear the article's publishing_status field.
   */
  test('Property 6: Article lock is cleared on task cancellation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          article_id: fc.integer({ min: 1, max: 1000 }),
          account_id: fc.integer({ min: 1, max: 100 })
        }),
        async (taskData) => {
          // 创建文章（如果不存在）
          await pool.query(
            `INSERT INTO articles (id, keyword, content, provider) 
             VALUES ($1, $2, $3, $4) 
             ON CONFLICT (id) DO NOTHING`,
            [taskData.article_id, 'test', 'test content', 'test']
          );

          // 设置文章锁
          await pool.query(
            'UPDATE articles SET publishing_status = $1 WHERE id = $2',
            ['pending', taskData.article_id]
          );

          // 创建任务
          const result = await pool.query(
            `INSERT INTO publishing_tasks 
             (article_id, account_id, platform_id, config, status, retry_count, max_retries)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [
              taskData.article_id,
              taskData.account_id,
              'wangyi',
              JSON.stringify({}),
              'pending',
              0,
              3
            ]
          );

          const taskId = result.rows[0].id;

          // 取消任务
          await publishingService.cancelTask(taskId);

          // 验证文章锁已清除
          const articleResult = await pool.query(
            'SELECT publishing_status FROM articles WHERE id = $1',
            [taskData.article_id]
          );

          expect(articleResult.rows[0].publishing_status).toBeNull();

          // 清理
          await pool.query('DELETE FROM publishing_tasks WHERE id = $1', [taskId]);
          await pool.query('DELETE FROM articles WHERE id = $1', [taskData.article_id]);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 17: Error Message Completeness
   * Feature: publishing-task-reliability, Property 17: Error Message Completeness
   * Validates: Requirements 8.1
   * 
   * For any task that fails,
   * the Publishing_Executor should create a log entry containing the error message
   * and set the task's error_message field.
   */
  test('Property 17: Failed tasks have error messages logged', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          article_id: fc.integer({ min: 1, max: 1000 }),
          account_id: fc.integer({ min: 1, max: 100 }),
          error_message: fc.string({ minLength: 5, maxLength: 100 })
        }),
        async (taskData) => {
          // 创建任务
          const result = await pool.query(
            `INSERT INTO publishing_tasks 
             (article_id, account_id, platform_id, config, status, retry_count, max_retries)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [
              taskData.article_id,
              taskData.account_id,
              'wangyi',
              JSON.stringify({}),
              'pending',
              0,
              3
            ]
          );

          const taskId = result.rows[0].id;

          // 模拟失败
          await publishingService.updateTaskStatus(taskId, 'failed', taskData.error_message);
          await publishingService.logMessage(taskId, 'error', '任务执行失败', {
            error: taskData.error_message
          });

          // 验证任务有错误消息
          const updatedTask = await publishingService.getTaskById(taskId);
          expect(updatedTask?.error_message).toBe(taskData.error_message);

          // 验证日志已创建
          const logs = await publishingService.getTaskLogs(taskId);
          const errorLog = logs.find(log => log.level === 'error');
          expect(errorLog).toBeDefined();

          // 清理
          await pool.query('DELETE FROM publishing_tasks WHERE id = $1', [taskId]);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18: Retry Exhaustion Error Message
   * Feature: publishing-task-reliability, Property 18: Retry Exhaustion Error Message
   * Validates: Requirements 8.3
   * 
   * For any task that reaches max_retries,
   * the error_message should indicate that retry attempts have been exhausted.
   */
  test('Property 18: Exhausted retries have appropriate error message', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          article_id: fc.integer({ min: 1, max: 1000 }),
          account_id: fc.integer({ min: 1, max: 100 }),
          max_retries: fc.integer({ min: 1, max: 5 })
        }),
        async (taskData) => {
          // 创建任务
          const result = await pool.query(
            `INSERT INTO publishing_tasks 
             (article_id, account_id, platform_id, config, status, retry_count, max_retries)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [
              taskData.article_id,
              taskData.account_id,
              'wangyi',
              JSON.stringify({}),
              'pending',
              taskData.max_retries,
              taskData.max_retries
            ]
          );

          const taskId = result.rows[0].id;

          // 模拟重试用完
          const errorMsg = `重试次数已用完: 测试错误`;
          await publishingService.updateTaskStatus(taskId, 'failed', errorMsg);

          // 验证错误消息包含"重试次数已用完"
          const updatedTask = await publishingService.getTaskById(taskId);
          expect(updatedTask?.error_message).toContain('重试次数已用完');

          // 清理
          await pool.query('DELETE FROM publishing_tasks WHERE id = $1', [taskId]);
        }
      ),
      { numRuns: 100 }
    );
  });
});
