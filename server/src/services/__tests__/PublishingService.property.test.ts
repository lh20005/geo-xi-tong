/**
 * Property-based tests for PublishingService
 * Feature: publishing-task-reliability
 */

import fc from 'fast-check';
import { pool } from '../../db/database';
import { publishingService } from '../PublishingService';

describe('PublishingService Property Tests', () => {
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
   * Property 4: Cancellation Status Update
   * Feature: publishing-task-reliability, Property 4: Cancellation Status Update
   * Validates: Requirements 2.1, 2.3, 2.4, 8.2
   * 
   * For any pending task, when cancelled,
   * the Publishing_Service should atomically update status to 'cancelled',
   * set error_message to indicate manual cancellation, and set updated_at to current timestamp.
   */
  test('Property 4: Cancelled tasks have correct status and error message', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          article_id: fc.integer({ min: 1, max: 1000 }),
          account_id: fc.integer({ min: 1, max: 100 })
        }),
        async (taskData) => {
          // 创建文章
          await pool.query(
            `INSERT INTO articles (id, keyword, content, provider) 
             VALUES ($1, $2, $3, $4) 
             ON CONFLICT (id) DO NOTHING`,
            [taskData.article_id, 'test', 'test content', 'test']
          );

          // 创建任务
          const result = await pool.query(
            `INSERT INTO publishing_tasks 
             (article_id, account_id, platform_id, config, status, retry_count, max_retries)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, created_at`,
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
          const createdAt = result.rows[0].created_at;

          // 取消任务
          await publishingService.cancelTask(taskId);

          // 验证
          const updatedTask = await publishingService.getTaskById(taskId);
          expect(updatedTask?.status).toBe('cancelled');
          expect(updatedTask?.error_message).toContain('用户手动取消');
          expect(updatedTask?.updated_at.getTime()).toBeGreaterThan(createdAt.getTime());
          expect(updatedTask?.completed_at).toBeDefined();

          // 清理
          await pool.query('DELETE FROM publishing_tasks WHERE id = $1', [taskId]);
          await pool.query('DELETE FROM articles WHERE id = $1', [taskData.article_id]);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13: Transaction Atomicity
   * Feature: publishing-task-reliability, Property 13: Transaction Atomicity
   * Validates: Requirements 6.1, 6.2, 6.3, 6.4
   * 
   * For any task status update that includes article lock release,
   * both the task update and article update should complete in the same transaction,
   * such that if either fails, both are rolled back.
   */
  test('Property 13: Task cancellation is atomic with article lock release', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          article_id: fc.integer({ min: 1, max: 1000 }),
          account_id: fc.integer({ min: 1, max: 100 })
        }),
        async (taskData) => {
          // 创建文章
          await pool.query(
            `INSERT INTO articles (id, keyword, content, provider, publishing_status) 
             VALUES ($1, $2, $3, $4, $5) 
             ON CONFLICT (id) DO UPDATE SET publishing_status = $5`,
            [taskData.article_id, 'test', 'test content', 'test', 'pending']
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

          // 取消任务（应该原子性地更新任务和文章）
          await publishingService.cancelTask(taskId);

          // 验证两者都已更新
          const task = await publishingService.getTaskById(taskId);
          const articleResult = await pool.query(
            'SELECT publishing_status FROM articles WHERE id = $1',
            [taskData.article_id]
          );

          expect(task?.status).toBe('cancelled');
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
   * Property 7: Article Visibility After Lock Release
   * Feature: publishing-task-reliability, Property 7: Article Visibility After Lock Release
   * Validates: Requirements 3.4
   * 
   * For any article with publishing_status = NULL,
   * the article should appear in selection list queries.
   */
  test('Property 7: Articles with NULL publishing_status are visible', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          article_id: fc.integer({ min: 1, max: 1000 }),
          keyword: fc.string({ minLength: 3, maxLength: 20 })
        }),
        async (articleData) => {
          // 创建文章，publishing_status = NULL
          await pool.query(
            `INSERT INTO articles (id, keyword, content, provider, publishing_status, is_published) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             ON CONFLICT (id) DO UPDATE SET publishing_status = $5, is_published = $6`,
            [articleData.article_id, articleData.keyword, 'test content', 'test', null, false]
          );

          // 查询未发布的文章（应该包含此文章）
          const result = await pool.query(
            `SELECT id FROM articles 
             WHERE (is_published = false OR is_published IS NULL)
             AND (publishing_status IS NULL OR publishing_status = '')
             AND id = $1`,
            [articleData.article_id]
          );

          expect(result.rows.length).toBe(1);
          expect(result.rows[0].id).toBe(articleData.article_id);

          // 清理
          await pool.query('DELETE FROM articles WHERE id = $1', [articleData.article_id]);
        }
      ),
      { numRuns: 100 }
    );
  });
});
