/**
 * 蒸馏模块 IPC 处理器（本地 PostgreSQL）
 * 处理蒸馏记录的本地 CRUD 操作
 * Requirements: Phase 6 - PostgreSQL 迁移
 */

import { ipcMain } from 'electron';
import log from 'electron-log';
import { serviceFactory } from '../../services/ServiceFactory';
import { storageManager } from '../../storage/manager';

/**
 * 注册蒸馏相关 IPC 处理器
 */
export function registerLocalDistillationHandlers(): void {
  log.info('Registering local distillation IPC handlers (PostgreSQL)...');

  // 创建蒸馏记录
  ipcMain.handle('distillation:local:create', async (_event, params: any) => {
    try {
      log.info('IPC: distillation:local:create');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const distillationService = serviceFactory.getDistillationService();

      const distillation = await distillationService.create(params);

      return { success: true, data: distillation };
    } catch (error: any) {
      log.error('IPC: distillation:local:create failed:', error);
      return { success: false, error: error.message || '创建蒸馏记录失败' };
    }
  });

  // 获取所有蒸馏记录（分页）
  ipcMain.handle('distillation:local:findAll', async (_event, params?: any) => {
    try {
      log.info('IPC: distillation:local:findAll');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const distillationService = serviceFactory.getDistillationService();

      const result = await distillationService.findPaginated(
        params || {},
        ['keyword', 'industry', 'target_audience']
      );

      return { success: true, data: result };
    } catch (error: any) {
      log.error('IPC: distillation:local:findAll failed:', error);
      return { success: false, error: error.message || '获取蒸馏记录列表失败' };
    }
  });

  // 根据 ID 获取蒸馏记录
  ipcMain.handle('distillation:local:findById', async (_event, id: number) => {
    try {
      log.info(`IPC: distillation:local:findById - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const distillationService = serviceFactory.getDistillationService();

      const distillation = await distillationService.findById(id);

      if (!distillation) {
        return { success: false, error: '蒸馏记录不存在' };
      }

      return { success: true, data: distillation };
    } catch (error: any) {
      log.error('IPC: distillation:local:findById failed:', error);
      return { success: false, error: error.message || '获取蒸馏记录失败' };
    }
  });

  // 更新蒸馏记录
  ipcMain.handle('distillation:local:update', async (_event, id: number, params: any) => {
    try {
      log.info(`IPC: distillation:local:update - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const distillationService = serviceFactory.getDistillationService();

      const distillation = await distillationService.update(id, params);

      return { success: true, data: distillation };
    } catch (error: any) {
      log.error('IPC: distillation:local:update failed:', error);
      return { success: false, error: error.message || '更新蒸馏记录失败' };
    }
  });

  // 删除蒸馏记录
  ipcMain.handle('distillation:local:delete', async (_event, id: number) => {
    try {
      log.info(`IPC: distillation:local:delete - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const distillationService = serviceFactory.getDistillationService();

      await distillationService.delete(id);

      return { success: true };
    } catch (error: any) {
      log.error('IPC: distillation:local:delete failed:', error);
      return { success: false, error: error.message || '删除蒸馏记录失败' };
    }
  });

  // 批量删除蒸馏记录
  ipcMain.handle('distillation:local:deleteBatch', async (_event, ids: number[]) => {
    try {
      log.info(`IPC: distillation:local:deleteBatch - ${ids.length} records`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const distillationService = serviceFactory.getDistillationService();

      const count = await distillationService.deleteMany(ids);

      return { success: true, data: { deletedCount: count } };
    } catch (error: any) {
      log.error('IPC: distillation:local:deleteBatch failed:', error);
      return { success: false, error: error.message || '批量删除蒸馏记录失败' };
    }
  });

  // 根据关键词获取蒸馏记录
  ipcMain.handle('distillation:local:getByKeyword', async (_event, keyword: string) => {
    try {
      log.info(`IPC: distillation:local:getByKeyword - ${keyword}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const distillationService = serviceFactory.getDistillationService();

      const distillations = await distillationService.findByKeyword(keyword);

      return { success: true, data: distillations };
    } catch (error: any) {
      log.error('IPC: distillation:local:getByKeyword failed:', error);
      return { success: false, error: error.message || '获取蒸馏记录失败' };
    }
  });

  // 搜索蒸馏记录
  ipcMain.handle('distillation:local:search', async (_event, searchTerm: string) => {
    try {
      log.info(`IPC: distillation:local:search - ${searchTerm}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const distillationService = serviceFactory.getDistillationService();

      const distillations = await distillationService.search(searchTerm);

      return { success: true, data: distillations };
    } catch (error: any) {
      log.error('IPC: distillation:local:search failed:', error);
      return { success: false, error: error.message || '搜索蒸馏记录失败' };
    }
  });

  // 获取最近的蒸馏记录
  ipcMain.handle('distillation:local:findRecent', async (_event, limit: number = 10) => {
    try {
      log.info(`IPC: distillation:local:findRecent - limit: ${limit}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const distillationService = serviceFactory.getDistillationService();

      const distillations = await distillationService.findRecent(limit);

      return { success: true, data: distillations };
    } catch (error: any) {
      log.error('IPC: distillation:local:findRecent failed:', error);
      return { success: false, error: error.message || '获取最近蒸馏记录失败' };
    }
  });

  // 获取统计信息
  ipcMain.handle('distillation:local:getStats', async () => {
    try {
      log.info('IPC: distillation:local:getStats');
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const distillationService = serviceFactory.getDistillationService();

      const stats = await distillationService.getStats();

      return { success: true, data: stats };
    } catch (error: any) {
      log.error('IPC: distillation:local:getStats failed:', error);
      return { success: false, error: error.message || '获取统计信息失败' };
    }
  });

  // 检查蒸馏记录是否存在
  ipcMain.handle('distillation:local:exists', async (_event, id: number) => {
    try {
      log.info(`IPC: distillation:local:exists - ${id}`);
      const user = await storageManager.getUser();
      if (!user) {
        return { success: false, error: '用户未登录' };
      }

      serviceFactory.setUserId(user.id);
      const distillationService = serviceFactory.getDistillationService();

      const exists = await distillationService.exists(id);

      return { success: true, data: { exists } };
    } catch (error: any) {
      log.error('IPC: distillation:local:exists failed:', error);
      return { success: false, error: error.message || '检查蒸馏记录失败' };
    }
  });

  log.info('Local distillation IPC handlers registered (PostgreSQL)');
}
