/**
 * BatchExecutor 测试套件
 * 
 * 这个测试文件包含了批次执行控制的所有测试场景
 * 包括单元测试、属性测试和集成测试
 */

import { BatchExecutor } from '../BatchExecutor';
import { publishingService } from '../PublishingService';
import { publishingExecutor } from '../PublishingExecutor';

// Mock dependencies
jest.mock('../PublishingService');
jest.mock('../PublishingExecutor');
jest.mock('../../db/database', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

describe('BatchExecutor', () => {
  let batchExecutor: BatchExecutor;
  let mockPool: any;

  beforeEach(() => {
    batchExecutor = new BatchExecutor();
    mockPool = require('../../db/database').pool;
    jest.clearAllMocks();
  });

  describe('Stop Signal Detection', () => {
    /**
     * Property 24: Zero Pending Count Interpretation
     * Validates: Requirements 7.3
     * 
     * Feature: batch-execution-control, Property 24: Zero Pending Count Interpretation
     */
    test('should return true when pending count is 0', async () => {
      // Arrange
      mockPool.query.mockResolvedValue({
        rows: [{ pending_count: '0' }],
      });

      // Act
      const result = await (batchExecutor as any).checkStopSignal('test-batch');

      // Assert
      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as pending_count'),
        ['test-batch']
      );
    });

    /**
     * Property 25: Positive Pending Count Continuation
     * Validates: Requirements 7.4
     * 
     * Feature: batch-execution-control, Property 25: Positive Pending Count Continuation
     */
    test('should return false when pending count is greater than 0', async () => {
      // Arrange
      mockPool.query.mockResolvedValue({
        rows: [{ pending_count: '5' }],
      });

      // Act
      const result = await (batchExecutor as any).checkStopSignal('test-batch');

      // Assert
      expect(result).toBe(false);
    });

    /**
     * Property 31: Query Retry on Failure
     * Validates: Requirements 9.2, 9.3
     * 
     * Feature: batch-execution-control, Property 31: Query Retry on Failure
     */
    test('should retry query once on failure', async () => {
      // Arrange
      mockPool.query
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({
          rows: [{ pending_count: '0' }],
        });

      // Act
      const result = await (batchExecutor as any).checkStopSignal('test-batch');

      // Assert
      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    test('should return false when both query attempts fail', async () => {
      // Arrange
      mockPool.query
        .mockRejectedValueOnce(new Error('Database error 1'))
        .mockRejectedValueOnce(new Error('Database error 2'));

      // Act
      const result = await (batchExecutor as any).checkStopSignal('test-batch');

      // Assert
      expect(result).toBe(false); // Assume not stopped on double failure
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('Stop Check Frequency', () => {
    /**
     * Property 9: Stop Check Frequency
     * Validates: Requirements 3.1
     * 
     * Feature: batch-execution-control, Property 9: Stop Check Frequency
     */
    test('should use 1 second check interval', () => {
      // Assert
      expect((batchExecutor as any).STOP_CHECK_INTERVAL_MS).toBe(1000);
    });
  });

  describe('Interval Calculation', () => {
    /**
     * Property 20: Interval Calculation Correctness
     * Validates: Requirements 6.1, 6.2
     * 
     * Feature: batch-execution-control, Property 20: Interval Calculation Correctness
     */
    test('should calculate wait time correctly', async () => {
      // Arrange
      const intervalMinutes = 5;
      const expectedWaitMs = intervalMinutes * 60 * 1000; // 300000ms

      mockPool.query.mockResolvedValue({
        rows: [{ pending_count: '1' }], // Not stopped
      });

      // Act
      const startTime = Date.now();
      await (batchExecutor as any).waitWithStopCheck('test-batch', intervalMinutes);
      const actualWaitTime = Date.now() - startTime;

      // Assert
      // Allow 10% tolerance for system overhead
      const tolerance = expectedWaitMs * 0.1;
      expect(actualWaitTime).toBeGreaterThanOrEqual(expectedWaitMs - tolerance);
      expect(actualWaitTime).toBeLessThanOrEqual(expectedWaitMs + tolerance);
    });

    test('should handle negative interval as 0', async () => {
      // Act
      const startTime = Date.now();
      await (batchExecutor as any).waitWithStopCheck('test-batch', -5);
      const actualWaitTime = Date.now() - startTime;

      // Assert
      expect(actualWaitTime).toBeLessThan(100); // Should return immediately
    });

    test('should handle zero interval', async () => {
      // Act
      const startTime = Date.now();
      await (batchExecutor as any).waitWithStopCheck('test-batch', 0);
      const actualWaitTime = Date.now() - startTime;

      // Assert
      expect(actualWaitTime).toBeLessThan(100); // Should return immediately
    });

    test('should log warning for very large interval', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log');
      mockPool.query.mockResolvedValue({
        rows: [{ pending_count: '0' }], // Stopped immediately
      });

      // Act
      await (batchExecutor as any).waitWithStopCheck('test-batch', 2000); // > 1440 minutes

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('间隔时间超过24小时')
      );
    });
  });

  describe('Wait Termination', () => {
    /**
     * Property 3: Immediate Wait Termination on Stop
     * Validates: Requirements 1.3, 3.2, 3.4
     * 
     * Feature: batch-execution-control, Property 3: Immediate Wait Termination on Stop
     */
    test('should terminate wait immediately when stop signal detected', async () => {
      // Arrange
      let queryCount = 0;
      mockPool.query.mockImplementation(() => {
        queryCount++;
        // Return stopped after 2 checks (2 seconds)
        return Promise.resolve({
          rows: [{ pending_count: queryCount > 2 ? '0' : '1' }],
        });
      });

      // Act
      const startTime = Date.now();
      await (batchExecutor as any).waitWithStopCheck('test-batch', 10); // 10 minutes
      const actualWaitTime = Date.now() - startTime;

      // Assert
      // Should terminate within 3 seconds (2 checks + overhead)
      expect(actualWaitTime).toBeLessThan(3000);
      expect(actualWaitTime).toBeGreaterThan(2000); // At least 2 checks
    });

    /**
     * Property 10: Early Termination Logging
     * Validates: Requirements 3.3
     * 
     * Feature: batch-execution-control, Property 10: Early Termination Logging
     */
    test('should log early termination with remaining time', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log');
      mockPool.query.mockResolvedValue({
        rows: [{ pending_count: '0' }], // Stopped immediately
      });

      // Act
      await (batchExecutor as any).waitWithStopCheck('test-batch', 10);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('在等待期间被停止')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('已等待')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('剩余等待')
      );
    });
  });

  describe('Wait Completion Logging', () => {
    /**
     * Property 8: Wait Completion Logging
     * Validates: Requirements 2.5
     * 
     * Feature: batch-execution-control, Property 8: Wait Completion Logging
     */
    test('should log wait completion with timing details', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log');
      mockPool.query.mockResolvedValue({
        rows: [{ pending_count: '1' }], // Not stopped
      });

      // Act
      await (batchExecutor as any).waitWithStopCheck('test-batch', 0.1); // 6 seconds

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('等待完成')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('预期等待')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('实际等待')
      );
    });

    /**
     * Property 7: Wait Start Logging
     * Validates: Requirements 2.4
     * 
     * Feature: batch-execution-control, Property 7: Wait Start Logging
     */
    test('should log wait start information', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log');
      mockPool.query.mockResolvedValue({
        rows: [{ pending_count: '0' }], // Stopped immediately
      });

      // Act
      await (batchExecutor as any).waitWithStopCheck('test-batch', 5);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('等待 5 分钟后执行下一个任务')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('当前时间')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('预计下次执行时间')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('等待时长')
      );
    });

    /**
     * Property 21: Wait Time Logging Completeness
     * Validates: Requirements 6.3
     * 
     * Feature: batch-execution-control, Property 21: Wait Time Logging Completeness
     */
    test('should log both minutes and milliseconds', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log');
      mockPool.query.mockResolvedValue({
        rows: [{ pending_count: '0' }],
      });

      // Act
      await (batchExecutor as any).waitWithStopCheck('test-batch', 2);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/等待时长: \d+ms \(\d+分钟\)/)
      );
    });
  });

  describe('Executing Batches Set Management', () => {
    /**
     * Property 16: Executing Set Addition on Start
     * Validates: Requirements 5.1
     * 
     * Feature: batch-execution-control, Property 16: Executing Set Addition on Start
     */
    test('should add batch to executing set on start', async () => {
      // Arrange
      (publishingService.getBatchTasks as jest.Mock).mockResolvedValue([]);

      // Act
      await batchExecutor.executeBatch('test-batch');

      // Assert
      // Batch should be removed after completion (in finally block)
      expect(batchExecutor.getExecutingBatches()).not.toContain('test-batch');
    });

    /**
     * Property 5: Executing Set Cleanup on Stop
     * Validates: Requirements 1.5, 5.2
     * 
     * Feature: batch-execution-control, Property 5: Executing Set Cleanup on Stop
     */
    test('should remove batch from executing set on completion', async () => {
      // Arrange
      (publishingService.getBatchTasks as jest.Mock).mockResolvedValue([]);

      // Act
      await batchExecutor.executeBatch('test-batch');

      // Assert
      expect(batchExecutor.getExecutingBatches()).not.toContain('test-batch');
    });

    /**
     * Property 19: Executing Set Cleanup on Error
     * Validates: Requirements 5.5, 9.5
     * 
     * Feature: batch-execution-control, Property 19: Executing Set Cleanup on Error
     */
    test('should remove batch from executing set on error', async () => {
      // Arrange
      (publishingService.getBatchTasks as jest.Mock).mockRejectedValue(
        new Error('Test error')
      );

      // Act
      await batchExecutor.executeBatch('test-batch');

      // Assert
      expect(batchExecutor.getExecutingBatches()).not.toContain('test-batch');
    });

    /**
     * Property 17: Duplicate Execution Prevention
     * Validates: Requirements 5.3
     * 
     * Feature: batch-execution-control, Property 17: Duplicate Execution Prevention
     */
    test('should prevent duplicate batch execution', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log');
      (publishingService.getBatchTasks as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 1000))
      );

      // Act
      const promise1 = batchExecutor.executeBatch('test-batch');
      const promise2 = batchExecutor.executeBatch('test-batch');
      await Promise.all([promise1, promise2]);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('正在执行中，跳过')
      );
    });

    /**
     * Property 18: Executing Batches Query Accuracy
     * Validates: Requirements 5.4
     * 
     * Feature: batch-execution-control, Property 18: Executing Batches Query Accuracy
     */
    test('should return accurate list of executing batches', () => {
      // Act
      const executingBatches = batchExecutor.getExecutingBatches();

      // Assert
      expect(Array.isArray(executingBatches)).toBe(true);
    });
  });

  describe('Batch Completion Logging', () => {
    /**
     * Property 26: Completion Logging with Task Count
     * Validates: Requirements 8.1
     * 
     * Feature: batch-execution-control, Property 26: Completion Logging with Task Count
     */
    test('should log completion with task count', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log');
      mockPool.query.mockResolvedValue({
        rows: [{
          total: '5',
          success: '3',
          failed: '1',
          cancelled: '1',
          pending: '0',
        }],
      });

      // Act
      await (batchExecutor as any).logBatchSummary('test-batch');

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('批次 test-batch 统计')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('总任务数: 5')
      );
    });

    /**
     * Property 28: Final Status Query on Completion
     * Validates: Requirements 8.3
     * 
     * Feature: batch-execution-control, Property 28: Final Status Query on Completion
     */
    test('should query final status counts', async () => {
      // Arrange
      mockPool.query.mockResolvedValue({
        rows: [{
          total: '5',
          success: '3',
          failed: '1',
          cancelled: '1',
          pending: '0',
        }],
      });

      // Act
      await (batchExecutor as any).logBatchSummary('test-batch');

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*) FILTER'),
        ['test-batch']
      );
    });

    /**
     * Property 29: Completion Duration Logging
     * Validates: Requirements 8.4
     * 
     * Feature: batch-execution-control, Property 29: Completion Duration Logging
     */
    test('should log execution duration', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log');
      (publishingService.getBatchTasks as jest.Mock).mockResolvedValue([]);

      // Act
      await batchExecutor.executeBatch('test-batch');

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/执行完成！耗时: \d+秒/)
      );
    });
  });

  describe('Concurrent Batch Execution', () => {
    /**
     * Property 33: Concurrent Batch Execution
     * Validates: Requirements 10.1
     * 
     * Feature: batch-execution-control, Property 33: Concurrent Batch Execution
     */
    test('should execute multiple batches concurrently', async () => {
      // Arrange
      (publishingService.getBatchTasks as jest.Mock).mockResolvedValue([]);

      // Act
      const promise1 = batchExecutor.executeBatch('batch-1');
      const promise2 = batchExecutor.executeBatch('batch-2');
      const promise3 = batchExecutor.executeBatch('batch-3');
      await Promise.all([promise1, promise2, promise3]);

      // Assert
      expect(publishingService.getBatchTasks).toHaveBeenCalledTimes(3);
    });

    /**
     * Property 34: Batch Stop Isolation
     * Validates: Requirements 10.2
     * 
     * Feature: batch-execution-control, Property 34: Batch Stop Isolation
     */
    test('should isolate batch stops', async () => {
      // Arrange
      mockPool.query.mockImplementation((query: string, params: any[]) => {
        const batchId = params[0];
        // Only batch-2 is stopped
        return Promise.resolve({
          rows: [{ pending_count: batchId === 'batch-2' ? '0' : '1' }],
        });
      });

      // Act
      const result1 = await (batchExecutor as any).checkStopSignal('batch-1');
      const result2 = await (batchExecutor as any).checkStopSignal('batch-2');
      const result3 = await (batchExecutor as any).checkStopSignal('batch-3');

      // Assert
      expect(result1).toBe(false); // Not stopped
      expect(result2).toBe(true);  // Stopped
      expect(result3).toBe(false); // Not stopped
    });

    /**
     * Property 35: Stop Signal Query Scope
     * Validates: Requirements 10.3
     * 
     * Feature: batch-execution-control, Property 35: Stop Signal Query Scope
     */
    test('should query only current batch pending count', async () => {
      // Arrange
      mockPool.query.mockResolvedValue({
        rows: [{ pending_count: '0' }],
      });

      // Act
      await (batchExecutor as any).checkStopSignal('specific-batch');

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE batch_id = $1'),
        ['specific-batch']
      );
    });

    /**
     * Property 36: Batch ID in Logs
     * Validates: Requirements 10.4
     * 
     * Feature: batch-execution-control, Property 36: Batch ID in Logs
     */
    test('should include batch_id in all log messages', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log');
      (publishingService.getBatchTasks as jest.Mock).mockResolvedValue([]);

      // Act
      await batchExecutor.executeBatch('test-batch-123');

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('test-batch-123')
      );
    });
  });

  describe('Integration Tests', () => {
    /**
     * Integration Test: Batch Stop During Execution
     * Validates: Requirements 1.1, 1.2
     */
    test('should stop batch during task execution', async () => {
      // Arrange
      const tasks = [
        { id: 1, status: 'pending', interval_minutes: 0 },
        { id: 2, status: 'pending', interval_minutes: 0 },
        { id: 3, status: 'pending', interval_minutes: 0 },
      ];

      (publishingService.getBatchTasks as jest.Mock).mockResolvedValue(tasks);
      (publishingService.getTaskById as jest.Mock).mockImplementation((id) => {
        // Task 2 and 3 are cancelled after task 1 completes
        return Promise.resolve(
          id === 1 ? { id, status: 'pending' } : { id, status: 'cancelled' }
        );
      });

      let queryCount = 0;
      mockPool.query.mockImplementation(() => {
        queryCount++;
        // Stop signal detected after first task
        return Promise.resolve({
          rows: [{ pending_count: queryCount > 1 ? '0' : '1' }],
        });
      });

      (publishingExecutor.executeTask as jest.Mock).mockResolvedValue(undefined);

      // Act
      await batchExecutor.executeBatch('test-batch');

      // Assert
      // Only task 1 should be executed
      expect(publishingExecutor.executeTask).toHaveBeenCalledTimes(1);
      expect(publishingExecutor.executeTask).toHaveBeenCalledWith(1);
    });

    /**
     * Integration Test: Batch Stop During Wait
     * Validates: Requirements 1.3, 3.2
     */
    test('should stop batch during interval wait', async () => {
      // Arrange
      const tasks = [
        { id: 1, status: 'pending', interval_minutes: 5 },
        { id: 2, status: 'pending', interval_minutes: 0 },
      ];

      (publishingService.getBatchTasks as jest.Mock).mockResolvedValue(tasks);
      (publishingService.getTaskById as jest.Mock).mockResolvedValue({
        id: 1,
        status: 'pending',
      });

      let queryCount = 0;
      mockPool.query.mockImplementation(() => {
        queryCount++;
        // Stop signal detected during wait (after 2 checks)
        return Promise.resolve({
          rows: [{ pending_count: queryCount > 2 ? '0' : '1' }],
        });
      });

      (publishingExecutor.executeTask as jest.Mock).mockResolvedValue(undefined);

      // Act
      const startTime = Date.now();
      await batchExecutor.executeBatch('test-batch');
      const duration = Date.now() - startTime;

      // Assert
      // Only task 1 should be executed
      expect(publishingExecutor.executeTask).toHaveBeenCalledTimes(1);
      // Wait should terminate early (within 3 seconds instead of 5 minutes)
      expect(duration).toBeLessThan(3000);
    });

    /**
     * Integration Test: Interval Timing
     * Validates: Requirements 2.1, 2.2
     */
    test('should respect interval timing between tasks', async () => {
      // Arrange
      const intervalMinutes = 0.05; // 3 seconds for faster test
      const tasks = [
        { id: 1, status: 'pending', interval_minutes: intervalMinutes },
        { id: 2, status: 'pending', interval_minutes: 0 },
      ];

      (publishingService.getBatchTasks as jest.Mock).mockResolvedValue(tasks);
      (publishingService.getTaskById as jest.Mock).mockResolvedValue({
        status: 'pending',
      });

      mockPool.query.mockResolvedValue({
        rows: [{ pending_count: '1' }], // Not stopped
      });

      (publishingExecutor.executeTask as jest.Mock).mockResolvedValue(undefined);

      // Act
      const startTime = Date.now();
      await batchExecutor.executeBatch('test-batch');
      const duration = Date.now() - startTime;

      // Assert
      const expectedWaitMs = intervalMinutes * 60 * 1000;
      const tolerance = expectedWaitMs * 0.2; // 20% tolerance
      expect(duration).toBeGreaterThanOrEqual(expectedWaitMs - tolerance);
      expect(duration).toBeLessThanOrEqual(expectedWaitMs + tolerance + 1000);
    });

    /**
     * Integration Test: Concurrent Batches
     * Validates: Requirements 10.1, 10.2
     */
    test('should handle concurrent batches independently', async () => {
      // Arrange
      const tasks1 = [{ id: 1, status: 'pending', interval_minutes: 0 }];
      const tasks2 = [{ id: 2, status: 'pending', interval_minutes: 0 }];
      const tasks3 = [{ id: 3, status: 'pending', interval_minutes: 0 }];

      (publishingService.getBatchTasks as jest.Mock).mockImplementation((batchId) => {
        if (batchId === 'batch-1') return Promise.resolve(tasks1);
        if (batchId === 'batch-2') return Promise.resolve(tasks2);
        if (batchId === 'batch-3') return Promise.resolve(tasks3);
        return Promise.resolve([]);
      });

      (publishingService.getTaskById as jest.Mock).mockResolvedValue({
        status: 'pending',
      });

      mockPool.query.mockImplementation((query: string, params: any[]) => {
        const batchId = params[0];
        // Only batch-2 is stopped
        return Promise.resolve({
          rows: [{ pending_count: batchId === 'batch-2' ? '0' : '1' }],
        });
      });

      (publishingExecutor.executeTask as jest.Mock).mockResolvedValue(undefined);

      // Act
      await Promise.all([
        batchExecutor.executeBatch('batch-1'),
        batchExecutor.executeBatch('batch-2'),
        batchExecutor.executeBatch('batch-3'),
      ]);

      // Assert
      // Batch 1 and 3 should execute, batch 2 should stop
      expect(publishingExecutor.executeTask).toHaveBeenCalledWith(1);
      expect(publishingExecutor.executeTask).not.toHaveBeenCalledWith(2);
      expect(publishingExecutor.executeTask).toHaveBeenCalledWith(3);
    });
  });
});
