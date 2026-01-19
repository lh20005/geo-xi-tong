/**
 * 任务清理 IPC 处理器
 * 提供手动清理和统计查询功能
 */

import { ipcMain } from 'electron';
import log from 'electron-log';
import { taskCleanupService } from '../../services/TaskCleanupService';
import { storageManager } from '../../storage/manager';

/**
 * 注册任务清理相关 IPC 处理器
 */
export function registerTaskCleanupHandlers(): void {
  log.info('Registering task cleanup IPC handlers...');

  // 手动触发清理
  ipcMain.handle('task-cleanup:manual', async (_event, retentionDays?: number) => {
    try {
      log.info(`IPC: task-cleanup:manual, retentionDays: ${retentionDays || 30}`);
      const user = await storageManager.getUser();
      if (!user) {
        return {
          success: false,
          deletedPublishingTasks: 0,
          deletedPublishingRecords: 0,
          error: '用户未登录'
        };
      }
      const result = await taskCleanupService.manualCleanup(retentionDays, user.id);
      return result;
    } catch (error: any) {
      log.error('IPC: task-cleanup:manual failed:', error);
      return {
        success: false,
        deletedPublishingTasks: 0,
        deletedPublishingRecords: 0,
        error: error.message || '清理失败'
      };
    }
  });

  // 获取可清理的记录统计
  ipcMain.handle('task-cleanup:stats', async (_event, retentionDays?: number) => {
    try {
      log.info(`IPC: task-cleanup:stats, retentionDays: ${retentionDays || 30}`);
      const user = await storageManager.getUser();
      if (!user) {
        return {
          success: false,
          publishingTasks: 0,
          publishingRecords: 0,
          cutoffDate: '',
          error: '用户未登录'
        };
      }
      const result = await taskCleanupService.getCleanupStats(retentionDays, user.id);
      return result;
    } catch (error: any) {
      log.error('IPC: task-cleanup:stats failed:', error);
      return {
        success: false,
        publishingTasks: 0,
        publishingRecords: 0,
        cutoffDate: '',
        error: error.message || '获取统计失败'
      };
    }
  });

  log.info('Task cleanup IPC handlers registered');
}
