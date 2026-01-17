/**
 * 发布 IPC 处理器
 * 处理发布任务的本地执行
 * Requirements: Phase 6 - 注册 IPC 处理器
 */

import { ipcMain, BrowserWindow } from 'electron';
import log from 'electron-log';
import { taskService } from '../../services';
import { storageManager } from '../../storage/manager';
import { PublishingExecutor } from '../../publishing/PublishingExecutor';
import { BatchExecutor } from '../../publishing/BatchExecutor';
import { TaskScheduler } from '../../publishing/TaskScheduler';
import { apiClient } from '../../api/client';

// 单例实例
let publishingExecutor: PublishingExecutor | null = null;
let batchExecutor: BatchExecutor | null = null;
let taskScheduler: TaskScheduler | null = null;

/**
 * 获取或创建 PublishingExecutor 实例
 */
function getPublishingExecutor(): PublishingExecutor {
  if (!publishingExecutor) {
    publishingExecutor = new PublishingExecutor();
  }
  return publishingExecutor;
}

/**
 * 获取或创建 BatchExecutor 实例
 */
function getBatchExecutor(): BatchExecutor {
  if (!batchExecutor) {
    batchExecutor = new BatchExecutor();
  }
  return batchExecutor;
}

/**
 * 获取或创建 TaskScheduler 实例
 */
function getTaskScheduler(): TaskScheduler {
  if (!taskScheduler) {
    taskScheduler = new TaskScheduler();
  }
  return taskScheduler;
}

/**
 * 注册发布相关 IPC 处理器
 */
