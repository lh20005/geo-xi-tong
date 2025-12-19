/**
 * Property-based tests for TaskScheduler
 * Feature: publishing-task-reliability
 */

import fc from 'fast-check';
import { pool } from '../../db/database';
import { publishingService } from '../PublishingService';

describe('TaskScheduler Property Tests', () => {
  beforeAll(async () => {
    // 确保数据库连接
    await pool.query('SELECT 1');
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    // 清理测试数据
    await pool.query('DELETE FROM publishing_logs');
    await pool.query('DELETE FROM publishing_tasks');
  });

  /**
   * Property 1: Retry Task Detection
   * Feature: publishing-task-reliability, Property 1: Retry Task Detection
   * Validates: Requirements 1.1, 1.2, 7.5
   * 
   * For any task with status 'pending' and retry_count > 0,
   * the Task_Scheduler should detect and include it in the list of tasks to execute,
   * regardless of its scheduled_at value.
   */
  test('Property 1: Tasks with retry_count > 0 are always detected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          retry_count: fc.integer({ min: 1, max: 5 }),
          max_retries: fc.integer({ min: 3, max: 10 }),
          scheduled_at: fc.option(
            fc.date({ min: new Date('2025-01-01'), max: new Date('2026-12-31') }),
            { nil: null }
          ),
          article_id: fc.integer({ min: 1, max: 1000 }),
          account_id: fc.integer({ min: 1, max: 100 }),
          platform_id: fc.constantFrom('wangyi', 'souhu', 'baijiahao', 'toutiao')
        }),
        async (taskData) => {
          // 创建一个重试任务
          const result = await pool.query(
            `INSERT INTO publishing_tasks 
             (article_id, account_id, platform_id, config, status, retry_count, max_retries, scheduled_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id`,
            [
              taskData.article_id,
              taskData.account_id,
              taskData.platform_id,
              JSON.stringify({}),
              'pending',
              taskData.retry_count,
              taskData.max_retries,
              taskData.scheduled_at
            ]
          );

          const taskId = result.rows[0].id;

          // 获取待执行任务
          const tasks = await publishingService.getPendingScheduledTasks();

          // 验证：重试任务应该被检测到
          const foundTask = tasks.find(t => t.id === taskId);
          expect(foundTask).toBeDefined();
          expect(foundTask?.retry_count).toBeGreaterThan(0);

          // 清理
          await pool.query('DELETE FROM publishing_tasks WHERE id = $1', [taskId]);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15: Retry Task Ordering
   * Feature: publishing-task-reliability, Property 15: Retry Task Ordering
   * Validates: Requirements 7.2
   * 
   * For any set of pending tasks including retry tasks,
   * the Task_Scheduler should execute them in order of scheduled_at,
   * with retry tasks (retry_count > 0) prioritized.
   */
  test('Property 15: Retry tasks are prioritized over new tasks', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            retry_count: fc.integer({ min: 0, max: 3 }),
            scheduled_at: fc.option(fc.date(), { nil: null }),
            article_id: fc.integer({ min: 1, max: 1000 }),
            account_id: fc.integer({ min: 1, max: 100 }),
            platform_id: fc.constantFrom('wangyi', 'souhu')
          }),
          { minLength: 2, maxLength: 10 }
        ),
        async (tasksData) => {
          // 创建多个任务
          const taskIds: number[] = [];
          for (const taskData of tasksData) {
            const result = await pool.query(
              `INSERT INTO publishing_tasks 
               (article_id, account_id, platform_id, config, status, retry_count, max_retries, scheduled_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               RETURNING id`,
              [
                taskData.article_id,
                taskData.account_id,
                taskData.platform_id,
                JSON.stringify({}),
                'pending',
                taskData.retry_count,
                3,
                taskData.scheduled_at
              ]
            );
            taskIds.push(result.rows[0].id);
          }

          // 获取待执行任务
          const tasks = await publishingService.getPendingScheduledTasks();

          // 验证：重试任务应该在新任务之前
          const retryTasks = tasks.filter(t => t.retry_count > 0);
          const newTasks = tasks.filter(t => t.retry_count === 0);

          if (retryTasks.length > 0 && newTasks.length > 0) {
            const lastRetryIndex = tasks.findIndex(t => 
              t.id === retryTasks[retryTasks.length - 1].id
            );
            const firstNewIndex = tasks.findIndex(t => 
              t.id === newTasks[0].id
            );

            // 最后一个重试任务应该在第一个新任务之前
            expect(lastRetryIndex).toBeLessThan(firstNewIndex);
          }

          // 清理
          await pool.query('DELETE FROM publishing_tasks WHERE id = ANY($1)', [taskIds]);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 16: Duplicate Execution Prevention
   * Feature: publishing-task-reliability, Property 16: Duplicate Execution Prevention
   * Validates: Requirements 7.4
   * 
   * For any task with status 'running',
   * the Task_Scheduler should not include it in the list of tasks to execute.
   */
  test('Property 16: Running tasks are not included in pending tasks', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          article_id: fc.integer({ min: 1, max: 1000 }),
          account_id: fc.integer({ min: 1, max: 100 }),
          platform_id: fc.constantFrom('wangyi', 'souhu', 'baijiahao'),
          retry_count: fc.integer({ min: 0, max: 3 })
        }),
        async (taskData) => {
          // 创建一个运行中的任务
          const result = await pool.query(
            `INSERT INTO publishing_tasks 
             (article_id, account_id, platform_id, config, status, retry_count, max_retries)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [
              taskData.article_id,
              taskData.account_id,
              taskData.platform_id,
              JSON.stringify({}),
              'running',
              taskData.retry_count,
              3
            ]
          );

          const taskId = result.rows[0].id;

          // 获取待执行任务
          const tasks = await publishingService.getPendingScheduledTasks();

          // 验证：运行中的任务不应该被检测到
          const foundTask = tasks.find(t => t.id === taskId);
          expect(foundTask).toBeUndefined();

          // 清理
          await pool.query('DELETE FROM publishing_tasks WHERE id = $1', [taskId]);
        }
      ),
      { numRuns: 100 }
    );
  });
});
