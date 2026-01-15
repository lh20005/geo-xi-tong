/**
 * 任务 IPC 处理器
 * 处理发布任务的本地 CRUD 操作
 * Requirements: Phase 6 - 注册 IPC 处理器
 */

import { ipcMain } from 'electron';
import log from 'electron-log';
import { taskService, CreateTaskParams, TaskQueryParams } from '../../services';
import { storageManager } from '../../storage/manager';

/**
 * 注册任务相关 IPC 处理器
 */
export function registerTaskHandlers(): void {
  log.info('Registering task IPC handlers...');

  // 创建任务
  ipcMain.handle('task:create', async (_event, params: Omit<CreateTaskParams, 'user_id'>) => {
    try {
      log.info('IPC: task:create');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const task = taskService.create({
        ...params,
        user_id: user.id
      });

      return { success: true, data: task };
    } catch (error: any) {
      log.error('IPC: task:create failed:', error);
      return { success: false, error: error.message || '创建任务失败' };
    }
  });

  // 获取所有任务（分页）
  ipcMain.handle('task:findAll', async (_event, params?: TaskQueryParams) => {
    try {
      log.info('IPC: task:findAll');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const result = taskService.query(user.id, params || {});
      return { success: true, data: result };
    } catch (error: any) {
      log.error('IPC: task:findAll failed:', error);
      return { success: false, error: error.message || '获取任务列表失败' };
    }
  });

  // 根据 ID 获取任务
  ipcMain.handle('task:findById', async (_event, id: string) => {
    try {
      log.info(`IPC: task:findById - ${id}`);
      const task = taskService.findById(id);
      
      if (!task) {
        return { success: false, error: '任务不存在' };
      }

      return { success: true, data: task };
    } catch (error: any) {
      log.error('IPC: task:findById failed:', error);
      return { success: false, error: error.message || '获取任务失败' };
    }
  });

  // 更新任务状态
  ipcMain.handle('task:updateStatus', async (_event, id: string, status: string, errorMessage?: string) => {
    try {
      log.info(`IPC: task:updateStatus - ${id} -> ${status}`);
      const success = taskService.updateStatus(id, status, errorMessage);
      return { success };
    } catch (error: any) {
      log.error('IPC: task:updateStatus failed:', error);
      return { success: false, error: error.message || '更新任务状态失败' };
    }
  });

  // 取消任务
  ipcMain.handle('task:cancel', async (_event, id: string) => {
    try {
      log.info(`IPC: task:cancel - ${id}`);
      const success = taskService.updateStatus(id, 'cancelled', '用户手动取消');
      return { success };
    } catch (error: any) {
      log.error('IPC: task:cancel failed:', error);
      return { success: false, error: error.message || '取消任务失败' };
    }
  });

  // 删除任务
  ipcMain.handle('task:delete', async (_event, id: string) => {
    try {
      log.info(`IPC: task:delete - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      // 验证任务属于当前用户
      const task = taskService.findById(id);
      if (!task || task.user_id !== user.id) {
        return { success: false, error: '任务不存在或无权删除' };
      }

      const success = taskService.delete(id);
      return { success };
    } catch (error: any) {
      log.error('IPC: task:delete failed:', error);
      return { success: false, error: error.message || '删除任务失败' };
    }
  });

  // 获取待执行的任务
  ipcMain.handle('task:findPending', async () => {
    try {
      log.info('IPC: task:findPending');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const tasks = taskService.findPendingTasks(user.id);
      return { success: true, data: tasks };
    } catch (error: any) {
      log.error('IPC: task:findPending failed:', error);
      return { success: false, error: error.message || '获取待执行任务失败' };
    }
  });

  // 获取批次任务
  ipcMain.handle('task:findByBatchId', async (_event, batchId: string) => {
    try {
      log.info(`IPC: task:findByBatchId - ${batchId}`);
      const tasks = taskService.findByBatchId(batchId);
      return { success: true, data: tasks };
    } catch (error: any) {
      log.error('IPC: task:findByBatchId failed:', error);
      return { success: false, error: error.message || '获取批次任务失败' };
    }
  });

  // 取消批次
  ipcMain.handle('task:cancelBatch', async (_event, batchId: string) => {
    try {
      log.info(`IPC: task:cancelBatch - ${batchId}`);
      const result = taskService.cancelBatch(batchId);
      return { success: true, data: result };
    } catch (error: any) {
      log.error('IPC: task:cancelBatch failed:', error);
      return { success: false, error: error.message || '取消批次失败' };
    }
  });

  // 删除批次
  ipcMain.handle('task:deleteBatch', async (_event, batchId: string) => {
    try {
      log.info(`IPC: task:deleteBatch - ${batchId}`);
      const result = taskService.deleteBatch(batchId);
      return { success: true, data: result };
    } catch (error: any) {
      log.error('IPC: task:deleteBatch failed:', error);
      return { success: false, error: error.message || '删除批次失败' };
    }
  });

  // 获取批次统计
  ipcMain.handle('task:getBatchStats', async (_event, batchId: string) => {
    try {
      log.info(`IPC: task:getBatchStats - ${batchId}`);
      const stats = taskService.getBatchStats(batchId);
      return { success: true, data: stats };
    } catch (error: any) {
      log.error('IPC: task:getBatchStats failed:', error);
      return { success: false, error: error.message || '获取批次统计失败' };
    }
  });

  // 获取任务统计
  ipcMain.handle('task:getStats', async () => {
    try {
      log.info('IPC: task:getStats');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const stats = taskService.getStats(user.id);
      return { success: true, data: stats };
    } catch (error: any) {
      log.error('IPC: task:getStats failed:', error);
      return { success: false, error: error.message || '获取任务统计失败' };
    }
  });

  // 获取任务日志
  ipcMain.handle('task:getLogs', async (_event, taskId: string) => {
    try {
      log.info(`IPC: task:getLogs - ${taskId}`);
      const logs = taskService.getLogs(taskId);
      return { success: true, data: logs };
    } catch (error: any) {
      log.error('IPC: task:getLogs failed:', error);
      return { success: false, error: error.message || '获取任务日志失败' };
    }
  });

  // 创建发布记录
  ipcMain.handle('task:createRecord', async (_event, params: any) => {
    try {
      log.info('IPC: task:createRecord');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      const record = taskService.createRecord({
        ...params,
        user_id: user.id
      });

      return { success: true, data: record };
    } catch (error: any) {
      log.error('IPC: task:createRecord failed:', error);
      return { success: false, error: error.message || '创建发布记录失败' };
    }
  });

  // 更新发布记录
  ipcMain.handle('task:updateRecord', async (_event, id: string, params: any) => {
    try {
      log.info(`IPC: task:updateRecord - ${id}`);
      const success = taskService.updateRecord(id, params);
      return { success };
    } catch (error: any) {
      log.error('IPC: task:updateRecord failed:', error);
      return { success: false, error: error.message || '更新发布记录失败' };
    }
  });

  log.info('Task IPC handlers registered');
}
