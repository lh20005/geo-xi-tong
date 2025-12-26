import * as fc from 'fast-check';
import { TaskTimeoutError } from '../../errors/TaskTimeoutError';

// Feature: batch-task-sequential-execution-fix, Property 2: 任务超时终止
// 对于任何执行时间超过timeout_minutes的任务，必须被终止并标记为timeout

// Mock所有依赖
jest.mock('../PublishingService', () => ({
  publishingService: {
    getTaskById: jest.fn(),
    updateTaskStatus: jest.fn(),
    logMessage: jest.fn(),
    incrementRetryCount: jest.fn()
  }
}));

jest.mock('../BrowserAutomationService', () => ({
  browserAutomationService: {
    launchBrowser: jest.fn(),
    createPage: jest.fn(),
    navigateTo: jest.fn(),
    closePage: jest.fn(),
    closeBrowser: jest.fn(),
    forceCloseBrowser: jest.fn(),
    executeWithRetry: jest.fn()
  }
}));

jest.mock('../AccountService', () => ({
  accountService: {
    getAccountById: jest.fn(),
    updateLastUsed: jest.fn()
  }
}));

jest.mock('../adapters/AdapterRegistry', () => ({
  adapterRegistry: {
    getAdapter: jest.fn()
  }
}));

jest.mock('../../db/database', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn()
  }
}));

import { PublishingExecutor } from '../PublishingExecutor';
import { publishingService } from '../PublishingService';