export function registerPublishHandlers(): void {
  log.info('Registering publish IPC handlers...');

  // 执行单个发布任务
  ipcMain.handle('publish:executeSingle', async (_event, taskId: string) => {
    try {
      log.info(`IPC: publish:executeSingle - ${taskId}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const task = taskService.findById(taskId);
      if (!task) {
        return { success: false, error: '任务不存在' };
      }

      const executor = getPublishingExecutor();
      await executor.executeTask(taskId);

      return { success: true };
    } catch (error: any) {
      log.error('IPC: publish:executeSingle failed:', error);
      return { success: false, error: error.message || '执行发布任务失败' };
    }
  });

  // 执行批量发布任务
  ipcMain.handle('publish:executeBatch', async (_event, batchId: string) => {
    try {
      log.info(`IPC: publish:executeBatch - ${batchId}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const tasks = taskService.findByBatchId(batchId);
      if (tasks.length === 0) {
        return { success: false, error: '批次中没有任务' };
      }

      const executor = getBatchExecutor();
      
      // 异步执行，立即返回
      executor.executeBatch(batchId).catch(err => {
        log.error(`Batch ${batchId} execution error:`, err);
      });

      return { success: true, message: '批量发布已开始' };
    } catch (error: any) {
      log.error('IPC: publish:executeBatch failed:', error);
      return { success: false, error: error.message || '执行批量发布失败' };
    }
  });

  // 停止批量发布
  ipcMain.handle('publish:stopBatch', async (_event, batchId: string) => {
    try {
      log.info(`IPC: publish:stopBatch - ${batchId}`);
      
      const executor = getBatchExecutor();
      const result = await executor.stopBatch(batchId);

      return { success: true, data: result };
    } catch (error: any) {
      log.error('IPC: publish:stopBatch failed:', error);
      return { success: false, error: error.message || '停止批量发布失败' };
    }
  });

  // 获取批量发布状态
  ipcMain.handle('publish:getBatchStatus', async (_event, batchId: string) => {
    try {
      log.info(`IPC: publish:getBatchStatus - ${batchId}`);
      
      const executor = getBatchExecutor();
      const executingBatches = executor.getExecutingBatches();
      const isRunning = executingBatches.includes(batchId);
      const stats = taskService.getBatchStats(batchId);

      return { 
        success: true, 
        data: {
          isRunning,
          ...stats
        }
      };
    } catch (error: any) {
      log.error('IPC: publish:getBatchStatus failed:', error);
      return { success: false, error: error.message || '获取批量发布状态失败' };
    }
  });

  // 启动任务调度器
  ipcMain.handle('publish:startScheduler', async () => {
    try {
      log.info('IPC: publish:startScheduler');
      
      const scheduler = getTaskScheduler();
      scheduler.start();

      return { success: true, message: '任务调度器已启动' };
    } catch (error: any) {
      log.error('IPC: publish:startScheduler failed:', error);
      return { success: false, error: error.message || '启动任务调度器失败' };
    }
  });

  // 停止任务调度器
  ipcMain.handle('publish:stopScheduler', async () => {
    try {
      log.info('IPC: publish:stopScheduler');
      
      const scheduler = getTaskScheduler();
      scheduler.stop();

      return { success: true, message: '任务调度器已停止' };
    } catch (error: any) {
      log.error('IPC: publish:stopScheduler failed:', error);
      return { success: false, error: error.message || '停止任务调度器失败' };
    }
  });

  // 获取调度器状态
  ipcMain.handle('publish:getSchedulerStatus', async () => {
    try {
      log.info('IPC: publish:getSchedulerStatus');
      
      const scheduler = getTaskScheduler();
      // TaskScheduler 没有 getStatus 方法，返回基本信息
      return { 
        success: true, 
        data: {
          isRunning: scheduler !== null
        }
      };
    } catch (error: any) {
      log.error('IPC: publish:getSchedulerStatus failed:', error);
      return { success: false, error: error.message || '获取调度器状态失败' };
    }
  });

  // 预扣减配额
  ipcMain.handle('publish:reserveQuota', async (_event, quotaType: string, amount: number = 1, taskInfo?: object) => {
    try {
      log.info(`IPC: publish:reserveQuota - ${quotaType}, amount: ${amount}`);
      
      const result = await apiClient.reserveQuota({
        quotaType: quotaType as any,
        amount,
        taskInfo
      });
      return { success: true, data: result };
    } catch (error: any) {
      log.error('IPC: publish:reserveQuota failed:', error);
      return { success: false, error: error.message || '预扣减配额失败' };
    }
  });

  // 确认配额消费
  ipcMain.handle('publish:confirmQuota', async (_event, reservationId: number, result?: object) => {  // ✅ 修复：SERIAL -> number
    try {
      log.info(`IPC: publish:confirmQuota - ${reservationId}`);
      
      const response = await apiClient.confirmQuota({
        reservationId,
        result
      });
      return { success: true, data: response };
    } catch (error: any) {
      log.error('IPC: publish:confirmQuota failed:', error);
      return { success: false, error: error.message || '确认配额消费失败' };
    }
  });

  // 释放配额
  ipcMain.handle('publish:releaseQuota', async (_event, reservationId: number, reason?: string) => {  // ✅ 修复：SERIAL -> number
    try {
      log.info(`IPC: publish:releaseQuota - ${reservationId}`);
      
      const response = await apiClient.releaseQuota({
        reservationId,
        reason
      });
      return { success: true, data: response };
    } catch (error: any) {
      log.error('IPC: publish:releaseQuota failed:', error);
      return { success: false, error: error.message || '释放配额失败' };
    }
  });

  // 获取配额信息
  ipcMain.handle('publish:getQuotaInfo', async () => {
    try {
      log.info('IPC: publish:getQuotaInfo');
      
      const info = await apiClient.getQuotaInfo();
      return { success: true, data: info };
    } catch (error: any) {
      log.error('IPC: publish:getQuotaInfo failed:', error);
      return { success: false, error: error.message || '获取配额信息失败' };
    }
  });

  // 上报发布结果
  ipcMain.handle('publish:reportResult', async (_event, report: any) => {
    try {
      log.info('IPC: publish:reportResult');
      
      await apiClient.reportPublish(report);
      return { success: true };
    } catch (error: any) {
      log.error('IPC: publish:reportResult failed:', error);
      // 上报失败时保存到本地队列
      taskService.addPendingAnalytics('publish_report', report);
      return { success: true, message: '已保存到离线队列' };
    }
  });

  // 刷新待上报的分析数据
  ipcMain.handle('publish:flushPendingAnalytics', async () => {
    try {
      log.info('IPC: publish:flushPendingAnalytics');
      
      // 手动执行待上报数据的刷新
      const pendingReports = taskService.getPendingAnalytics(50);
      
      if (pendingReports.length === 0) {
        return { success: true, message: '没有待上报的数据' };
      }

      const reports = pendingReports.map(r => JSON.parse(r.report_data));
      const result = await apiClient.reportPublishBatch(reports);

      if (result.success) {
        const ids = pendingReports.map(r => r.id);
        taskService.deletePendingAnalytics(ids);
        return { success: true, message: `成功上报 ${ids.length} 条数据` };
      } else {
        return { success: false, error: '上报失败' };
      }
    } catch (error: any) {
      log.error('IPC: publish:flushPendingAnalytics failed:', error);
      return { success: false, error: error.message || '刷新待上报数据失败' };
    }
  });

  log.info('Publish IPC handlers registered');
}

/**
 * 清理发布相关资源
 */
export function cleanupPublishHandlers(): void {
  if (taskScheduler) {
    taskScheduler.stop();
    taskScheduler = null;
  }
  if (batchExecutor) {
    batchExecutor = null;
  }
  if (publishingExecutor) {
    publishingExecutor = null;
  }
}