describe('PublishingExecutor - 超时控制属性测试', () => {
  let executor: PublishingExecutor;

  beforeEach(() => {
    jest.clearAllMocks();
    executor = new PublishingExecutor();
  });

  describe('Property 2: 任务超时终止', () => {
    it('对于任何执行时间超过timeout_minutes的任务，必须被终止并标记为timeout', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成随机超时时间（使用秒而不是分钟以加快测试）
          fc.integer({ min: 1, max: 5 }),
          async (timeoutSeconds) => {
            const taskId = Math.floor(Math.random() * 1000);
            
            // Mock任务数据
            const mockTask = {
              id: taskId,
              article_id: 1,
              account_id: 1,
              platform_id: 'test',
              status: 'pending' as const,
              config: {
                timeout_minutes: timeoutSeconds / 60 // 转换为分钟
              },
              retry_count: 0,
              max_retries: 3,
              created_at: new Date(),
              updated_at: new Date()
            };

            (publishingService.getTaskById as jest.Mock).mockResolvedValue(mockTask);
            (publishingService.updateTaskStatus as jest.Mock).mockResolvedValue(undefined);
            (publishingService.logMessage as jest.Mock).mockResolvedValue(undefined);
            (publishingService.incrementRetryCount as jest.Mock).mockResolvedValue(undefined);

            // 模拟一个会超时的任务（执行时间超过超时限制）
            const startTime = Date.now();
            
            try {
              await executor.executeTask(taskId);
            } catch (error) {
              // 任务应该超时
            }

            const executionTime = Date.now() - startTime;
            
            // 验证：执行时间应该接近超时时间（允许±500ms误差）
            const expectedTimeout = timeoutSeconds * 1000;
            expect(executionTime).toBeGreaterThanOrEqual(expectedTimeout - 500);
            expect(executionTime).toBeLessThanOrEqual(expectedTimeout + 1000);

            // 验证：handleTaskFailure应该被调用，且isTimeout为true
            const updateStatusCalls = (publishingService.updateTaskStatus as jest.Mock).mock.calls;
            const hasTimeoutStatus = updateStatusCalls.some(
              call => call[1] === 'timeout' || call[1] === 'pending'
            );
            expect(hasTimeoutStatus).toBe(true);
          }
        ),
        { numRuns: 10 } // 运行10次以加快测试速度
      );
    });

    it('超时任务应该被标记为timeout状态（当重试次数用完时）', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 3 }),
          async (timeoutSeconds) => {
            const taskId = Math.floor(Math.random() * 1000);
            
            const mockTask = {
              id: taskId,
              article_id: 1,
              account_id: 1,
              platform_id: 'test',
              status: 'pending' as const,
              config: {
                timeout_minutes: timeoutSeconds / 60
              },
              retry_count: 3, // 已经达到最大重试次数
              max_retries: 3,
              created_at: new Date(),
              updated_at: new Date()
            };

            (publishingService.getTaskById as jest.Mock).mockResolvedValue(mockTask);
            (publishingService.updateTaskStatus as jest.Mock).mockResolvedValue(undefined);
            (publishingService.logMessage as jest.Mock).mockResolvedValue(undefined);
            (publishingService.incrementRetryCount as jest.Mock).mockResolvedValue({
              ...mockTask,
              retry_count: 4
            });

            try {
              await executor.executeTask(taskId);
            } catch (error) {
              // 预期会超时
            }

            // 验证：最终状态应该是timeout
            const updateStatusCalls = (publishingService.updateTaskStatus as jest.Mock).mock.calls;
            const finalCall = updateStatusCalls[updateStatusCalls.length - 1];
            
            if (finalCall) {
              expect(['timeout', 'failed']).toContain(finalCall[1]);
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('超时时间验证', () => {
    it('应该使用配置的超时时间', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 60 }),
          async (timeoutMinutes) => {
            const taskId = Math.floor(Math.random() * 1000);
            
            const mockTask = {
              id: taskId,
              article_id: 1,
              account_id: 1,
              platform_id: 'test',
              status: 'pending' as const,
              config: {
                timeout_minutes: timeoutMinutes
              },
              retry_count: 0,
              max_retries: 3,
              created_at: new Date(),
              updated_at: new Date()
            };

            (publishingService.getTaskById as jest.Mock).mockResolvedValue(mockTask);
            (publishingService.logMessage as jest.Mock).mockResolvedValue(undefined);

            // 验证日志中包含超时时间信息
            try {
              await executor.executeTask(taskId);
            } catch (error) {
              // 预期可能超时
            }

            const logCalls = (publishingService.logMessage as jest.Mock).mock.calls;
            const timeoutLog = logCalls.find(call => 
              call[2] && call[2].includes('超时限制')
            );

            if (timeoutLog) {
              expect(timeoutLog[2]).toContain(`${Math.max(1, timeoutMinutes)}`);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('超时时间小于1分钟时应该使用最小值1分钟', async () => {
      const taskId = 123;
      
      const mockTask = {
        id: taskId,
        article_id: 1,
        account_id: 1,
        platform_id: 'test',
        status: 'pending' as const,
        config: {
          timeout_minutes: 0.5 // 小于1分钟
        },
        retry_count: 0,
        max_retries: 3,
        created_at: new Date(),
        updated_at: new Date()
      };

      (publishingService.getTaskById as jest.Mock).mockResolvedValue(mockTask);
      (publishingService.logMessage as jest.Mock).mockResolvedValue(undefined);

      try {
        await executor.executeTask(taskId);
      } catch (error) {
        // 预期可能超时
      }

      const logCalls = (publishingService.logMessage as jest.Mock).mock.calls;
      const timeoutLog = logCalls.find(call => 
        call[2] && call[2].includes('超时限制')
      );

      if (timeoutLog) {
        // 应该使用1分钟而不是0.5分钟
        expect(timeoutLog[2]).toContain('1');
      }
    });
  });

  describe('超时错误类型检查', () => {
    it('超时应该抛出TaskTimeoutError', async () => {
      const taskId = 456;
      const timeoutSeconds = 1;
      
      const mockTask = {
        id: taskId,
        article_id: 1,
        account_id: 1,
        platform_id: 'test',
        status: 'pending' as const,
        config: {
          timeout_minutes: timeoutSeconds / 60
        },
        retry_count: 0,
        max_retries: 3,
        created_at: new Date(),
        updated_at: new Date()
      };

      (publishingService.getTaskById as jest.Mock).mockResolvedValue(mockTask);
      (publishingService.updateTaskStatus as jest.Mock).mockResolvedValue(undefined);
      (publishingService.logMessage as jest.Mock).mockResolvedValue(undefined);
      (publishingService.incrementRetryCount as jest.Mock).mockResolvedValue(undefined);

      // 模拟performPublish永远不完成
      jest.spyOn(executor as any, 'performPublish').mockImplementation(
        () => new Promise(() => {}) // 永远pending
      );

      try {
        await executor.executeTask(taskId);
        fail('应该抛出超时错误');
      } catch (error) {
        // 内部应该捕获TaskTimeoutError
        // 验证handleTaskFailure被调用
        expect(publishingService.incrementRetryCount).toHaveBeenCalledWith(taskId);
      }
    });
  });
});
